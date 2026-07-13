# CLAUDE.md — 말해보카식 복습 (TOEFL 단어 퀴즈)

이 문서는 Claude Code가 이 프로젝트를 이어서 작업할 때 필요한 맥락 전부를 담는다.
새 세션에서 헤매지 않도록, **아키텍처 / 데이터 모델 / 지켜야 할 규칙 / 그동안 밟은 함정**을 정리했다.

---

## 1. 프로젝트 개요
- **단일 파일 웹앱.** 빌드 도구·프레임워크·의존성·서버 없음. `index.html` 하나가 전부(HTML + CSS + JS + 데이터 모두 인라인).
- **모바일 우선.** TOEFL 단어 암기용 자기주도 퀴즈.
- **실행:** `index.html`을 브라우저로 열면 끝.
- **배포:** 정적 호스팅이면 충분(GitHub Pages 권장 — 사용자는 `greenteavillain.github.io` 스타일로 운영).
- **기록:** 브라우저 `localStorage`. `file://`로 열어도 대부분 동작하지만 시크릿/일부 환경은 저장이 막혀서, 앱이 상단에 경고 배너를 띄운다.

## 2. 파일 구조
```
malhaeboca/
├─ index.html      # 앱 전체 (약 1,330줄)
├─ CLAUDE.md       # 이 문서
├─ README.md       # 사람용 개요
├─ .gitignore
└─ test/
   └─ smoke.js     # Node 회귀 테스트 (렌더 없이 로직 검증)
```

## 3. 큰 그림 (아키텍처)
- `index.html` 안에 `<style>`(CSS) · `<section>` 4개(화면) · `<script>`(로직) · `const CARDS`(데이터)가 전부 인라인.
- **데이터를 별도 JSON으로 빼서 `fetch`하지 말 것.** `file://`에서 CORS로 막힌다. 인라인 유지가 정석. 정 나누고 싶으면 `<script src="cards.js">`로 전역 `CARDS`를 세팅하는 방식(파일 프로토콜에서 동작).
- 배열 정의 직후:
  ```js
  CARDS.forEach(c => { if (!c.mode) c.mode = 'sentence'; });
  ```
  → **`mode`가 없는 카드는 문장형으로 간주.** (문장형 카드에는 `mode` 키를 안 적는다.)

## 4. 데이터 모델 (`const CARDS`)
카드는 3종. mode로 분기한다.

### (A) 문장형 — `mode` 생략 → `'sentence'`
```js
{ set:'보존',
  ko:'<mark>보존</mark>은 인간의 활동으로 위협받는 …',
  note:'', pre:'', answer:'Conservation',
  post:' involves safeguarding endangered plants and animals …' }
```
- 한국어 문장의 `<mark>` 부분을 영어로 채우는 빈칸 문제. `pre + answer + post` = 전체 영어 문장.
- `set`: `보존` / `경제` / `대화` (필터 `sent:*`).

### (B) 해커스형 — `mode:'hackers'`, **`part` 보유 = 해커스 보카 Day 1**
```js
{ mode:'hackers', part:1, num:1, mi:'', key:'exploit',
  word:'exploit', pos:'동사', koMean:'(부당하게) 이용하다',
  syn:['utilize','use','make use of','take advantage of'],
  ko:'… 아동의 노동을 <mark>이용하는</mark> 회사들에 …',
  pre:'Human rights activists have led protests against companies that ',
  answer:'exploit', post:' child labor.',
  note:'…', bold:3 }
```
- **2단계 카드:** (1) 예문 빈칸 채우기 → (2) 동의어 4지선다.
- `part`: 1/2/3 (필터 `hk:1/2/3`). `num`: 책 단어 번호. `mi`: 다의어 분리 표시(`①②③`). `bold`: 앞에서부터 몇 개가 '핵심(책 볼드)' 동의어인지.

### (C) 해커스형 — `mode:'hackers'`, **`lesson` 보유 = 단어 암기 · TOEFL Voca 01**
```js
{ mode:'hackers', lesson:'1-1', key:'1-1/abound',
  word:'abound', pos:'동사', mi:'', koMean:'풍부하다, 많이 있다',
  syn:['be plentiful','teem','proliferate'],
  ko:'… 물고기가 <mark>많이 산다</mark>.',
  pre:'Fish ', answer:'abound', post:' in the cold, nutrient-rich waters …',
  note:'…' }
```
- Day 1과 **메커니즘은 완전히 동일**하지만 `part` 대신 `lesson`을 쓴다.
- `bold` 없음 → 동의어 전부를 핵심으로 취급.
- `lesson`: `1-1` / `1-2` / `2-1` (필터 `voca:1-1/1-2/2-1`).

