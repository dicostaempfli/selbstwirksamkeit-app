// Service Worker — Raum für Selbstwirksamkeit
// Version: 2026-08-10 09:42

const VERSION = '2026-08-10-0942';

// Bei Install: sofort aktivieren ohne auf alten SW zu warten
self.addEventListener('install', e => {
  self.skipWaiting();
});

// Bei Activate: alle Clients übernehmen
self.addEventListener('activate', e => {
  // Fix (05.07.2026): alten esm-cdn-v1-Cache entfernen — obsolet seit dem Umstieg auf lokal
  // gehostetes Preact/htm (lib-v1 ersetzt ihn), sonst bleibt er als toter Ballast im
  // Cache Storage des Geräts liegen.
  e.waitUntil(
    Promise.all([
      caches.delete('esm-cdn-v1'),
      clients.claim()
    ])
  );
});

// SKIP_WAITING Message von index.html empfangen
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: index.html und root immer Network-first (nie gecacht)
self.addEventListener('fetch', e => {
  const url = e.request.url.split('?')[0].split('#')[0];
  const isHTML = url.endsWith('/') || url.endsWith('/index.html') || url.endsWith('selbstwirksamkeit-app/');
  if(isHTML) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Fix (05.07.2026, Fund "App startet nach vollständigem Schliessen nicht mehr — Watchdog-
  // Timeout-Screen"): Der bisherige esm.sh-Sonderfall (Stale-While-Revalidate für die drei
  // live von der externen CDN geladenen Module) ist obsolet — Preact/Preact-Hooks/htm liegen
  // seit diesem Fix lokal im Repo unter lib/ (siehe index.html/admin.html, Import-Map), keine
  // Laufzeit-Abhängigkeit von esm.sh mehr. Gleiche Cache-Strategie (sofort aus Cache servieren
  // falls vorhanden, im Hintergrund parallel auffrischen) jetzt für die eigenen lib/-Dateien:
  // schützt weiterhin gegen langsame/kurz unterbrochene Verbindungen beim Kaltstart, aber ohne
  // Abhängigkeit von einem fremden Anbieter — Best-Case (warmer Cache) genauso schnell wie
  // vorher, Worst-Case (kalter Cache, z.B. allererstes Laden) jetzt nur noch von der eigenen
  // GitHub-Pages-Antwortzeit abhängig statt zusätzlich von esm.sh.
  const isLocalLib = url.includes('/lib/') && url.endsWith('.js');
  if(isLocalLib) {
    e.respondWith(
      caches.open('lib-v1').then(async cache => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request).then(resp => {
          if(resp && resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }
  // Fix (05.07.2026, Fund "App startet nach vollständigem Schliessen weiterhin nicht — trotz
  // esm.sh-Fix identisches Verhalten"): Der esm.sh-Fix allein hat das Problem nicht gelöst.
  // Zweite, bisher übersehene externe Laufzeit-Abhängigkeit gefunden: die vier Firebase-
  // Compat-Skripte (app/auth/firestore/storage) werden bei JEDEM Kaltstart blockierend von
  // www.gstatic.com geladen — ohne jeden Cache-Fallback, exakt dasselbe Fragilitäts-Muster
  // wie zuvor bei esm.sh. Gleiche Stale-While-Revalidate-Strategie jetzt auch hier: sofort aus
  // Cache servieren falls vorhanden, im Hintergrund auffrischen. Self-Hosting (wie bei Preact/
  // htm) ist hier bewusst NICHT gewählt — Firebase empfiehlt offiziell den CDN-Bezug wegen
  // automatischer Sicherheits-Patches; Caching statt Vendoring ist der richtige Mittelweg.
  const isFirebaseCdn = url.startsWith('https://www.gstatic.com/firebasejs/');
  if(isFirebaseCdn) {
    e.respondWith(
      caches.open('firebase-cdn-v1').then(async cache => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request).then(resp => {
          if(resp && resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }
  // Alle anderen Requests: normal durchlassen (kein Caching)
});

// ── Homescreen-App-Icon-Badge (Badging API) bei geschlossener App ──
// navigator.setAppBadge ist laut Spec auch im Service-Worker-Kontext (WorkerNavigator
// includes NavigatorBadge) verfügbar, kein Umweg über offene Clients nötig (Recherche
// 10.08.2026, Rico-Wunsch "einbauen für admin und coachee-app"). Der Service Worker kennt
// den React-State der laufenden App nicht — als Näherung dient die Zahl der aktuell noch
// offenen (nicht angetippten) Notifications. Bewusst simpel: keine Cloud-Function-Änderung,
// kein eigener persistenter Zähler nötig. Sobald die App wieder geöffnet wird, übernimmt
// der dortige, aus den echten Unread-Zählern gespeiste Badge-Effect (index.html) die
// Führung und überschreibt diesen Näherungswert.
async function updateBadgeFromNotifications() {
  if(!('setAppBadge' in self.navigator)) return;
  try {
    const notifications = await self.registration.getNotifications();
    if(notifications.length > 0) await self.navigator.setAppBadge(notifications.length);
    else await self.navigator.clearAppBadge();
  } catch(err) {}
}

// Push Notifications
self.addEventListener('push', e => {
  let data = { title: 'Raum für Selbstwirksamkeit', body: 'Du hast eine neue Nachricht.', tag: 'default', url: './' };
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
  // Absolute URL bauen statt relativem Pfad: ein relativer Pfad wie "#chat" würde sich
  // sonst auf die zuletzt bekannte URL des fokussierten Clients beziehen — z.B. fälschlich
  // sw.js#chat, falls irgendein Tab zuvor sw.js direkt angezeigt hat (Service-Worker-Scope
  // gilt für die ganze Origin, nicht nur für Tabs, die index.html zeigten).
  const relPath = e.notification.data?.url || './';
  const absoluteUrl = new URL(relPath, self.registration.scope).href;

  // Fix (01.07.2026, Fund "App öffnet nach Push-Tap öfters gar nicht"): Cache-Write und
  // Fenster-Öffnen laufen jetzt PARALLEL statt verkettet nacheinander. Vorher wartete
  // clients.openWindow() auf den Abschluss des Cache-Storage-Schreibvorgangs — auf
  // iOS/WebKit ist openWindow() aber nur zuverlässig, solange es noch innerhalb der
  // ursprünglichen Nutzeraktivierung (dem Antippen der Notification) läuft. Jede
  // zusätzliche await-Kette davor kann dieses Zeitfenster verbrauchen und openWindow()
  // dann wirkungslos machen — genau das führte dazu, dass die App bei einem Teil der
  // Push-Taps gar nicht mehr aufging (nicht "immer", da die Cache-Write-Dauer variiert).
  // Der Cache-Storage-Fallback selbst (aus Kapitel 28.10, für den iOS-Kaltstart-Fall, bei
  // dem die an openWindow() übergebene URL nicht zuverlässig ankommt) bleibt unverändert
  // bestehen — er läuft nur nicht mehr blockierend davor.
  const cacheWrite = caches.open('pending-deeplink')
    .then(c => c.put('/pending', new Response(JSON.stringify({ url: relPath, ts: Date.now() }))))
    .catch(() => {});

  // Fix (02.07.2026, Fund "App lädt nach Push-Tap unzuverlässig", Kapitel 32): kein
  // client.navigate() mehr für bereits offene Clients. navigate() lief bisher unabaited
  // parallel zu client.focus() — focus() löste auf der Seite sofort 'visibilitychange'
  // aus, was (bei >60s im Hintergrund) seinerseits einen komplett unabhängigen zweiten
  // Reload auslöste (hardReload() in index.html bzw. bisher reload(true) in admin.html).
  // Zwei konkurrierende Navigationen auf demselben Client erklären exakt das beobachtete
  // "mal geht's, mal nicht" — je nachdem, welche Navigation zuerst gewann bzw. die andere
  // mitten im Laden abbrach. Der Cache-Storage-Eintrag (cacheWrite oben) ist jetzt die
  // EINZIGE Quelle für das Deep-Link-Ziel; die Seite liest ihn selbst aus — entweder beim
  // Boot nach einem durch visibilitychange ausgelösten Reload, oder direkt via
  // applyPendingDeepLink(), falls kein Reload nötig war (Pflichtregel 22).
  const openOrFocus = clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(windowClients => {
      for(const client of windowClients) {
        if('focus' in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow(absoluteUrl);
    });

  e.waitUntil(Promise.all([cacheWrite, openOrFocus, updateBadgeFromNotifications()]));
});
