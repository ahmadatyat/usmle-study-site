/* Timer alerts only. No fetch interception or offline-review cache. */
const databaseName = 'studywell-focus-alerts';
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function state(key, value, write = false) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('state', write ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('state'), request = write ? store.put(value, key) : store.get(key);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
async function claimNotification(userId, id) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('state', 'readwrite'), store = transaction.objectStore('state');
      let claimed = false;
      const account = store.get('account');
      account.onsuccess = () => {
        if (account.result !== userId) return;
        const seen = store.get('seen:' + id);
        seen.onsuccess = () => { if (!seen.result) { store.put(Date.now(), 'seen:' + id); claimed = true; } };
      };
      transaction.oncomplete = () => resolve(claimed); transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (!event.source?.url || !event.source.url.startsWith(self.registration.scope)) return;
  if (event.data?.type === 'studywell-account' && (typeof event.data.userId === 'string' || event.data.userId === null)) {
    event.waitUntil(state('account', event.data.userId, true));
  }
});
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data?.json(); } catch { return; }
    if (!data || typeof data.id !== 'string' || typeof data.tag !== 'string' || typeof data.userId !== 'string' || !Number.isFinite(data.expiresAt) || data.expiresAt < Date.now()) return;
    const target = new URL(data.url, self.registration.scope), scope = new URL(self.registration.scope);
    if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)) return;
    if (!await claimNotification(data.userId, data.id)) return;
    await self.registration.showNotification(String(data.title).slice(0, 100), { body: String(data.body).slice(0, 250), tag: data.tag, icon: new URL('studywell-icon.svg', self.registration.scope).href, data: { url: target.href }, renotify: false });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || 'dashboard/#focus-timer', self.registration.scope), scope = new URL(self.registration.scope);
    if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)) return;
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = tabs.find(client => client.url.startsWith(scope.href));
    if (tab) { await tab.focus(); await tab.navigate(target.href); } else await self.clients.openWindow(target.href);
  })());
});