### 현재 카드 수
| 묶음 | 필터 | 수 |
|---|---|---|
| 문장 복습 | `sent:보존/경제/대화` | 17 (5 / 10 / 2) |
| 단어 암기 · TOEFL Voca 01 | `voca:1-1/1-2/2-1` | 60 (20 / 20 / 20) |
| 해커스 보카 Day 1 | `hk:1/2/3` | 65 (26 / 20 / 19) |

해커스 계열(hackers) 총 125장.

### (D) 해커스형 확장 — `book` 판별자 (2026-07-12)
Day 2·경선식은 `part`/`lesson` 대신 **`book`** 필드로 구분(그래야 `hk:all`(part)·`voca:all`(lesson)에 안 섞임).
- **해커스 Day 2**: `book:'hk2'` + `seg:1/2/3`(1–20/21–40/41–56). 필터 `hk2:1/2/3/all`. 다의어는 Day1처럼 `mi`. 63장(56단어).
- **경선식 영단어**: `book:'ks1'/'ks2'`(Lecture 01/02). 필터 `ks:1/2`. **`syn:[]` → 단일 스테이지**(빈칸만, `finishNoSyn`이 book=ks*면 "동의어 없어요" 대신 `note`(경선식 암기 이미지)만 💡로 표시). 밑줄=모르는 단어만 수록(각 9).
- `deckFor`/`mcqPool`/`collapseMeanings`/미리보기 카운트 그룹키 모두 `book` 분기 추가. mcqPool은 book 내에서만 오답.

### 키 규칙 (중요)
```js
cardKey(c) = (c.mode === 'hackers') ? 'hk:' + c.key
                                    : (c.mode === 'word' ? c.word : c.answer).toLowerCase();
```
- **`key`는 반드시 유일해야 한다.** Day 1은 `word`(+`mi`), Voca는 `lesson/word`로 네임스페이스한다.
- 이유: `annihilate` / `deliberate` / `genuine` / `compensate` 는 Day 1과 Voca 2-1 **양쪽에** 있다. Voca를 `lesson/word`로 접두하지 않으면 `cardKey`가 충돌해 기록이 섞인다.

## 5. 화면 & 흐름
```js
const screens = { start, play, result, preview };
showScreen(name); // 나머지 화면 hidden 처리
```
흐름:
```
시작 화면(세트 칩 선택)
   └─ [시작하기]  → preview(그 세트 단어 목록)
                        └─ [이 세트로 시작하기] → play(퀴즈) → result
```
- `topbar`와 화면 키보드는 **play에서만** 보인다.
- `[← 뒤로]`로 preview→start 복귀.

## 6. 세트 선택 로직 — `deckFor(filter)`
```
weak       → 이전에 틀린 카드 (weakKeys)
sent:all   → 모든 문장형
sent:{set} → 해당 set 문장형
voca:all   → lesson 있는 해커스 (= Voca 전체)
voca:{les} → 해당 lesson
hk:all     → part 있는 해커스   (= Day1 전체)
hk:{part}  → 해당 part
```
> **주의:** Voca·Day1 둘 다 `mode:'hackers'`다. 그래서 `hk:all`은 `&& c.part`, `voca:all`은 `&& c.lesson`으로 구분한다. (안 하면 서로 섞인다.)

## 7. 핵심 서브시스템

### 7.1 빈칸 입력
- 두 모드: **slots**(글자 수만큼 밑줄칸, 기본) / **width**(입력폭). 우상단 토글, `localStorage 'malhaeboca_blankmode'`에 저장.
- **정답 비교는 반드시 `blankNorm()`을 쓴다:**
  ```js
  function blankNorm(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  ```
  슬롯이 "글자만" 채우므로 비교도 글자 기준이어야 일관된다. 공백·nbsp가 섞여도 글자만 맞으면 정답(`"account for" ↔ "accountfor"` 모두 정답).
- ⚠️ **`trim().toLowerCase()` 직접 비교로 되돌리지 말 것.** 실기기(안드로이드 등)가 입력에 공백/nbsp를 넣으면 슬롯엔 정답으로 보이는데 비교에서 틀리는 버그가 있었음. `blankNorm`이 그 수정.

