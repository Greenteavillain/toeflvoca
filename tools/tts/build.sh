#!/usr/bin/env bash
# build.sh — 예문 TTS(MP3)를 한 방에 (재)생성한다.
#   1) extract.js  : index.html → manifest.json(재생 텍스트 + 해시)
#   2) generate.py : edge-tts로 audio/<hash>.mp3 생성(증분 · 고아 정리)
# 단어/예문을 추가·수정한 뒤 이걸 돌리면 바뀐 문장만 새로 굽는다(해시가 같으면 스킵).
# 실행: bash tools/tts/build.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ 1/3 매니페스트 추출"
node extract.js

echo "▶ 2/3 edge-tts 준비(로컬 venv)"
if [ ! -d .venv ]; then python3 -m venv .venv; fi
./.venv/bin/python -m pip install --quiet --upgrade pip edge-tts

echo "▶ 3/3 MP3 생성"
./.venv/bin/python generate.py

echo "✅ 완료 → ../../audio/  (git add -A 후 deploy.sh 로 배포)"
