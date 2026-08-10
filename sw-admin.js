// Service Worker — Admin (Diana & Rico)
// Bisher bewusst minimal: NUR Push-Empfang, kein Caching, kein Network-first, kein
// controllerchange-Reload-Mechanismus (siehe Projektdoku v3.56). Fix (05.07.2026, Fund
// "Admin-App startet nach vollständigem Schliessen nicht mehr — Watchdog-Timeout-Screen"):
// Admin hatte KEINEN Cache-Fallback für die extern von CDNs geladenen Firebase-Compat-
// Skripte (www.gstatic.com) und die neuen lokalen lib/-Module (Preact/htm) — dadurch war
// Admin bei Kaltstart noch stärker von externer Netzwerk-Erreichbarkeit abhängig als
// Coachee (sw.js). Zwei gezielte Cache-Strategien ergänzt, sonst bleibt dieser SW bewusst
// minimal (kein Network-first für admin.html selbst, kein controllerchange-Mechanismus).
// Version: 2026-08-10 09:56

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Fix (05.07.2026): Stale-While-Revalidate für lokale lib/-Module (Preact/htm) und für die
// Firebase-Compat-Skripte von www.gstatic.com — identische Strategie wie in sw.js (Coachee),
// hier aber bewusst als einzige zwei Fetch-Fälle, um den Rest des Service Workers minimal zu
// halten. Sofort aus Cache servieren falls vorhanden, im Hintergrund auffrischen.
self.addEventListener('fetch', e => {
  const url = e.request.url.split('?')[0].split('#')[0];
  const isLocalLib = url.includes('/lib/') && url.endsWith('.js');
  const isFirebaseCdn = url.startsWith('https://www.gstatic.com/firebasejs/');
  if(isLocalLib || isFirebaseCdn) {
    const cacheName = isLocalLib ? 'lib-v1' : 'firebase-cdn-v1';
    e.respondWith(
      caches.open(cacheName).then(async cache => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request).then(resp => {
          if(resp && resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
  // Alle anderen Requests (insbesondere admin.html selbst): weiterhin normal durchlassen,
  // bewusst kein Network-first-Handling hier (Admin bleibt in diesem Punkt minimal).
});

// ── Homescreen-App-Icon-Badge (Badging API) bei geschlossener App ──
// Identisches Konzept zu sw.js (Coachee) — siehe dortiger Kommentar für die vollständige
// Begründung. Näherungswert über offene Notifications, kein eigener Zähler nötig.
async function updateBadgeFromNotifications() {
  if(!('setAppBadge' in self.navigator)) return;
  try {
    const notifications = await self.registration.getNotifications();
    // Gedeckelt auf "1" (Rico-Entscheid 10.08.2026, Kapitel 66) — identisch zu sw.js.
    if(notifications.length > 0) await self.navigator.setAppBadge(1);
    else await self.navigator.clearAppBadge();
  } catch(err) {}
}

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
    }).then(() => updateBadgeFromNotifications())
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

  e.waitUntil(Promise.all([cacheWrite, openOrFocus, updateBadgeFromNotifications()]));
});
