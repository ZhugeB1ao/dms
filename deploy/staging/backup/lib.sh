#!/bin/bash
# Ham dung chung cua backup.sh va restore.sh (duoc "source", khong chay truc tiep).
# Tuong thich bash 3.2 (macOS).

# Doc KEY=VALUE an toan: khong "source" nen khong chay ma trong file, gia tri co ky tu la van dung.
load_backup_env() {
  local file="$1" line key val
  [ -f "$file" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"; val="${line#*=}"
    case "$key" in *[!A-Za-z0-9_]*|'') continue ;; esac
    val="${val%%[[:space:]]#*}"                 # bo chu thich cuoi dong ("  # ...")
    val="${val%"${val##*[![:space:]]}"}"        # bo khoang trang cuoi
    case "$val" in \"*\") val="${val#\"}"; val="${val%\"}" ;; \'*\') val="${val#\'}"; val="${val%\'}" ;; esac
    export "$key=$val"
  done < "$file"
}

# Tim container theo nhan Docker Compose: find_container <project> <service>
find_container() {
  docker ps -q --filter "label=com.docker.compose.project=$1" \
                --filter "label=com.docker.compose.service=$2" | head -n 1
}

# Doc bien moi truong cua container: env_of <container> <TEN>
env_of() {
  docker inspect "$1" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n "s/^$2=//p" | head -n 1
}

# Cau lenh SQL dem so hang moi bang (schema public) -> "ten_bang=so_hang"
COUNT_SQL="select relname||'='||n from (select relname, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', schemaname, relname), false, true, '')))[1]::text::int as n from pg_stat_user_tables where schemaname='public') t order by 1;"

# Gui canh bao vao nhom chat (Discord webhook): send_alert "<noi dung>"
# Khong bao gio lam hong script goi no: thieu URL hoac gui loi thi chi bo qua (tra ve 0).
send_alert() {
  [ -n "${ALERT_WEBHOOK_URL:-}" ] || return 0
  local text json
  text="$(printf '%s' "$1" | head -c 1800 | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS="\\n"} {print}')"
  json="{\"username\":\"DMS Backup\",\"content\":\"$text\"}"
  curl -sS --max-time 15 -H 'Content-Type: application/json' -d "$json" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
  return 0
}
