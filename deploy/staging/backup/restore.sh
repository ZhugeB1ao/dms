#!/bin/bash
# ==============================================================================
# Khoi phuc staging DMS tu ban sao luu do backup.sh tao.
#
# 1) THU KHOI PHUC (mac dinh, an toan): dung Postgres + MinIO TRONG tam, khoi phuc vao do,
#    roi doi chieu so hang tung bang va checksum tung tep voi luc sao luu. KHONG dung toi staging that.
#      bash restore.sh <file.tar.gz.enc>
#      bash restore.sh --from-r2 latest            # tai ban moi nhat tu Cloudflare R2
#      bash restore.sh --from-r2 dms-backup-2026-11-25_1230.tar.gz.enc
#
# 2) KHOI PHUC THAT vao staging dang chay (NGUY HIEM - ghi de du lieu hien tai):
#      bash restore.sh <file.tar.gz.enc> --into-staging
#    Phai go dung "KHOI PHUC" de xac nhan. Nen tat cac service Java truoc (xem BACKUP-RESTORE.md).
#
# Tuy chon:  --keep   giu lai container thu de tu kiem tra (xoa tay sau)
# Ma thoat: 0 = tat ca khop, khac 0 = co loi hoac so lieu khong khop.
# ==============================================================================
set -uo pipefail   # bash 3.2 (macOS)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGING_DIR="${STAGING_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BACKUP_ENV="${BACKUP_ENV:-$SCRIPT_DIR/.backup.env}"
BACKUP_DIR="${BACKUP_DIR:-$STAGING_DIR/backups}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-dms-staging}"
MC_IMAGE="${MC_IMAGE:-cgr.dev/chainguard/minio-client:latest}"
PG_IMAGE="${PG_IMAGE:-postgres:16-alpine}"
MINIO_IMAGE="${MINIO_IMAGE:-cgr.dev/chainguard/minio:latest}"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin"

FILE=""; FROM_R2=""; INTO_STAGING=0; KEEP_TEST=0
while [ $# -gt 0 ]; do
  case "$1" in
    --from-r2)      FROM_R2="${2:-latest}"; shift 2 ;;
    --into-staging) INTO_STAGING=1; shift ;;
    --keep)         KEEP_TEST=1; shift ;;
    -h|--help)      sed -n '2,22p' "$0"; exit 0 ;;
    *)              FILE="$1"; shift ;;
  esac
done
[ -n "$FILE" ] || [ -n "$FROM_R2" ] || { sed -n '2,22p' "$0"; exit 2; }

say()  { echo "[$(date '+%H:%M:%S')] $*"; }
die()  { echo "LOI: $*" >&2; exit 1; }

load_backup_env "$BACKUP_ENV" || die "Chua co $BACKUP_ENV (can BACKUP_PASSPHRASE de giai ma)."
[ -n "${BACKUP_PASSPHRASE:-}" ] || die "Thieu BACKUP_PASSPHRASE trong .backup.env."
docker info >/dev/null 2>&1 || die "Docker chua chay."

WORK="$(mktemp -d "${TMPDIR:-/tmp}/dms-restore.XXXXXX")"
RID="$$"
T_NET="dms-restore-net-$RID"; T_PG="dms-restore-pg-$RID"; T_MINIO="dms-restore-minio-$RID"
cleanup() {
  rm -rf "$WORK"
  if [ "$KEEP_TEST" -eq 0 ]; then
    docker rm -f "$T_PG" "$T_MINIO" >/dev/null 2>&1
    docker network rm "$T_NET" >/dev/null 2>&1
  else
    echo "Giu lai container thu: $T_PG, $T_MINIO (mang $T_NET). Xoa: docker rm -f $T_PG $T_MINIO; docker network rm $T_NET"
  fi
}
trap cleanup EXIT

# ---- Lay file --------------------------------------------------------------
if [ -n "$FROM_R2" ]; then
  for v in R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
    [ -n "${!v:-}" ] || die "Thieu $v trong .backup.env."
  done
  mc_r2() { docker run --rm -v "$WORK:/w" -e "MC_HOST_r2=https://$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY@${R2_ENDPOINT#https://}" "$MC_IMAGE" "$@"; }
  if [ "$FROM_R2" = "latest" ]; then
    FROM_R2="$(mc_r2 ls "r2/$R2_BUCKET/" | awk '{print $NF}' | grep -E '^dms-backup-.*\.tar\.gz\.enc$' | sort | tail -n 1)"
    [ -n "$FROM_R2" ] || die "Khong co ban sao luu nao tren R2."
  fi
  say "Tai $FROM_R2 tu R2..."
  mc_r2 cp --quiet "r2/$R2_BUCKET/$FROM_R2" "r2/$R2_BUCKET/$FROM_R2.sha256" /w/ >/dev/null || die "Tai tu R2 that bai."
  FILE="$WORK/$FROM_R2"
