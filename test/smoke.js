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
  eval(scriptText + '\n;__EXPORT__({ CARDS, deckFor, mcqPool, blankNorm, cardKey, SPEAKING_TOPICS, mergeStores, pickInterviewQuestions, speakingPool, collapseMeanings, isWeak });');
} catch (e) {
  console.error('앱 초기화 중 오류(모크 부족 가능):', e.message);
  process.exit(1);
}
const { CARDS, deckFor, mcqPool, blankNorm, cardKey, SPEAKING_TOPICS, mergeStores, pickInterviewQuestions, speakingPool, collapseMeanings, isWeak } = api;

/* ---------- 단언 ---------- */
let fail = 0;
const ok = (cond, msg) => { if (!cond) { console.log('  ✗', msg); fail++; } else { console.log('  ✓', msg); } };

console.log('데이터/카운트');
const H = CARDS.filter(c => c.mode === 'hackers');
ok(Array.isArray(CARDS) && CARDS.length > 0, 'CARDS 로드됨 (' + CARDS.length + '장)');
ok(H.length === 288, '해커스 총 288장 (Day1·Voca 145 + Day2 63 + Day3 62 + 경선식 18) (' + H.length + ')');
ok(deckFor('sent:all').length === 29, '문장 전체 29 (Day1 17 + Day2 12)');
ok(deckFor('sent:1').length === 17, '문장 Day 1 = 17(토픽 통합)');
ok(deckFor('sent:2').length === 12, '문장 Day 2 = 12(학습지 Complete the Words)');
ok(deckFor('sent:2').every(c => (c.pre + c.answer + c.post).includes(c.answer) && /<mark>[^<]+<\/mark>/.test(c.ko)), '문장 Day 2 무결성(answer·mark)');
ok(deckFor('ks:all').length === 18, '경선식 전체 18');
ok(deckFor('voca:all').length === 80, 'Voca 전체 80');
ok(deckFor('voca:1-1').length === 20 && deckFor('voca:1-2').length === 20 && deckFor('voca:2-1').length === 20 && deckFor('voca:2-2').length === 20, 'Voca 레슨 각 20(1-1/1-2/2-1/2-2)');
{ const c = deckFor('voca:2-2')[0]; ok(mcqPool(c).length >= 4 && mcqPool(c).every(x => x.lesson === '2-2'), 'Voca 2-2 오답풀은 2-2 안에서만(4장+)');
  ok(deckFor('voca:2-2').every(x => (x.pre + x.answer + x.post).includes(x.answer) && x.syn.length && /<mark>[^<]+<\/mark>/.test(x.ko)), 'Voca 2-2 카드 무결성(answer·syn·mark)'); }
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
ok(SPEAKING_TOPICS.length === 8, '주제 8개 (' + SPEAKING_TOPICS.length + ')');
ok(new Set(SPEAKING_TOPICS.map(t => t.id)).size === 8, '주제 id 유일');
const [liv, car] = SPEAKING_TOPICS;
ok(liv.personal.length === 22 && liv.opinion.length === 15, '주거 22+15 (' + liv.personal.length + '/' + liv.opinion.length + ')');
ok(car.personal.length === 16 && car.opinion.length === 16, '커리어 16+16 (' + car.personal.length + '/' + car.opinion.length + ')');
const byId = Object.fromEntries(SPEAKING_TOPICS.map(t => [t.id, t]));
const EXP = { living:[22,15], career:[16,16], tech:[17,12], lifestyle:[21,13], travel:[16,17], education:[20,17], media:[16,20], community:[16,16] };
Object.entries(EXP).forEach(([id, [p, o]]) => ok(byId[id] && byId[id].personal.length === p && byId[id].opinion.length === o,
  id + ' ' + p + '+' + o + ' (' + (byId[id] ? byId[id].personal.length + '/' + byId[id].opinion.length : '없음') + ')'));
ok(SPEAKING_TOPICS.every(t => t.id && t.title && t.titleEn && t.scenario && [...t.personal, ...t.opinion].every(q => typeof q === 'string' && q.length > 10)), '모든 질문이 유효한 문자열');
ok(speakingPool('all', 'all').length === 270, '전체 풀 270문항 (69+201) (' + speakingPool('all', 'all').length + ')');
// 새 주제도 실전 인터뷰 구성 가능(일상2+의견2)
ok(pickInterviewQuestions(byId.tech).length === 4 && pickInterviewQuestions(byId.community).length === 4, '새 주제 인터뷰 4문항 구성');

console.log('스피킹 출처 라벨 (Set X-Y · Q주제연번)');
const techPers = speakingPool('tech', 'personal');
ok(techPers[7].src === 'Set 3-1 · Q08' && techPers[8].src === 'Set 3-2 · Q09', 'tech 개인 세트 경계 3-1 Q08 → 3-2 Q09 (' + techPers[7].src + ' / ' + techPers[8].src + ')');
const commOpin = speakingPool('community', 'opinion');
ok(commOpin[0].src === 'Set 8-3 · Q17', 'community 의견 첫문항(8-3) = Set 8-3 · Q17 (' + commOpin[0].src + ')');
ok(commOpin[8].src === 'Set 8-4 · Q25', 'community 8-4 첫문항 = Set 8-4 · Q25 (' + commOpin[8].src + ')');
ok(commOpin[commOpin.length - 1].src === 'Set 8-4 · Q32', 'community 마지막(8-4) = Set 8-4 · Q32 (' + commOpin[commOpin.length - 1].src + ')');
// 각 주제: 문항 번호가 Q01부터 총 문항수까지 연속(personal→opinion 순서 그대로)
Object.keys(EXP).forEach(id => { const p0 = speakingPool(id, 'all');
  const seq = p0.every((p, i) => p.src && +(p.src.match(/Q(\d+)$/) || [])[1] === i + 1);
  ok(seq, id + ' 주제연번 Q01..Q' + p0.length + ' 연속'); });
