/* 말해보카식 복습 — 서비스워커
 * 문서(index.html)는 네트워크 우선 → git push가 온라인에서 즉시 반영된다.
 * 오프라인이면 캐시로 폴백, 아이콘 등 정적 자산은 캐시 우선.
 * 콘텐츠를 바꿔도 APK 재빌드 불필요(라이브 URL을 감싸는 TWA 전제). */
const CACHE = 'toeflvoca-v2';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase 등 외부 호출은 그대로 통과

  // 미리 구운 예문 MP3: 재생(들은) 즉시 캐시 → 이후 오프라인 재생. Range 요청이 와도
  // Range 없는 전체 요청으로 받아 200을 캐시(Cache API는 206을 못 넣음).
  if (url.pathname.endsWith('.mp3')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req.url);
      if (hit) return hit;
      try {
        const net = await fetch(req.url);                       // Range 헤더 없이 전체 파일
        if (net && net.status === 200) await cache.put(req.url, net.clone());
        return net;
      } catch (err) { return (await cache.match(req.url)) || Response.error(); }
    })());
    return;
  }

  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isDoc) {
    // 문서: 네트워크 우선(최신 반영), 실패 시 캐시
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE); c.put(req, net.clone());
        return net;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
  } else {
    // 정적 자산: 캐시 우선
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE); c.put(req, net.clone());
        return net;
      } catch (err) { return Response.error(); }
    })());
  }
});