fi
[ -f "$FILE" ] || die "Khong thay file $FILE"

# ---- Kiem tra checksum + giai ma -------------------------------------------
if [ -f "$FILE.sha256" ]; then
  expected="$(cut -d' ' -f1 "$FILE.sha256")"; actual="$(shasum -a 256 "$FILE" | cut -d' ' -f1)"
  [ "$expected" = "$actual" ] || die "Checksum SHA-256 KHONG KHOP: file bi hong hoac bi sua."
  say "Checksum SHA-256: khop."
else
  say "Canh bao: khong co file .sha256 canh file, bo qua buoc kiem tra checksum."
fi
say "Giai ma va giai nen..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$FILE" 2>/dev/null | tar -xz -C "$WORK" \
  || die "Giai ma that bai: sai BACKUP_PASSPHRASE hoac file hong."
SRC="$(find "$WORK" -maxdepth 1 -type d -name 'dms-backup-*' | head -n 1)"
[ -n "$SRC" ] && [ -f "$SRC/manifest.txt" ] || die "Noi dung ban sao luu khong hop le (thieu manifest.txt)."
echo "----- manifest -----"; cat "$SRC/manifest.txt"; echo "--------------------"
DBS="$(ls "$SRC"/*.dump | xargs -n1 basename | sed 's/\.dump$//')"
BUCKET="$(sed -n 's/^bucket: *//p' "$SRC/manifest.txt")"

FAIL=0
mc_run() { docker run --rm --network "$1" -v "$SRC/minio:/in:ro" -v "$WORK/out:/out" -e "MC_HOST_t=http://$2:$3@$4:9000" "$MC_IMAGE" "${@:5}"; }

# ============================================================================
# CHE DO 2: khoi phuc that vao staging
# ============================================================================
if [ "$INTO_STAGING" -eq 1 ]; then
  PG="$(find_container "$COMPOSE_PROJECT" postgres)";  [ -n "$PG" ]    || die "Khong thay postgres cua project $COMPOSE_PROJECT."
  MINIO="$(find_container "$COMPOSE_PROJECT" minio)";  [ -n "$MINIO" ]  || die "Khong thay minio cua project $COMPOSE_PROJECT."
  echo; echo "!!! SE GHI DE toan bo database ($(echo $DBS)) va bucket '$BUCKET' cua project '$COMPOSE_PROJECT' !!!"
  printf 'Go dung "KHOI PHUC" de tiep tuc: '; read -r ans
  [ "$ans" = "KHOI PHUC" ] || die "Da huy, khong thay doi gi."
  PGUSER_="$(docker exec "$PG" printenv POSTGRES_USER)"
  for db in $DBS; do
    say "Khoi phuc $db vao staging..."
    docker exec "$PG" psql -U "$PGUSER_" -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='$db' and pid<>pg_backend_pid();" >/dev/null
    docker exec "$PG" dropdb -U "$PGUSER_" --if-exists "$db" || die "Khong xoa duoc $db (con ket noi?)."
    docker exec "$PG" createdb -U "$PGUSER_" "$db" || die "Khong tao duoc $db."
    docker exec -i "$PG" pg_restore -U "$PGUSER_" -d "$db" --no-owner --no-privileges < "$SRC/$db.dump" || die "pg_restore $db that bai."
  done
  MU="$(env_of "$MINIO" MINIO_ROOT_USER)"; MP="$(env_of "$MINIO" MINIO_ROOT_PASSWORD)"
  MN="$(docker inspect "$MINIO" --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -n 1)"
  mkdir -p "$WORK/out"
  mc_run "$MN" "$MU" "$MP" minio mb --ignore-existing "t/$BUCKET" >/dev/null || die "Khong tao duoc bucket."
  mc_run "$MN" "$MU" "$MP" minio mirror --quiet --overwrite /in "t/$BUCKET" || die "Khoi phuc MinIO that bai."
  say "Da khoi phuc xong. Khoi dong lai cac service Java: docker compose ... restart"
  exit 0
