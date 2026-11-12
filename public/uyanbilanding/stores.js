/* One place for store and waitlist links. Empty listing URLs mean the app is not in the store yet:
   the badge then shows "Çok yakında" and goes to the waitlist. A verified listing URL replaces both. */
window.UYANBI_STORES = Object.freeze({ apple: '', google: '', waitlist: 'https://uyanbi.senkromind.com/#waitlist' });
window.UyanbiStores = (() => {
  const hosts = { apple: 'apps.apple.com', google: 'play.google.com' };
  const https = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url : null; } catch { return null; } };
  const listing = key => { const url = https(window.UYANBI_STORES[key]); return url && url.hostname === hosts[key] ? url.href : ''; };
  const waitlist = () => https(window.UYANBI_STORES.waitlist)?.href || '#';
  function bind(root = document) {
    root.querySelectorAll('[data-store]').forEach(link => {
      const key = link.dataset.store, live = key === 'waitlist' ? '' : listing(key);
      link.href = live || waitlist();
      link.target = '_blank';
      link.rel = live ? 'noopener noreferrer' : 'noopener';
      link.querySelectorAll('.soon').forEach(tag => { tag.hidden = !!live; });
      link.querySelectorAll('.store-live').forEach(tag => { tag.hidden = !live; });
    });
  }
  return { bind, listing, waitlist };
})();
