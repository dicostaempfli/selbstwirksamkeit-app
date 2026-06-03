// Service Worker — Raum für Selbstwirksamkeit
// Version: 2026-06-03

const CACHE = 'rsw-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Push-Event: zeigt Notification
self.addEventListener('push', e => {
  let data = { title: 'Raum für Selbstwirksamkeit', body: 'Du hast eine neue Nachricht.', tag: 'default', url: '/' };
  try { if(e.data) data = { ...data, ...e.data.json() }; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/selbstwirksamkeit-app/icon-192.png',
      badge: '/selbstwirksamkeit-app/icon-192.png',
      data: { url: data.url },
      vibrate: [100, 50, 100],
      requireInteraction: false
    })
  );
});

// Klick auf Notification öffnet App
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/selbstwirksamkeit-app/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for(const client of windowClients) {
        if(client.url.includes('selbstwirksamkeit-app') && 'focus' in client) {
          return client.focus();
        }
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Periodischer Sync: prüft auf neue Impulse / Chat-Nachrichten
// (Fallback für Browser ohne Server-Push)
self.addEventListener('periodicsync', e => {
  if(e.tag === 'check-updates') {
    e.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  // Wird von der App gesteuert — SW empfängt nur
}
