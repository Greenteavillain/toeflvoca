/* extract.js — index.html의 모든 카드에서 '재생될 텍스트'를 speakSentence와 동일 규칙으로
 * 뽑아 tools/tts/manifest.json( [{hash, text}] )을 만든다.
 * hash 함수는 index.html의 ttsHash와 반드시 동일(FNV-1a 32bit · UTF-8). 바꾸면 양쪽 다 바꿀 것.
 * 실행: node tools/tts/extract.js  (또는 tools/tts/build.sh가 호출) */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('index.html에서 <script>를 찾지 못함'); process.exit(1); }

global.__EXPORT__ = o => global.api = o;
const stub = () => ({ classList:{add(){},remove(){},toggle(){},contains(){return false;}}, addEventListener(){}, style:{}, appendChild(){}, querySelector:()=>null, querySelectorAll:()=>[], dataset:{}, focus(){} });
global.document = { getElementById:()=>stub(), createElement:()=>stub(), querySelector:()=>stub(), querySelectorAll:()=>[], body:{appendChild(){}}, addEventListener(){} };
global.window = { scrollTo(){} };
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
global.setTimeout = () => {};
global.speechSynthesis = { cancel(){}, speak(){} };
global.SpeechSynthesisUtterance = function(){};
global.getComputedStyle = () => ({ fontSize:'16px', fontFamily:'x', fontWeight:'700' });
try { eval(m[1] + '\n;__EXPORT__({ CARDS });'); } catch(e){ console.error('앱 초기화 오류:', e.message); process.exit(1); }
const { CARDS } = global.api;

// ★ index.html의 ttsHash와 100% 동일해야 한다
function ttsHash(str){
  let h = 0x811c9dc5;
  const bytes = Buffer.from(str, 'utf8');
  for (let i = 0; i < bytes.length; i++){ h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0).toString(16).padStart(8, '0');
}
// ★ speakSentence와 동일한 '재생 텍스트' 규칙
function spokenText(c){ return c.mode === 'word' ? c.word : (c.pre + c.answer + c.post).trim(); }

const seen = new Map();       // hash -> text (같은 문장은 파일 1개 공유)
const collisions = [];
let bad = 0;
CARDS.forEach(c => {
  const t = spokenText(c);
  if (!t || /undefined/.test(t)) { bad++; console.error('빈/undefined 텍스트:', JSON.stringify(c).slice(0,120)); return; }
  const h = ttsHash(t);
  if (seen.has(h) && seen.get(h) !== t) collisions.push([h, seen.get(h), t]);
  seen.set(h, t);
});
if (collisions.length){ console.error('해시 충돌 발생(생성 중단):', collisions); process.exit(1); }
const manifest = [...seen.entries()].map(([hash, text]) => ({ hash, text }));
fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`총 카드 ${CARDS.length} · 고유 문장(MP3) ${manifest.length} · 빈텍스트 ${bad} · 충돌 0`);