### 7.2 화면 내장 키보드
- OS 키보드가 화면을 가려서 자체 QWERTY를 구현. 입력창은 `inputmode="none"`(OS 키보드 억제, 물리키는 통과).
- **하단 `position:fixed` 고정.** 표시 시 `setKbd`가 `.wrap`의 `paddingBottom`을 키보드 높이+24px로 세팅(카드 안 가리게), 숨길 때 해제.
- **PC 물리 키보드:** 입력창 포커스면 native 입력이 처리, 포커스 밖이면 전역 `keydown`이 활성 입력으로 라우팅. **중복 입력 방지** — 포커스가 입력창 안(`inField`)일 땐 전역 핸들러가 관여하지 않는다. 키 버튼은 `mousedown` `preventDefault`로 포커스를 뺏지 않아 PC에서 클릭/타이핑 혼용이 된다.

### 7.3 해커스 2단계 & 오답(distractor) — **여기 규칙이 제일 중요**
- `resolveH1`(빈칸 통과) → `syn` 있으면 `openMcq`, 없으면 `finishNoSyn`(방어용; 현재는 모든 카드가 `syn` 보유).
- 4지선다 두 형식:
  - **pick**: 정답 동의어 1 + 오답 3.
  - **odd**: 동의어 3 + '아닌 것' 침입자 1 (동의어 3개↑ 카드에서 일부 확률). 질문의 **"아닌"에 밑줄**.
- 동의어 로테이션(`pickTargetSyn`): 이전에 틀린 동의어 → 미노출 볼드 → 미노출 → 가중 순. 동의어별 기록 `synStats`.
- **오답 풀 = `mcqPool(c)`: 그 카드의 홈 세트에서만 뽑는다.**
  ```js
  function mcqPool(c){
    if (c.part   != null) return CARDS.filter(x => x.mode==='hackers' && x.part   === c.part);
    if (c.lesson != null) return CARDS.filter(x => x.mode==='hackers' && x.lesson === c.lesson);
    return CARDS.filter(x => x.mode==='hackers');
  }
  ```
  - **덱과 무관하게** 카드의 `part`/`lesson` 기준. 그래서 `weak`('이전에 틀린 것')·`전체` 복습이어도 파트가 절대 안 섞인다. (예: Day1 1–20 카드는 항상 part 1 안에서만 오답.)
  - 각 세트가 19장 이상이라 4지선다는 항상 채워진다(별도 확장 불필요).
- 오답 어휘 필터: `hkTokens` 토큰 겹침 제거 → 오답이 정답 동의어와 어휘가 겹치지 않게.

### 7.4 edible (특이 이력)
- 원래 "시험용 동의어 없음"으로 특수 처리(`tasty`/`succulent`는 동의어 아님)했다가, 이후 **`eatable`, `fit for consumption`** 추가 → 지금은 일반 카드로 동작. `finishNoSyn`/가드는 방어용으로 남겨둠(다른 무동의어 카드가 생겨도 안 깨지게).

### 7.4b 다의어 접기 — `collapseMeanings` (2026-07-12)
- 다의어(`mi` 있는 해커스 카드)는 **한 판에 한 뜻만 랜덤 출제**(그룹=part|lesson+word, reservoir 샘플링). `startSet`에서만 적용, **`weak` 덱은 제외**(틀린 그 뜻을 정확히 다시 풀어야 하므로) — retry 덱도 결과 기반이라 미적용.
- 미리보기·정복률 게이지·deckFor 자체는 **전체 뜻 기준 유지**(미리보기 카운트는 "단어 20 · 뜻 26" 병기). 칩 숫자는 단어 수(20/20/17/57).
- 기록은 여전히 뜻별(cardKey에 ①②③) — 회차 반복으로 모든 뜻이 결국 커버되고, 틀린 뜻만 '틀린 단어'에 남는다. 스모크에 26→20·중복없음·100회 커버리지 단언 있음.

### 7.4c 미리보기 페이지네이션 + 정답 복사 (2026-07-12)
- 미리보기 목록은 `PV_PER`(=10)개씩 페이지(`renderPreviewPage`, `pvList`/`pvPage`, `#pvPager`). 뜻 가리기 클래스는 부모(`#previewList`)에 있어 페이지 넘겨도 유지.
- **정답 공개 후 문장 속 단어를 탭하면 클립보드 복사**(`makeAnswerCopyable`/`copyText`, 슬롯·너비 공용). ⚠️ 너비 모드 입력창은 `disabled`면 click이 안 떠서 **`readOnly`로** 둔다(`clearCopyable`이 다음 카드에서 해제). 피드백의 정답(`.copy-b`)도 위임 클릭으로 복사. `hFeedbackHTML`은 hFeedback의 innerHTML 버전.

