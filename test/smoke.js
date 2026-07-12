/*
 * smoke.js — 렌더 없이 index.html의 로직 불변식을 검증한다.
 *
 * 방식: index.html에서 <script>를 추출 → document/localStorage 등을 stub한
 *       mock-DOM 위에서 실행 → 내부 함수를 직접 호출해 단언.
 *
 * 실행:  node test/smoke.js
 * (CSS/레이아웃/키보드 고정 등 시각적인 부분은 이 테스트로 못 잡으니 브라우저로도 확인할 것.)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('index.html에서 <script>를 찾지 못했습니다.'); process.exit(1); }
const scriptText = m[1];

/* ---------- 최소 mock-DOM ---------- */
function El() {
  const cls = new Set();
  const el = {
    _children: [], dataset: {}, style: {}, _text: '', _html: '', value: '', disabled: false, oninput: null,
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)),
      toggle: (c, f) => { if (f === undefined) f = !cls.has(c); f ? cls.add(c) : cls.delete(c); return f; },
      contains: (c) => cls.has(c),
    },
    appendChild: (ch) => { el._children.push(ch); return ch; },
    addEventListener: () => {}, removeEventListener: () => {},
    focus: () => {}, blur: () => {}, querySelectorAll: () => [], querySelector: () => null,
  };
  Object.defineProperty(el, 'className', { get: () => [...cls].join(' '), set: v => { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(x => cls.add(x)); } });
  Object.defineProperty(el, 'textContent', { get: () => el._text, set: v => { el._text = String(v); } });
  Object.defineProperty(el, 'innerHTML', { get: () => el._html, set: v => { el._html = String(v); el._children = []; } });
  Object.defineProperty(el, 'offsetWidth', { get: () => 10 });
  Object.defineProperty(el, 'offsetHeight', { get: () => 210 });
  return el;
}
const registry = {};
global.document = {
  getElementById: (id) => registry[id] || (registry[id] = El()),
  createElement: () => El(),
  querySelector: (s) => (s === '.wrap' ? El() : { style: {}, classList: { toggle: () => {} } }),
  querySelectorAll: () => [],
  body: { appendChild: () => {} },
  addEventListener: () => {},
};
global.window = { scrollTo: () => {} };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
global.setTimeout = (fn) => { try { fn(); } catch (e) {} };
global.speechSynthesis = { cancel: () => {}, speak: () => {} };
global.SpeechSynthesisUtterance = function () {};
global.getComputedStyle = () => ({ fontSize: '16px', fontFamily: 'x', fontWeight: '700' });

/* ---------- 앱 실행 + 내부 심볼 추출 ----------
 * 직접 eval에 훅을 붙여 같은 스코프의 const/let/function을 밖으로 내보낸다. */
let api = null;
global.__EXPORT__ = (o) => { api = o; };
try {
  // eslint-disable-next-line no-eval
  eval(scriptText + '\n;__EXPORT__({ CARDS, deckFor, mcqPool, blankNorm, cardKey, SPEAKING_TOPICS, mergeStores, pickInterviewQuestions, speakingPool, collapseMeanings });');
} catch (e) {
  console.error('앱 초기화 중 오류(모크 부족 가능):', e.message);
  process.exit(1);
}
const { CARDS, deckFor, mcqPool, blankNorm, cardKey, SPEAKING_TOPICS, mergeStores, pickInterviewQuestions, speakingPool, collapseMeanings } = api;

/* ---------- 단언 ---------- */
let fail = 0;
const ok = (cond, msg) => { if (!cond) { console.log('  ✗', msg); fail++; } else { console.log('  ✓', msg); } };