const livAll = speakingPool('living', 'all'), carAll = speakingPool('career', 'all');
ok(livAll[0].src === 'Set 1-1 · Q01' && livAll[10].src === 'Set 1-1 · Q11' && livAll[11].src === 'Set 1-2 · Q12' && livAll[livAll.length - 1].src === 'Set 1-4 · Q37', 'living: Set 1-1 Q01 ~ Set 1-4 Q37 (' + livAll[0].src + ' … ' + livAll[livAll.length - 1].src + ')');
ok(carAll[0].src === 'Set 2-1 · Q01' && carAll[16].src === 'Set 2-3 · Q17' && carAll[carAll.length - 1].src === 'Set 2-4 · Q32', 'career: Set 2-1 Q01 ~ Set 2-4 Q32 (' + carAll[0].src + ' … ' + carAll[carAll.length - 1].src + ')');
ok(speakingPool('all', 'all').every(p => p.src), '이제 모든 스피킹 문항에 출처 라벨 있음');
ok(speakingPool('all', 'all').filter(p => p.src).length === 270, '출처 라벨 붙은 문항 270개 (' + speakingPool('all', 'all').filter(p => p.src).length + ')');

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

console.log('Day 3 추가분');
ok(deckFor('hk3:all').length === 62, 'Day3 전체 62장(다의어 포함) (' + deckFor('hk3:all').length + ')');
ok(collapseMeanings(deckFor('hk3:all')).length === 56, 'Day3 접으면 56단어');
ok(deckFor('hk3:1').length === 23 && deckFor('hk3:2').length === 22 && deckFor('hk3:3').length === 17, 'Day3 seg 카드수 23/22/17');
ok(collapseMeanings(deckFor('hk3:1')).length === 20 && collapseMeanings(deckFor('hk3:2')).length === 20 && collapseMeanings(deckFor('hk3:3')).length === 16, 'Day3 seg 단어수 20/20/16');
{ const c = deckFor('hk3:1').find(x => x.word === 'apparent'); ok(mcqPool(c).every(x => x.book === 'hk3') && mcqPool(c).length >= 4, 'Day3 오답풀은 Day3 안에서만(4장+)'); }
ok(deckFor('hk3:all').every(x => (x.pre + x.answer + x.post).includes(x.answer) && x.syn.length && /<mark>[^<]+<\/mark>/.test(x.ko) && x.bold >= 1 && x.bold <= x.syn.length), 'Day3 카드 무결성(answer·syn·mark·bold)');

console.log('다의어 접기 — 한 판에 한 뜻(랜덤)');
{
  const full = deckFor('hk:1');
  const col = collapseMeanings(full);
  ok(full.length === 26 && col.length === 20, 'hk:1 26장 → 20단어 (' + col.length + ')');
  const words = col.map(c => c.word);
  ok(new Set(words).size === words.length, '접은 덱에 같은 단어 중복 없음');
  ok(col.every(c => full.includes(c)), '전부 원본 카드(합성 카드 아님)');
  ok(collapseMeanings(deckFor('hk:all')).length === 57, 'hk:all 65장 → 57단어');
  ok(collapseMeanings(deckFor('voca:all')).length === 80, 'Voca는 다의어 없음 → 80 유지');
  ok(collapseMeanings(deckFor('sent:all')).length === 29, '문장형 영향 없음 → 29 유지');
  // 100회 반복 시 account for의 세 뜻이 모두 등장(랜덤 커버리지)
  const seen = new Set();
  for (let t = 0; t < 100; t++){
    const pick = collapseMeanings(full).find(c => c.word === 'account for');
    seen.add(pick.mi);
  }
  ok(seen.size === 3, 'account for ①②③가 회차에 따라 모두 출제됨 (' + [...seen].join('') + ')');
}

console.log('틀린 단어 판정 — 스펠링 오답 or 힌트, 동의어 무관');
ok(isWeak(false, false) === true, '스펠링 오답 → 담김');
ok(isWeak(false, true) === true, '스펠링 오답 + 힌트 → 담김');
ok(isWeak(true, true) === true, '스펠링 맞음 + 힌트 → 담김');
ok(isWeak(true, false) === false, '스펠링 맞음 + 힌트無 → 안 담김(정복)');
// 동의어 MCQ는 이 함수에 인자로 들어오지 않는다 = 구조적으로 무관.
// (해커스: finishHackers가 pushResult에 hWordCorrect/스펠링힌트만 넘기고 clean은 안 넘김)
ok(scriptText.includes('pushResult(c, hWordCorrect, spellHinted)'), '해커스: 동의어 clean이 판정에서 제외됨(스펠링만 기록)');
ok(!/pushResult\(c, hWordCorrect && clean/.test(scriptText), '해커스: 옛 clean 결합 코드가 남아있지 않음');

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