### 7.5 미리보기(preview)
- `openPreview` → `deckFor(filter)`로 목록 렌더. `previewItem`이 카드 3종을 분기(단어·품사·뜻·동의어[핵심 볼드]·예문·노트). 문장형은 `<mark>` 제거 후 한국어+예문.

### 7.6 저장(storage)
- `STORE_KEY = 'malhaeboca_v3'`. **버전 올리지 말 것** — 사용자의 기존 기록이 날아간다.
- **이어풀기 세션**: 통계와 별개로 `SESSION_KEY = 'malhaeboca_session_v1'`에 지금 풀던 **덱(원본 인덱스 배열)·idx·results·filter**를 저장. `saveSession`(renderCard마다)·`clearSession`(showResult 완료 시)·시작화면 `updateResumeBanner`→"이어서 풀기" 배너. 앱 껐다 켜도(TWA 재로드) 복귀. CARDS 순서가 바뀌면 인덱스 검증 실패 시 세션 자동 폐기.
- `store = { words:{ [cardKey]: { seen, correct, wrong, hinted, lastResult, lastAt, synStats, … } }, sessions:[] }`.
- `weakKeys()`: `lastResult === 'x'`인 카드 key 목록 → `weak`('틀린 단어') 필터. `lastResult`는 `recordResult`가 **`isWeak(correct, hinted)`** 로 정한다(§8-10).

### 7.7 발음(TTS) — 미리 구운 MP3 (2026-07-12)
- **두 경로 모두** 미리 구운 `audio/<hash>.mp3` 재생: ①예문 = `speakSentence`, ②스피킹 질문/추임새/마무리 = `speakText`(인터뷰 `onend` 콜백으로 흐름 진행 → 오디오 `ended`가 onend 발화·`onloadedmetadata`로 실제 길이만큼 가드). 기기마다 다른 `speechSynthesis`를 대체 → **모든 기기 동일 목소리**(edge-tts `en-US-AriaNeural`). 파일 없거나 로드 실패면 speechSynthesis로 폴백(`speakFallback`/`speakTextFallback`).
- 파일명 = **재생 텍스트**의 `ttsHash`(FNV-1a 32bit·UTF-8). 예문=`(pre+answer+post).trim()`, 스피킹=질문/추임새/`IV_CLOSING` 원문. 내용 바뀌면 해시가 바뀌어 자동 무효화. 속도=`audio.playbackRate`, 볼륨=`audio.volume`.
- 생성 파이프라인 = **`tools/tts/build.sh`**(`extract.js`→`manifest.json`→`generate.py`). `extract.js`가 CARDS 예문 + `SPEAKING_TOPICS`(personal+opinion) + `IV_ACKS` + `IV_CLOSING`을 전부 뽑음. **단어/예문/스피킹 질문 추가·수정 후 반드시 재실행**(안 하면 그 항목만 브라우저 TTS 폴백). `audio/*.mp3`는 레포에 커밋(현재 491개=예문216+스피킹275·17MB), `.venv`·`manifest.json`은 gitignore.
- 오프라인: `sw.js`가 `.mp3`를 **들은 즉시 캐시**(Range 무시 전체 200 저장). 정적 자산 아님 → 전용 분기.

