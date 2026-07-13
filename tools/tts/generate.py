#!/usr/bin/env python3
"""generate.py — tools/tts/manifest.json을 읽어 ../../audio/<hash>.mp3 를 생성한다.
edge-tts(무료, Microsoft 뉴럴)로 굽고, 이미 있으면 건너뛴다(증분). 동시 8 · 재시도 3.
필요: pip install edge-tts  (build.sh가 로컬 venv로 자동 준비)
실행: python3 tools/tts/generate.py"""
import asyncio, json, os, sys
import edge_tts

VOICE = "en-US-AriaNeural"                       # 목소리 교체 지점(Jenny/Guy 등)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "audio")
MANIFEST = os.path.join(HERE, "manifest.json")

os.makedirs(OUT, exist_ok=True)
items = json.load(open(MANIFEST, encoding="utf-8"))
sem = asyncio.Semaphore(8)
done = skipped = failed = 0
fail_list = []

async def one(it):
    global done, skipped, failed
    path = os.path.join(OUT, it["hash"] + ".mp3")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        skipped += 1
        return
    async with sem:
        for attempt in range(3):
            try:
                tmp = path + ".part"
                await edge_tts.Communicate(it["text"], VOICE).save(tmp)
                if os.path.getsize(tmp) == 0:
                    raise RuntimeError("empty output")
                os.replace(tmp, path)
                done += 1
                return
            except Exception as e:
                if attempt == 2:
                    failed += 1
                    fail_list.append((it["hash"], str(e)[:60]))
                    try: os.remove(path + ".part")
                    except OSError: pass
                else:
                    await asyncio.sleep(1.2 * (attempt + 1))

async def main():
    await asyncio.gather(*(one(it) for it in items))

# 고아 파일 정리: 매니페스트에 없는 hash.mp3 는 지운다(단어 삭제/문장 수정 시)
def prune():
    valid = {it["hash"] + ".mp3" for it in items}
    removed = 0
    for f in os.listdir(OUT):
        if f.endswith(".mp3") and f not in valid:
            os.remove(os.path.join(OUT, f)); removed += 1
    return removed

asyncio.run(main())
pruned = prune()
print(f"생성 {done} · 스킵 {skipped} · 실패 {failed} · 정리 {pruned} · 총 {len(items)} → {OUT}")
if fail_list:
    print("실패:", fail_list)
    sys.exit(1)
