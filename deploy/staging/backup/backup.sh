#!/bin/bash
# ==============================================================================
# Sao luu staging DMS: PostgreSQL (moi database 1 file pg_dump) + bucket MinIO.
#
# Chay tay:        bash deploy/staging/backup/backup.sh
# Chi giu o may:   bash deploy/staging/backup/backup.sh --local-only   (khong day len R2)
# Chay dinh ky:    launchd (xem com.dms.staging-backup.plist.example) - moi ngay 12:30.
#
# Ket qua: <BACKUP_DIR>/dms-backup-AAAA-MM-DD_HHMM.tar.gz.enc (+ .sha256)
#   - tar.gz chua: <db>.dump (pg_dump -Fc), globals.sql (role), minio/ (bucket), counts.txt, manifest.txt
#   - duoc ma hoa AES-256 bang BACKUP_PASSPHRASE roi moi roi khoi may (du lieu co ma bam mat khau).
#
# Cau hinh (khong commit): file .backup.env canh script nay, xem .backup.env.example.
# Khong can .env.staging: thong tin Postgres/MinIO doc thang tu container dang chay.
#
# Ma thoat: 0 = thanh cong, khac 0 = loi (da ghi log va hien thong bao macOS).
# ==============================================================================
set -uo pipefail   # bash 3.2 (macOS) - khong dung mapfile / mang ket hop

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGING_DIR="${STAGING_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BACKUP_ENV="${BACKUP_ENV:-$SCRIPT_DIR/.backup.env}"
BACKUP_DIR="${BACKUP_DIR:-$STAGING_DIR/backups}"
LOG_FILE="${LOG_FILE:-$STAGING_DIR/logs/backup.log}"
LOCK_DIR="$STAGING_DIR/.backup.lock"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-dms-staging}"
MC_IMAGE="${MC_IMAGE:-cgr.dev/chainguard/minio-client:latest}"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
KEEP=7
LOCAL_ONLY=0
[ "${1:-}" = "--local-only" ] && LOCAL_ONLY=1

# launchd/cron khong co PATH day du
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin"