## 8. 지켜야 할 규칙 & 함정 요약
1. **정답 비교는 `blankNorm`** (영숫자만). `trim().toLowerCase()` 직접 비교로 회귀 금지.
2. **오답은 `mcqPool` = 카드의 홈 세트(part/lesson)**. 파트 섞지 말 것.
3. **`STORE_KEY` 고정**('malhaeboca_v3').
4. **카드 `key` 유일성** — Voca는 `lesson/word`.
5. `ko`는 대상 의미에 `<mark>`. `answer`는 굴절형 가능(`exposed`, `supplanted`)하되 `word`/`syn`은 기본형(4지선다 질문은 `word`를 씀).
6. **Dead code**: `mode:'word'`(구 암기짱형 — `renderWord`/`buildWordSlots`/동의어 스테이지 등)는 현재 미사용이나 무해하게 남겨둠. 되살리려면 `deckFor`의 `voca:*`가 지금은 해커스형을 가리킨다는 점에 유의.
7. 데이터 편집 시 JSON 따옴표/중괄호 균형 주의(카드 한 줄이 길다).
8. **힌트는 누를 때마다 한 글자씩**(`nthLetterSlice(ans, sHint)`). 최대 `hintCap=min(HINT_MAX(3), n-1)`글자(마지막 글자는 안 보여줌). cap까지 채우면 버튼이 **"정답 보기"**로 바뀌고, 그 뒤 누르면 정답 공개(`reveal/resolveH1(false)`). `updateHintLabel(used,cap)`, `actions()`가 카드마다 "힌트 보기"로 리셋. ⚠️여러 글자씩(비례) 보여주는 방식으로 되돌리지 말 것.
9. **정답/오답 모두** `resolveSentence`·`resolveH1`에서 완성된 예문을 `speakSentence(c,{auto:true})`로 읽어준다(설정 autoSpeak 존중). 오답이어도 소리로 교정하려는 의도 — 한쪽만 읽던 회귀 금지.
10. **'틀린 단어' 판정은 `isWeak(correct, hinted) = !correct || hinted` 하나로만**(유저 요청 2026-07-12). 담는 조건 = ①단어 스펠링 오답 ②힌트 쓰고 맞힘. **동의어 고르기(MCQ)는 절대 관여 X**. 그래서 각 모드는 `pushResult`에 **단어 스펠링의 정오/힌트만** 넘긴다 — 해커스 `finishHackers`는 `pushResult(c, hWordCorrect, spellHinted)`(옛 `hWordCorrect && clean` 금지), `clean`은 동의어 학습 피드백/`recordSyn` 타겟팅 전용. 결과 화면 '틀린 단어' 목록·"틀린 것만 다시 풀기"·`recordResult`가 모두 `isWeak`를 쓴다(단일 진실). 점수(X/Y)는 여전히 스펠링 정답 수라 힌트로 맞힌 건 점수엔 정답·복습엔 틀린 단어(이중처리, 의도됨). 스모크에 4-케이스 + '옛 clean 결합 없음' 단언.
11. **이전 단어 다시 보기(`openReview`/`renderReview`, 상단바 `← 이전`)는 읽기 전용**. 지금 덱의 지나온 카드(`0..idx-1`)를 시트로 보여주고 🔊만 재생 — `recordResult`/`pushResult`/`saveStore` 절대 호출 금지(기록·정복률 오염). `sheetVeil`은 설정·리뷰 두 시트 공용(닫기 로직이 서로를 안 가리게 주의). `prevWordBtn`은 `renderCard`에서 `idx>0`일 때만 노출.
12. **예문 발음은 미리 구운 MP3(§7.7)**. `ttsHash`(index.html) ↔ `tools/tts/extract.js`의 해시가 **반드시 동일**. 단어/예문 바꾸면 `bash tools/tts/build.sh` 재실행 필수(안 하면 폴백). 목소리 통일이 목적이니 `speechSynthesis`로 되돌리지 말 것(폴백 전용).

## 9. 테스트 워크플로 (회귀 방지)
브라우저 렌더 없이 **로직만 빠르게** 검증하며 개발했다:
1. `index.html`에서 `<script>` 추출.
2. `node --check`로 문법 확인.
3. `document`/`localStorage`/`speechSynthesis`/`getComputedStyle` 등을 stub한 mock-DOM에 eval → 함수를 직접 호출해 단언.

```bash
node test/smoke.js
```
카드 수, `deckFor` 카운트, `mcqPool` 홈세트 스코프, `blankNorm` 정규화 등 핵심 불변식을 확인한다. **큰 변경 후 항상 실행 권장.** (CSS/레이아웃/키보드 고정 등 시각적인 건 목으로 못 잡으니 브라우저로도 확인.)

## 10. 다음 작업 아이디어 (TODO 후보)
> 2026-07-11 대개편에서 상당수 해소됨: SRS 제외 대부분 구현(12장 참고).

- 1-1·1-2 예문 40개는 직접 작성한 것 → 원하면 실제 TOEFL 지문 예문으로 교체.
- Voca 후속 레슨 / 해커스 Day 2 추가(스키마 그대로, `key` 네임스페이스만 지키면 됨).
- preview에 **셀프 테스트**(뜻·동의어 가림/펼치기) 토글.
- '단어 암기'와 '해커스'가 형식이 같아졌으니 명칭/그룹 정리 검토.
- SRS(간격 반복) 스케줄링, 오답 노트 내보내기.
- 필요 시 파일 분리(`cards.js` 전역 로드). 단 **JSON `fetch`는 `file://`에서 불가**.

## 11. PWA & 클라우드 동기화 (2026-07-10 추가)
웹앱을 "설치되는 앱"으로 만들기 위해 **웹은 그대로 두고 껍데기만 추가**했다. 기존 로직·데이터·저장 구조는 안 건드렸다.

### 파일 구조 변화
```
index.html      # <head>에 PWA 메타/링크, <script> 끝에 동기화·SW등록 블록 추가
manifest.json   # 앱 이름·아이콘·standalone·테마색
sw.js           # 서비스워커
icons/          # icon-512/192 · apple-touch-icon(180) · favicon-32 (파란 배경 흰 V + 빈칸밑줄)
```