console.log('데이터/카운트');
const H = CARDS.filter(c => c.mode === 'hackers');
ok(Array.isArray(CARDS) && CARDS.length > 0, 'CARDS 로드됨 (' + CARDS.length + '장)');
ok(H.length === 206, '해커스 총 206장 (Day1·Voca 125 + Day2 63 + 경선식 18) (' + H.length + ')');
ok(deckFor('sent:all').length === 17, '문장 전체 17');
ok(deckFor('voca:all').length === 60, 'Voca 전체 60');
ok(deckFor('voca:1-1').length === 20 && deckFor('voca:1-2').length === 20 && deckFor('voca:2-1').length === 20, 'Voca 레슨 각 20');
ok(deckFor('hk:all').length === 65, 'Day1 전체 65');
ok(deckFor('hk:1').length === 26 && deckFor('hk:2').length === 20 && deckFor('hk:3').length === 19, 'Day1 파트 26/20/19');

console.log('키 유일성');
const keys = H.map(c => 'hk:' + c.key);
ok(new Set(keys).size === keys.length, '해커스 key 중복 없음');
// Day1과 Voca가 같은 단어를 써도 cardKey가 다른지(네임스페이스)
const dayAnn = H.find(c => c.part != null && c.word === 'annihilate');
const vocaAnn = H.find(c => c.lesson === '2-1' && c.word === 'annihilate');
if (dayAnn && vocaAnn) ok(cardKey(dayAnn) !== cardKey(vocaAnn), 'annihilate: Day1/Voca 키 분리 (' + cardKey(vocaAnn) + ')');

console.log('mcqPool — 오답은 카드의 홈 세트에서만');
const dayCard = H.find(c => c.part === 1);
const vocaCard = H.find(c => c.lesson === '2-1');
ok(mcqPool(dayCard).every(x => x.part === dayCard.part), 'part1 카드 → part1만');
ok(mcqPool(dayCard).every(x => x.lesson == null), 'part1 풀에 Voca 카드 없음');
ok(mcqPool(vocaCard).every(x => x.lesson === '2-1'), 'voca 2-1 카드 → 2-1만');
ok(mcqPool(vocaCard).every(x => x.part == null), 'voca 풀에 Day1 카드 없음');
ok(mcqPool(dayCard).length >= 4, 'part1 풀 4장 이상 (4지선다 가능)');

console.log('blankNorm — 영숫자만, 공백/nbsp 무시');
ok(blankNorm('E x P l O i T') === 'exploit', '공백 섞여도 정규화');
ok(blankNorm('account for') === blankNorm('accountfor'), '두 단어 공백 유무 동일');
ok(blankNorm('famine\u00A0') === 'famine', 'nbsp 제거');

console.log('스피킹 질문 뱅크');
ok(SPEAKING_TOPICS.length === 2, '주제 2개 (' + SPEAKING_TOPICS.length + ')');
const [liv, car] = SPEAKING_TOPICS;
ok(liv.personal.length === 22 && liv.opinion.length === 15, '주거 22+15 (' + liv.personal.length + '/' + liv.opinion.length + ')');
ok(car.personal.length === 16 && car.opinion.length === 16, '커리어 16+16 (' + car.personal.length + '/' + car.opinion.length + ')');
ok(SPEAKING_TOPICS.every(t => t.id && t.title && t.scenario && [...t.personal, ...t.opinion].every(q => typeof q === 'string' && q.length > 10)), '모든 질문이 유효한 문자열');
ok(speakingPool('all', 'all').length === 69, '전체 풀 69문항');

console.log('실전 인터뷰 세트 구성 (일상2 → 의견2)');
for (let t = 0; t < 20; t++){
  const set = pickInterviewQuestions(liv);
  if (!(set.length === 4 && set[0].type === '일상' && set[1].type === '일상' && set[2].type === '의견' && set[3].type === '의견')){ ok(false, '4문항 일상2→의견2 구성 (시도 ' + t + ')'); break; }
  if (new Set(set.map(x => x.q)).size !== 4){ ok(false, '질문 중복 없음 (시도 ' + t + ')'); break; }
  if (t === 19) ok(true, '20회 반복 모두 4문항 · 일상2→의견2 · 중복 없음');
}

