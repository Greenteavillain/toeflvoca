#!/usr/bin/env bash
# toeflvoca 라이브 배포 — Netlify CLI 직접 배포(빌드 없음 → 무료 빌드분 0 소모).
# 앱 파일만 임시 스테이징해서 올린다(.git / *.zip / 문서 / test 제외).
# 인증 토큰은 레포 밖(~/.config/toeflvoca/netlify_token)에서 읽는다.
#
# 사용: 레포 루트에서  bash deploy.sh
set -euo pipefail

SITE_ID="e348d1cb-d755-4e6a-a290-c3fabfc2d91c"   # netlify 사이트 id (비밀 아님)
TOKEN_FILE="$HOME/.config/toeflvoca/netlify_token"
PROJ="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "토큰 파일 없음: $TOKEN_FILE" >&2
  echo "https://app.netlify.com/user/applications 에서 발급 후 저장하세요." >&2
  exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp "$PROJ/index.html" "$PROJ/manifest.json" "$PROJ/sw.js" "$STAGE/"
cp -R "$PROJ/icons" "$STAGE/"

NETLIFY_AUTH_TOKEN="$(cat "$TOKEN_FILE")" npx -y netlify-cli@latest deploy \
  --dir "$STAGE" --prod --site "$SITE_ID"