### 서비스워커 전략 (`sw.js`)
- **문서(index.html)는 네트워크 우선**, 실패 시 캐시 → **`git push`가 온라인에서 즉시 반영**된다(앱 재빌드·재설치 불필요). 이게 "라이브 URL을 감싸는" 핵심.
- 아이콘 등 정적 자산은 캐시 우선. 외부 오리진(Supabase)은 `respondWith` 없이 그대로 통과.
- 캐시 이름 `toeflvoca-v1`. activate에서 옛 캐시 삭제 + `skipWaiting`/`clients.claim`.
- ⚠️ **PWA 기능(설치·오프라인·SW)은 HTTPS(또는 localhost)에서만 켜진다.** `file://`에선 그냥 웹.

### 클라우드 자동 동기화 — 로그인 없음, 단일 사용자 고정 키 (2026-07-11 개편)
- **localStorage가 원본**(`STORE_KEY='malhaeboca_v3'`), Supabase는 자동 미러.
- **기기별 코드 폐지 → 고정 `CLOUD_KEY`(`voca-shared-…`) 하나를 모든 기기가 공유.** 나 혼자 쓰는 앱이라 로그인·코드 입력 없이 폰↔노트북이 **자동으로 같은 진도**. 동기화 UI(코드 표시/복사/붙여넣기)는 제거됨.
- ⚠️ `CLOUD_KEY`는 배포 JS에 노출되나(비공개 레포라도 클라 코드는 devtools로 보임), URL 아는 사람만 접근·값 랜덤·데이터는 퀴즈 진도라 수용. 다중 사용자로 갈 거면 그때 실제 로그인 필요.
- `cloudPushNow`는 **pull→병합→push**(올리기 전 타 기기 변경 병합) → 폰/노트북 동시 사용 유실 방지.
- **supabase-js 안 씀.** `fetch`로 RPC만 호출(`SB_URL` + `/rest/v1/rpc/…`, `SB_KEY`=publishable). 무의존성 유지.
- `saveStore()` 끝에서 `window.__voca_push`(=`cloudPushSoon`, 1.5s 디바운스) 호출. 부팅 시 `cloudInit()`가 pull→**단어별 `lastAt` 최신 병합**(`mergeStores`)→저장→push. `cloudReady` 플래그로 초기 병합 전 덮어쓰기 방지.
- 실행 블록 전체가 `if (typeof window!=='undefined' && window.addEventListener)` 가드 안 → **Node 스모크 테스트에선 스킵**(smoke의 mock window엔 addEventListener 없음). 함수 정의는 밖, 실행만 안. crypto/fetch/navigator를 mock 안 해도 안 깨진다.

### Supabase 백엔드 (공용 `manhwa_viewer` 프로젝트 `ihecmsgxpfdiizlkdylv`)
- 테이블 `toeflvoca_progress(sync_code text pk, data jsonb, updated_at)`. **RLS 켜고 정책 없음 = anon 직접접근 전면 차단.**
- 접근은 `SECURITY DEFINER` 함수 2개로만: `toeflvoca_pull(p_code)` / `toeflvoca_push(p_code, p_data)`(코드 최소 8자·페이로드 1MB 가드). anon/authenticated에 execute 권한. (erratogram·janflower와 같은 anon-RPC 안전 패턴.)

### 배포 (GitHub Pages 공개, 2026-07-12 이전) — 구: Netlify
- **공개 레포 → GitHub Pages** 자동배포. 라이브: **https://greenteavillain.github.io/toeflvoca/**. `git push`하면 Pages가 재빌드(=배포). `.nojekyll`로 `.well-known` 등 점파일 서빙. ⚠️Netlify(toeflvoca.netlify.app)는 2026-07 무료 배포 한도 소진으로 이전(계정·site는 남아있음).
- 재배포: **`git push`**(또는 `bash deploy.sh` = add+commit+push). Pages는 서브패스(/toeflvoca/)라 manifest scope "./"·sw 등록 "sw.js" 상대경로가 그대로 동작.
- **TWA APK = github.io 재빌드 완료(2026-07-12, v1.1/versionCode 2)**: host `greenteavillain.github.io`, launch `/toeflvoca/`. TWA 에셋링크는 **도메인 루트** 필요 → 별도 유저사이트 레포 **`Greenteavillain/greenteavillain.github.io`**(공개)가 `/.well-known/assetlinks.json`(같은 지문) 서빙 + 루트→`/toeflvoca/` 리다이렉트. 같은 키스토어라 기존 설치에 업데이트로 덮임. 재빌드=`~/Desktop/toeflvoca-twa`에서 twa-manifest 수정→`node generate.js`→`bash build-apk.sh`. (Cloudflare 불필요.)
- ⚠️ `git push`는 소스만 갱신 → **라이브 반영은 `deploy.sh` 별도 실행** 필요. (원하면 나중에 Netlify UI에서 깃 연결하면 push 자동배포 가능하나 빌드분 소모.)

