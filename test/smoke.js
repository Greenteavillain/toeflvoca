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
  eval(scriptText + '\n;__EXPORT__({ CARDS, deckFor, mcqPool, blankNorm, cardKey });');
} catch (e) {
  console.error('앱 초기화 중 오류(모크 부족 가능):', e.message);
  process.exit(1);
}
const { CARDS, deckFor, mcqPool, blankNorm, cardKey } = api;

/* ---------- 단언 ---------- */
let fail = 0;
const ok = (cond, msg) => { if (!cond) { console.log('  ✗', msg); fail++; } else { console.log('  ✓', msg); } };

console.log('데이터/카운트');
const H = CARDS.filter(c => c.mode === 'hackers');
ok(Array.isArray(CARDS) && CARDS.length > 0, 'CARDS 로드됨 (' + CARDS.length + '장)');
ok(H.length === 125, '해커스 총 125장 (' + H.length + ')');
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

console.log(fail === 0 ? '\n✅ 전부 통과' : '\n❌ 실패 ' + fail + '개');
process.exit(fail === 0 ? 0 : 1);
