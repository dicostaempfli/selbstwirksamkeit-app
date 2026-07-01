// Service Worker — Admin (Diana & Rico)
// Bewusst minimal: NUR Push-Empfang, kein Caching, kein Network-first, kein
// controllerchange-Reload-Mechanismus. Admin lief bisher absichtlich ohne Service Worker
// (siehe Projektdoku v3.56) — dieser SW erweitert das NICHT um die Komplexität von sw.js
// (Coachee), sondern bleibt eigenständig und schlank, damit Admin stabil und einfach bleibt.
// Version: 2026-06-30 (Erstversion)

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Push Notifications — identisches Payload-Format wie sw.js (Coachee), damit die
// Cloud Function dieselbe sendPushToUid()-Logik für beide Zielgruppen nutzen kann.
self.addEventListener('push', e => {
  let data = { title: 'Raum für Selbstwirksamkeit', body: 'Neue Aktivität', tag: 'admin-default', url: './' };
  try { if(e.data) data = { ...data, ...e.data.json() }; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { url: data.url },
      vibrate: [100, 50, 100],
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const relPath = e.notification.data?.url || './';
  const absoluteUrl = new URL(relPath, self.registration.scope).href;
  // Zusätzlicher, von openWindow()/navigate() unabhängiger Übergabeweg (NEU 01.07.2026):
  // Bei komplett geschlossener App (Kaltstart über die Notification) ist clients.openWindow()
  // der einzig mögliche Pfad, da noch kein Client existiert — dabei gibt es eine bekannte
  // WebKit/iOS-Einschränkung, bei der die übergebene URL beim Kaltstart einer standalone-PWA
  // nicht zuverlässig übernommen wird und die App stattdessen bei der manifest-start_url ohne
  // Hash landet (Fund 01.07.2026, betraf konkret admin.html#chat-<uid>). Fix: Ziel zusätzlich
  // im Cache Storage ablegen (aus dem Service Worker heraus beschreibbar, anders als
  // localStorage) — die App liest das beim eigenen Start zusätzlich aus (siehe
  // applyPendingDeepLink() in admin.html) und navigiert notfalls selbst dorthin.
  e.waitUntil(
    caches.open('pending-deeplink')
      .then(c => c.put('/pending', new Response(JSON.stringify({ url: relPath, ts: Date.now() }))))
      .catch(() => {})
      .then(() => clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(windowClients => {
        for(const client of windowClients) {
          if('focus' in client) {
            if('navigate' in client) client.navigate(absoluteUrl).catch(()=>{});
            return client.focus();
          }
        }
        if(clients.openWindow) return clients.openWindow(absoluteUrl);
      })
  );
});