### TWA(APK) — 완성 (2026-07-10)
- `toeflvoca.netlify.app`을 **얇게 감싸는 TWA**로 .apk 생성 완료. **APK = ~/Desktop/toeflvoca.apk** (1.96MB). 패키지 `com.greenteavillain.toeflvoca`, 앱이름 "말해보카식 복습"/런처 "말해보카", minSdk 21·targetSdk 35.
- **★콘텐츠 수정은 APK 재빌드 불필요**: 앱이 라이브 URL을 불러오므로 `deploy.sh`만 하면 앱도 자동 최신. **재빌드는 아이콘/이름/URL 바꿀 때만.**
- **프로젝트**: `~/Desktop/toeflvoca-twa` (git 밖, 로컬 전용). `bubblewrap init/update`가 대화형이라 **@bubblewrap/core `TwaGenerator.createTwaProject`를 Node로 직접 호출**해 비대화식 생성(scratchpad/gen-twa.js). 재빌드=`bash ~/Desktop/toeflvoca-twa/build-apk.sh`(gradle assembleRelease + zipalign + apksigner).
- **키스토어**: `~/Desktop/toeflvoca-twa/android.keystore` (alias `android`), 비번 `~/.config/toeflvoca/android_keystore_password`. **⚠️ 백업 필수** — 스토어 출시/업데이트에 같은 키 필요. SHA-256 = `.well-known/assetlinks.json`의 지문과 일치해야 전체화면 검증됨.
- **빌드 환경 함정**: (1) Bubblewrap `doctor`가 구식 SDK 레이아웃(`<sdk>/tools`|`bin`)을 찾음 → SDK루트에 `tools`→`cmdline-tools/latest` 심링크로 통과. (2) 생성물이 compileSdk 36/AGP 8.9.1 → `sdkmanager "platforms;android-36" "build-tools;35.0.0"` 설치함. (3) `bubblewrap build`는 프롬프트투성이 → gradle+apksigner 직접. 비번은 `BUBBLEWRAP_KEYSTORE_PASSWORD`/`BUBBLEWRAP_KEY_PASSWORD` env로도 넘길 수 있음.
- 안드로이드 툴체인은 [[android-build-env]](JDK17 ~/android-dev/jdk, SDK ~/Library/Android/sdk).
- 폰 설치: APK를 카톡/드라이브로 폰에 보내 "출처 불명 앱 허용" 후 탭. AAB(Play 출시)는 `./gradlew bundleRelease` + jarsigner로 별도.


## 12. 2026-07-11 대개편 — 스피킹 · 허브 · 설정 · UX (필독)
한 번의 대규모 개편으로 추가된 것들. **여전히 단일 index.html**(약 2,360줄).

### 12.1 홈 = 허브 (단어 / 스피킹 모드 탭)
- `screenStart`가 허브: `#modeTabs`(📚단어/🎙스피킹) → `#paneVoca` / `#paneSpeak` 전환. 마지막 모드는 `settings.mode`에 저장.
- 칩 그룹 재라벨(출처 기준): 학습지 문장 / TOEFL Voca 01 / 해커스 보카 Day 1(Part 1·2·3). `data-filter` 값은 **불변**(기록 호환).
- 칩에 정복률 하단 게이지(`--prog` CSS 변수, 한 번이라도 맞힌 카드 비율, 100%=초록).
- 틀린 단어 칩은 맨 위. 시작 버튼에 선택 세트 echo(`selectFilter`).

### 12.2 세션 v2 — 세트별 이어풀기 (`malhaeboca_sessions_v2`)
- 필터별 슬롯 + `retry` 슬롯. 엔트리 = `{d(인덱스), k(cardKey — 배포로 순서 바뀌면 폐기 감지), i, r, f, s, label, at}`.
- **답 확정 순간(pushResult) 세션을 다음 카드로 저장** → "다음" 안 눌러도 이중 카운트 없음. 마지막 카드면 즉시 clearSession.
- 홈 `#resumeArea`에 최근순 3개 배너(✕ 삭제). 미리보기 CTA는 세션 있으면 "이어서 풀기" 우선 + "처음부터 다시".
- v1(`malhaeboca_session_v1`)은 부팅 시 자동 마이그레이션 후 삭제.

