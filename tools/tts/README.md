# 예문 발음(TTS) 미리 굽기

예문 음성은 **미리 구운 MP3**를 재생한다(`audio/<hash>.mp3`). 브라우저 `speechSynthesis`는 기기마다
목소리가 달라서, 모든 기기에서 **같은 목소리(edge-tts, en-US-AriaNeural)**로 통일하려고 파일로 굽는다.
파일이 없으면 런타임이 자동으로 `speechSynthesis`로 폴백한다(신규 단어를 아직 안 구웠을 때도 소리는 남).

## 언제 돌리나
**단어/예문을 추가·수정한 뒤.** 바뀐 문장만 새로 굽고(해시 동일=스킵), 사라진 문장의 파일은 정리한다.

```bash
bash tools/tts/build.sh      # extract → edge-tts 설치(로컬 venv) → 생성
git add -A && bash deploy.sh # audio/ 까지 커밋·배포
```

## 구조
- `extract.js` — `index.html`에서 재생되는 **모든 텍스트**를 뽑아 `manifest.json`(`[{hash, text}]`)을 만든다:
  ①CARDS 예문(`speakSentence`, `(pre+answer+post).trim()`) ②스피킹(`speakText`: `SPEAKING_TOPICS`의 질문 전부 + `IV_ACKS` + `IV_CLOSING`).
- `generate.py` — 매니페스트를 읽어 `audio/<hash>.mp3` 생성(증분·동시8·재시도3·고아 정리). `edge-tts` 필요.
- `build.sh` — 위 둘을 순서대로. edge-tts는 `tools/tts/.venv`에 자동 설치.

## 파일명 해시 (★중요)
파일명 = 재생 텍스트의 **FNV-1a 32bit(UTF-8) 해시**. **`extract.js`의 `ttsHash`와 `index.html`의 `ttsHash`가
반드시 동일**해야 매핑이 맞는다. 한쪽을 바꾸면 반드시 다른 쪽도 바꿀 것(안 그러면 전부 폴백으로 샘).

## 목소리 바꾸기
`generate.py`의 `VOICE`를 바꾸고 `audio/`를 비운 뒤 재생성. 후보: `en-US-JennyNeural`, `en-US-GuyNeural` 등.

## 라이선스 주의
edge-tts는 Microsoft Edge '읽어주기' 엔진(무료)이라 개인 학습용은 사실상 문제없지만 **재배포는 회색지대**다.
이 앱을 상용(popVOCA 등)으로 낼 땐 오픈소스 **Piper**(라이선스 clean, 목소리는 살짝 로봇틱)로 교체 권장 —
`generate.py`만 갈아끼우면 되고 런타임/해시/파일배치는 그대로다.