fi

# ============================================================================
# CHE DO 1: thu khoi phuc vao Postgres + MinIO trong tam
# ============================================================================
say "Dung Postgres + MinIO trong tam (trong, khong lien quan staging that)..."
docker network create "$T_NET" >/dev/null || die "Khong tao duoc mang tam."
docker run -d --name "$T_PG" --network "$T_NET" -e POSTGRES_USER=restore -e POSTGRES_PASSWORD=restore "$PG_IMAGE" >/dev/null || die "Khong chay duoc Postgres tam."
docker run -d --name "$T_MINIO" --network "$T_NET" --network-alias minio -e MINIO_ROOT_USER=restore -e MINIO_ROOT_PASSWORD=restore-pass-123 "$MINIO_IMAGE" server /data >/dev/null || die "Khong chay duoc MinIO tam."
for i in $(seq 1 30); do docker exec "$T_PG" pg_isready -U restore -d postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$T_PG" pg_isready -U restore -d postgres >/dev/null 2>&1 || die "Postgres tam khong len."
say "Postgres tam trong (chua co database *_db): $(echo "select count(*) from pg_database where datname like '%\_db';" | docker exec -i "$T_PG" psql -U restore -d postgres -At) database."

: > "$WORK/restored-counts.txt"
for db in $DBS; do
  docker exec "$T_PG" createdb -U restore "$db" || die "Khong tao duoc $db."
  if docker exec -i "$T_PG" pg_restore -U restore -d "$db" --no-owner --no-privileges < "$SRC/$db.dump" 2>"$WORK/restore-$db.err"; then
    say "  pg_restore $db: OK"
  else
    say "  pg_restore $db: LOI"; sed 's/^/     /' "$WORK/restore-$db.err" | head -5; FAIL=1
  fi
  echo "$COUNT_SQL" | docker exec -i "$T_PG" psql -U restore -d "$db" -At | sed "s/^/$db./" >> "$WORK/restored-counts.txt"
done

echo; say "=== DOI CHIEU SO HANG TUNG BANG (luc sao luu  vs  sau khi khoi phuc) ==="
if diff -q "$SRC/counts.txt" "$WORK/restored-counts.txt" >/dev/null; then
  total_t="$(wc -l < "$SRC/counts.txt" | tr -d ' ')"; total_r="$(awk -F= '{s+=$2} END{print s+0}' "$SRC/counts.txt")"
  say "KHOP: $total_t bang, tong $total_r hang, khong sai lech."
else
  say "KHONG KHOP:"; diff "$SRC/counts.txt" "$WORK/restored-counts.txt" | sed 's/^/     /'; FAIL=1
fi
column -t -s= "$SRC/counts.txt" 2>/dev/null | sed 's/^/     /' | head -40

echo; say "=== MINIO: khoi phuc vao MinIO tam, doc lai va doi chieu checksum ==="
sleep 2; mkdir -p "$WORK/out"
for i in $(seq 1 20); do mc_run "$T_NET" restore restore-pass-123 minio minio ls t >/dev/null 2>&1 && break; sleep 1; done
mc_run "$T_NET" restore restore-pass-123 minio mb "t/$BUCKET" >/dev/null || die "Khong tao duoc bucket tam."
mc_run "$T_NET" restore restore-pass-123 minio mirror --quiet /in "t/$BUCKET" || { say "  mirror vao MinIO tam LOI"; FAIL=1; }
mc_run "$T_NET" restore restore-pass-123 minio mirror --quiet "t/$BUCKET" /out || { say "  mirror ra tu MinIO tam LOI"; FAIL=1; }
(cd "$WORK/out" && find . -type f | sort | while read -r f; do echo "$(shasum -a 256 "$f" | cut -d' ' -f1)  $f"; done) > "$WORK/minio-restored.sha256"
if diff -q "$SRC/minio.sha256" "$WORK/minio-restored.sha256" >/dev/null; then
  say "KHOP: $(wc -l < "$SRC/minio.sha256" | tr -d ' ') tep, checksum giong het luc sao luu."
else
  say "KHONG KHOP:"; diff "$SRC/minio.sha256" "$WORK/minio-restored.sha256" | sed 's/^/     /'; FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then say "KET QUA: THANH CONG - ban sao luu khoi phuc day du."; else say "KET QUA: THAT BAI - xem cac dong loi o tren."; fi
exit "$FAIL"