### 12.3 스피킹 (2026 신토플 "Take an Interview")
- **실전 규격(ETS 2026 공식 스펙 기준)**: 한 주제 4문항(일상2→의견2 난이도 상승), 질문은 TTS 음성만(기본 텍스트 숨김, 인트로 체크박스로 표시 가능=`settings.ivShowText`), 준비시간 0초, 문항당 45초(카운트다운 링), 질문 TTS onend 즉시 자동 녹음, 문항 사이 인터뷰어 맞장구.
- **★주제 추가 = `SPEAKING_TOPICS` 배열에 객체 추가가 전부**: `{id, title, titleEn, scenario, personal:[..], opinion:[..]}`. 유저가 학원에서 새 유형 배워오면 여기에 얹는다(현재 8주제·270문항). 추가 후 **①스모크 개수 단언(SPEAKING_TOPICS.length·speakingPool 총합·EXP 맵) 갱신 ②`bash tools/tts/build.sh`로 새 질문 음성 생성**을 반드시 같이. 홈 주제 칩·인터뷰·풀은 배열에서 자동 생성됨.
- 연습 모드: 주제/유형(일상·의견·⭐)/랜덤, 자유 녹음(45초 초과 시 주황), 재생·재녹음·별표(`malhaeboca_speak_stars`).
- **녹음 다운로드**(학원 제출용): 연습·인터뷰 리뷰(문항별)·홈 최근녹음 3곳. `downloadBlob`+`recFileName`(TOEFL-speaking_<질문>.webm/m4a). TWA에선 안드로이드 다운로드 매니저로 저장됨.
- 녹음: MediaRecorder(webm/opus 우선), AudioContext 레벨미터. **IndexedDB `malhaeboca_rec`**에 최근 30개 보관, 홈에 최근 8개(재생/삭제).
- TTS `speakText`: onend+onerror+**가드 타이머**(단어수 기반) — 헤드리스/보이스 없음 환경에서도 플로우가 멈추지 않음.
- 홈 복귀/뒤로가기 시 `stopSpeakingAll()`이 녹음·TTS·마이크 전부 정리(`leaveCurrentScreen`에서 호출).

### 12.4 설정 (`malhaeboca_settings`) & 다크모드
- ⚙ 시트: 테마(system/light/dark), 정답 발음 자동재생(autoSpeak), 발음 속도(rate), 글자 크기(font: md/lg/xl), 기록 초기화(홈→설정으로 이사).
- 다크모드: **CSS 색은 전부 :root 토큰** → `html[data-theme="dark"]` 오버라이드. **새 색을 하드코딩하지 말고 토큰 추가할 것.** meta theme-color도 JS로 동기화.
- `speakSentence(c, {auto:true})` = 자동재생 경로(설정 존중). 🔊 버튼은 항상 재생.

### 12.5 내비게이션 (안드로이드 TWA 뒤로가기)
- History 1단계 스택: start=베이스(replaceState), 그 외 화면=push(비-start 간 이동은 replace). 뒤로가기=홈, 홈에서 한 번 더=앱 종료.
- **홈 복귀는 반드시 `goHome()`** (직접 showScreen('start') 호출 금지 — 히스토리 어긋남).
- 퀴즈 중 상단 🏠(구 🏆 자리) = 세션 저장 + 토스트 + 홈.

### 12.6 초기화 의미론 (clearedAt)
- `store.clearedAt` = 초기화 시각. `mergeStores`가 이보다 오래된 기록을 로컬/원격 어느 쪽에 있든 버림 → **클라우드 병합으로 지운 기록이 부활하던 버그의 수정이자, 초기화의 전 기기 전파 수단.** 이 로직을 제거하면 그 버그가 돌아온다. 스모크에 회귀 단언 있음.

### 12.7 기타 함정
- 내장 키보드: 3열(z열)은 `.indent2`(padding-left 9.5%)로 실물 QWERTY 스태거 — 유저 명시 요청. 임의로 걷어내지 말 것.
- 정밀 포인터(마우스) 환경은 내장 키보드 생략 + 확인 버튼 유지(`FINE_POINTER`).
- 스모크의 mock-DOM엔 `documentElement`/`matchMedia`/`history`가 없다 — 브라우저 API는 함수 안에서 가드하고, 실행 배선은 `if (typeof window !== 'undefined' && window.addEventListener)` 블록 안에.