mkdir -p "$(dirname "$LOG_FILE")" "$BACKUP_DIR"
log()  { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"; }
fail() {
  log "LOI: $*"
  osascript -e "display notification \"$*\" with title \"DMS: sao luu that bai\"" >/dev/null 2>&1 || true
  exit 1
}

# Khong chay chong nhau
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log "Dang co mot lan sao luu khac chay, bo qua."; exit 0
fi
WORK=""
cleanup() { rmdir "$LOCK_DIR" 2>/dev/null; [ -n "$WORK" ] && rm -rf "$WORK"; }
trap cleanup EXIT

# ---- Cau hinh ----------------------------------------------------------------
[ -f "$BACKUP_ENV" ] || fail "Chua co $BACKUP_ENV (cp .backup.env.example .backup.env roi dien gia tri)."
load_backup_env "$BACKUP_ENV"
[ -n "${BACKUP_PASSPHRASE:-}" ] || fail "Thieu BACKUP_PASSPHRASE trong .backup.env."
KEEP="${BACKUP_KEEP:-7}"
if [ "$LOCAL_ONLY" -eq 0 ]; then
  for v in R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
    [ -n "${!v:-}" ] || fail "Thieu $v trong .backup.env (hoac chay voi --local-only)."
  done
fi

docker info >/dev/null 2>&1 || fail "Docker chua chay."

# ---- Tim container theo nhan Docker Compose ----------------------------------
PG="$(find_container "$COMPOSE_PROJECT" postgres)";  [ -n "$PG" ] || fail "Khong thay container postgres (project $COMPOSE_PROJECT) dang chay."
MINIO="$(find_container "$COMPOSE_PROJECT" minio)";  [ -n "$MINIO" ] || fail "Khong thay container minio (project $COMPOSE_PROJECT) dang chay."
PGUSER_="$(docker exec "$PG" printenv POSTGRES_USER)" || fail "Khong doc duoc POSTGRES_USER."

MINIO_USER="$(env_of "$MINIO" MINIO_ROOT_USER)"
MINIO_PASS="$(env_of "$MINIO" MINIO_ROOT_PASSWORD)"
MINIO_NET="$(docker inspect "$MINIO" --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -n 1)"
BUCKET="${MINIO_BUCKET:-attachments}"
[ -n "$MINIO_USER" ] && [ -n "$MINIO_PASS" ] && [ -n "$MINIO_NET" ] || fail "Khong doc duoc thong tin MinIO."

STAMP="$(date '+%Y-%m-%d_%H%M')"
NAME="dms-backup-$STAMP"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/dms-backup.XXXXXX")"
mkdir -p "$WORK/$NAME/minio"
OUT="$WORK/$NAME"
log "Bat dau sao luu $NAME (postgres=$PG, minio=$MINIO, bucket=$BUCKET)."

# ---- 1. PostgreSQL -----------------------------------------------------------
DBS="$(echo "select datname from pg_database where datname like '%\_db' order by 1;" | docker exec -i "$PG" psql -U "$PGUSER_" -d postgres -At)" || fail "Khong liet ke duoc database."
[ -n "$DBS" ] || fail "Khong tim thay database *_db nao."

: > "$OUT/counts.txt"
for db in $DBS; do
  docker exec "$PG" pg_dump -U "$PGUSER_" -Fc "$db" > "$OUT/$db.dump" || fail "pg_dump $db that bai."
  [ -s "$OUT/$db.dump" ] || fail "File dump $db rong."
  docker exec -i "$PG" pg_restore --list < "$OUT/$db.dump" >/dev/null || fail "File dump $db khong doc duoc (pg_restore --list loi)."
  echo "$COUNT_SQL" | docker exec -i "$PG" psql -U "$PGUSER_" -d "$db" -At | sed "s/^/$db./" >> "$OUT/counts.txt" \
    || fail "Dem hang $db that bai."
  log "  postgres: $db OK ($(wc -c < "$OUT/$db.dump" | tr -d ' ') byte)"
done
docker exec "$PG" pg_dumpall -U "$PGUSER_" --globals-only > "$OUT/globals.sql" || fail "pg_dumpall --globals-only that bai."

# ---- 2. MinIO ----------------------------------------------------------------
docker run --rm --network "$MINIO_NET" -v "$OUT/minio:/out" \
  -e "MC_HOST_local=http://$MINIO_USER:$MINIO_PASS@minio:9000" \
  "$MC_IMAGE" mirror --quiet --overwrite "local/$BUCKET" /out >> "$LOG_FILE" 2>&1 \
  || fail "Sao chep bucket MinIO '$BUCKET' that bai."
(cd "$OUT/minio" && find . -type f | sort | while read -r f; do echo "$(shasum -a 256 "$f" | cut -d' ' -f1)  $f"; done) > "$OUT/minio.sha256"
log "  minio: $(wc -l < "$OUT/minio.sha256" | tr -d ' ') tep"

cat > "$OUT/manifest.txt" <<EOF
backup:    $NAME
created:   $(date '+%Y-%m-%d %H:%M:%S %z')
host:      $(hostname)
postgres:  $(docker exec "$PG" postgres --version)
databases: $(echo $DBS)
bucket:    $BUCKET
EOF

# ---- 3. Dong goi + ma hoa ----------------------------------------------------
ARCHIVE="$BACKUP_DIR/$NAME.tar.gz.enc"
tar -czf - -C "$WORK" "$NAME" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$ARCHIVE" \
  || { rm -f "$ARCHIVE"; fail "Dong goi / ma hoa that bai."; }
(cd "$BACKUP_DIR" && shasum -a 256 "$NAME.tar.gz.enc" > "$NAME.tar.gz.enc.sha256")
log "Da tao $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))."

# ---- 4. Day len Cloudflare R2 ------------------------------------------------
mc_r2() {
  docker run --rm -v "$BACKUP_DIR:/b" \
    -e "MC_HOST_r2=https://$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY@${R2_ENDPOINT#https://}" \
    "$MC_IMAGE" "$@"
}
if [ "$LOCAL_ONLY" -eq 0 ]; then
  mc_r2 cp --quiet "/b/$NAME.tar.gz.enc" "/b/$NAME.tar.gz.enc.sha256" "r2/$R2_BUCKET/" >> "$LOG_FILE" 2>&1 \
    || fail "Upload len R2 that bai (kiem tra .backup.env, mang)."
  log "Da day len R2: $R2_BUCKET/$NAME.tar.gz.enc"
fi

# ---- 5. Giu $KEEP ban gan nhat -----------------------------------------------
old_local="$(ls -1 "$BACKUP_DIR"/dms-backup-*.tar.gz.enc 2>/dev/null | sort -r | tail -n +"$((KEEP + 1))")"
for f in $old_local; do rm -f "$f" "$f.sha256"; log "Xoa ban cu o may: $(basename "$f")"; done

if [ "$LOCAL_ONLY" -eq 0 ]; then
  old_remote="$(mc_r2 ls "r2/$R2_BUCKET/" 2>>"$LOG_FILE" | awk '{print $NF}' | grep -E '^dms-backup-.*\.tar\.gz\.enc$' | sort -r | tail -n +"$((KEEP + 1))")"
  for f in $old_remote; do
    mc_r2 rm --quiet "r2/$R2_BUCKET/$f" "r2/$R2_BUCKET/$f.sha256" >> "$LOG_FILE" 2>&1 && log "Xoa ban cu tren R2: $f"
  done
fi

log "HOAN TAT $NAME."
