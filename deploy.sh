#!/usr/bin/env bash
# toeflvoca 배포 — GitHub Pages(공개 레포). git push하면 Pages가 자동 재빌드한다.
# (Netlify는 2026-07 무료 배포 한도 소진으로 이전함. netlify_token/site는 미사용.)
set -euo pipefail
cd "$(dirname "$0")"
git add -A
git commit -m "deploy: ${1:-update}" || echo "(변경 없음)"
git push origin main
echo "✅ 푸시 완료 → GitHub Pages가 1~2분 내 재빌드합니다."
echo "   라이브: https://greenteavillain.github.io/toeflvoca/"
