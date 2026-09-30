#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 WORKER_URL EXPIRES_AT"
  echo "Example: $0 https://csp-scheduling-game-api.example.workers.dev 2026-10-11T23:59:00-04:00"
  exit 1
fi

worker_url=${1%/}
expires_at=$2

printf "Cloudflare ADMIN_TOKEN: "
stty -echo
IFS= read -r admin_token
stty echo
printf "\nNew activity password: "
stty -echo
IFS= read -r activity_password
stty echo
printf "\n"

if [ ${#activity_password} -lt 8 ]; then
  echo "Password must contain at least 8 characters."
  exit 1
fi

payload=$(ACTIVITY_PASSWORD="$activity_password" EXPIRES_AT="$expires_at" python3 -c \
  'import json, os; print(json.dumps({"password": os.environ["ACTIVITY_PASSWORD"], "expiresAt": os.environ["EXPIRES_AT"]}))')

curl --fail-with-body --silent --show-error \
  -X POST "$worker_url/admin/access" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  --data "$payload"
printf "\n"

unset admin_token activity_password payload
