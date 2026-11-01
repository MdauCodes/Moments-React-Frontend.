// Web Push service worker — shared by both the storefront (order-status updates) and the admin
// dashboard (new orders, TumaBoda credit alerts), since both live in this same app/origin.
// Deliberately minimal: this only needs to react to a push event and a notification click, not
// intercept/cache fetches — there's no offline mode here, just push delivery.

self.addEventListener("push", (event) => {
  let data = { title: "Moments Packaging", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Malformed/empty payload — fall back to the generic title/body above rather than dropping
    // the notification entirely.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      // A tag makes a newer notification of the same kind replace the older one (several chat replies, one notification).
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // A chat link carries a secret in its #fragment and must be opened (not just focused) so the page reads it.
      const isChatLink = url.includes("chat=");
      for (const client of clientList) {
        if (!isChatLink && client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
