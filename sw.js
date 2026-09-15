/* マイ✦プラチナ Service Worker
   方針：
   - アプリの枠（index.html・ロゴ・アイコン）はキャッシュして高速起動＆オフライン対応
   - 運行データ(secure.json)・ニュース等のJSONは常にネット優先＝古い予定を出さない
   - Firebase(つぶやき) や Google Fonts など別オリジンは一切介入しない
   キャッシュ名の版を上げると、古いキャッシュを破棄して更新できる。 */
const CACHE = "platinum-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./logo-icon.png",
  "./logo-h-blue.png",
  "./logo-h-white.png",
  "./logo-login.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))  // 1つ失敗しても止めない
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 別オリジン（Firebase / gstatic / Google Fonts 等）は介入しない
  if (url.origin !== self.location.origin) return;

  const isJSON = /\.json(\?.*)?$/.test(url.pathname) || url.pathname.endsWith(".webmanifest");
  const isHTML = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  if (isJSON || isHTML) {
    // ネット優先：最新の運行データ・アプリ本体を取得。失敗時のみキャッシュ（オフライン用）
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(m => m || (isHTML ? caches.match("./index.html") : Response.error())))
    );
    return;
  }

  // 画像・アイコン等の静的アセットはキャッシュ優先（軽快表示）
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
