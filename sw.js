// Service Worker — Raum für Selbstwirksamkeit
// Version: 2026-07-03 16:41

const VERSION = '2026-07-03-1641';

// Bei Install: sofort aktivieren ohne auf alten SW zu warten
self.addEventListener('install', e => {
  self.skipWaiting();
});

// Bei Activate: alle Clients übernehmen
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
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
  // Fix (03.07.2026, Fund "Watchdog-Timeout bei schwachem Empfang, auch nach manuellem
  // Neuladen"): index.html selbst bleibt bewusst Network-first (siehe oben), aber die drei
  // ESM-CDN-Module (Preact, Preact-Hooks, htm von esm.sh) wurden bisher bei JEDEM Laden
  // komplett neu übers Netz geholt — ohne jeden Cache-Fallback. Bei schwachem Mobilfunk
  // (Kapitel 33/dieser Fund) kann allein das den 6s-Watchdog reissen, und ein manueller
  // Reload wiederholt exakt denselben teuren Vorgang, statt schneller zu werden. Stale-
  // While-Revalidate für esm.sh: sofort aus dem Cache servieren, falls vorhanden (schnell,
  // funktioniert auch bei sehr schwachem/kurz unterbrochenem Netz), im Hintergrund parallel
  // eine frische Version nachladen und für das nächste Mal cachen. Kein Sicherheitsrisiko,
  // da die importierten Pakete (Preact/htm) keine sicherheitsrelevante Nutzerlogik enthalten
  // und über Major-Version gepinnt sind (`@10`, `@3`) — bewusst kein Hard-Pin auf exakte
  // Patch-Version, damit Bugfixes von esm.sh weiterhin ankommen, nur eben nicht bei jedem
  // einzelnen Laden erneut vom Netz geholt werden müssen.
  const isEsmCdn = url.startsWith('https://esm.sh/');
  if(isEsmCdn) {
    e.respondWith(
      caches.open('esm-cdn-v1').then(async cache => {
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
    })
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

  e.waitUntil(Promise.all([cacheWrite, openOrFocus]));
});