console.log('Day 2 · 경선식 추가분');
ok(deckFor('hk2:all').length === 63, 'Day2 전체 63장(다의어 포함) (' + deckFor('hk2:all').length + ')');
ok(collapseMeanings(deckFor('hk2:all')).length === 56, 'Day2 접으면 56단어');
ok(deckFor('hk2:1').length === 24 && deckFor('hk2:2').length === 22 && deckFor('hk2:3').length === 17, 'Day2 seg 카드수 24/22/17');
ok(collapseMeanings(deckFor('hk2:1')).length === 20 && collapseMeanings(deckFor('hk2:2')).length === 20 && collapseMeanings(deckFor('hk2:3')).length === 16, 'Day2 seg 단어수 20/20/16');
ok(deckFor('ks:1').length === 9 && deckFor('ks:2').length === 9, '경선식 Lecture 01·02 각 9');
ok(deckFor('ks:1').every(c => c.syn.length === 0), '경선식은 동의어 없음(단일 스테이지)');
{ const hk = CARDS.filter(c => c.mode === 'hackers'); const keys = hk.map(c => 'hk:' + c.key); ok(new Set(keys).size === keys.length, '전체 해커스 key 유일(Day2·경선식 포함)'); }
{ const c = deckFor('hk2:1').find(x => x.word === 'decline'); ok(mcqPool(c).every(x => x.book === 'hk2'), 'Day2 오답풀은 Day2 안에서만'); }

console.log('다의어 접기 — 한 판에 한 뜻(랜덤)');
{
  const full = deckFor('hk:1');
  const col = collapseMeanings(full);
  ok(full.length === 26 && col.length === 20, 'hk:1 26장 → 20단어 (' + col.length + ')');
  const words = col.map(c => c.word);
  ok(new Set(words).size === words.length, '접은 덱에 같은 단어 중복 없음');
  ok(col.every(c => full.includes(c)), '전부 원본 카드(합성 카드 아님)');
  ok(collapseMeanings(deckFor('hk:all')).length === 57, 'hk:all 65장 → 57단어');
  ok(collapseMeanings(deckFor('voca:all')).length === 60, 'Voca는 다의어 없음 → 60 유지');
  ok(collapseMeanings(deckFor('sent:all')).length === 17, '문장형 영향 없음 → 17 유지');
  // 100회 반복 시 account for의 세 뜻이 모두 등장(랜덤 커버리지)
  const seen = new Set();
  for (let t = 0; t < 100; t++){
    const pick = collapseMeanings(full).find(c => c.word === 'account for');
    seen.add(pick.mi);
  }
  ok(seen.size === 3, 'account for ①②③가 회차에 따라 모두 출제됨 (' + [...seen].join('') + ')');
}

console.log('클라우드 병합 — 초기화(clearedAt) 의미론');
const mA = mergeStores({ words:{}, sessions:[], clearedAt:2000 }, { words:{ old:{ seen:5, lastAt:1500 } } });
ok(Object.keys(mA.words).length === 0, '초기화 후 원격 기록 부활 차단');
const mB = mergeStores({ words:{ fresh:{ seen:1, lastAt:2500 } }, sessions:[], clearedAt:2000 }, { words:{ old:{ seen:5, lastAt:1500 } } });
ok(Object.keys(mB.words).join(',') === 'fresh', '초기화 이후 새 기록은 유지');
const mC = mergeStores({ words:{ old:{ seen:5, lastAt:1500 } }, sessions:[] }, { words:{}, sessions:[], clearedAt:2000 });
ok(Object.keys(mC.words).length === 0, '초기화가 다른 기기로 전파');
const mD = mergeStores({ words:{ a:{ seen:1, lastAt:100 } }, sessions:[] }, { words:{ a:{ seen:9, lastAt:200 }, b:{ seen:2, lastAt:50 } } });
ok(mD.words.a.seen === 9 && !!mD.words.b, 'clearedAt 없으면 lastAt 최신 병합(기존 동작 유지)');

console.log(fail === 0 ? '\n✅ 전부 통과' : '\n❌ 실패 ' + fail + '개');
process.exit(fail === 0 ? 0 : 1);
