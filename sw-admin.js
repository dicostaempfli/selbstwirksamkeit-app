// Service Worker — Admin (Diana & Rico)
// Bewusst minimal: NUR Push-Empfang, kein Caching, kein Network-first, kein
// controllerchange-Reload-Mechanismus. Admin lief bisher absichtlich ohne Service Worker
// (siehe Projektdoku v3.56) — dieser SW erweitert das NICHT um die Komplexität von sw.js
// (Coachee), sondern bleibt eigenständig und schlank, damit Admin stabil und einfach bleibt.
// Version: 2026-07-02 09:07

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

  // Fix (01.07.2026, Fund "App öffnet nach Push-Tap öfters gar nicht", identisch zu
  // sw.js): Cache-Write und Fenster-Öffnen laufen jetzt PARALLEL statt verkettet
  // nacheinander. Vorher wartete clients.openWindow() auf den Abschluss des
  // Cache-Storage-Schreibvorgangs — auf iOS/WebKit ist openWindow() aber nur
  // zuverlässig, solange es noch innerhalb der ursprünglichen Nutzeraktivierung (dem
  // Antippen der Notification) läuft. Jede zusätzliche await-Kette davor kann dieses
  // Zeitfenster verbrauchen und openWindow() dann wirkungslos machen. Der
  // Cache-Storage-Fallback selbst (für den iOS-Kaltstart-Fall, bei dem die an
  // openWindow() übergebene URL nicht zuverlässig ankommt) bleibt unverändert bestehen
  // — er läuft nur nicht mehr blockierend davor.
  const cacheWrite = caches.open('pending-deeplink')
    .then(c => c.put('/pending', new Response(JSON.stringify({ url: relPath, ts: Date.now() }))))
    .catch(() => {});

  // Fix (02.07.2026, Fund "App lädt nach Push-Tap unzuverlässig", Kapitel 32, identisch
  // zu sw.js): kein client.navigate() mehr für bereits offene Clients — lief bisher
  // unabaited parallel zu client.focus() und konkurrierte mit dem eigenen, durch
  // visibilitychange ausgelösten Reload der Seite (bei admin.html bisher sogar
  // reload(true), siehe admin.html-Fix im selben Commit). Cache-Storage bleibt die
  // einzige Quelle für das Deep-Link-Ziel (Pflichtregel 22).
  const openOrFocus = clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(windowClients => {
      for(const client of windowClients) {
        if('focus' in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow(absoluteUrl);
    });

  e.waitUntil(Promise.all([cacheWrite, openOrFocus]));
});
