/* A quiet, non-modal coda: the balcony remains the main scene. */
(() => {
  const host = document.getElementById('morning-ending');
  let actions = {}, visit = 0;
  const apple = '<svg viewBox="0 0 24 28" aria-hidden="true"><path fill="currentColor" d="M19.7 14.8c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.7-2.4-4.5-2.4-1.9-.2-3.7 1.1-4.6 1.1s-2.4-1.1-4-1.1C7.1 7.9 5 9.1 3.9 11c-2.3 4-.6 10 1.6 13.2 1.1 1.5 2.3 3.2 4 3.1 1.6-.1 2.2-1 4.2-1s2.6 1 4.3.9c1.8 0 2.9-1.5 4-3.1 1.2-1.7 1.7-3.4 1.7-3.5-.1-.1-4-1.6-4-5.8ZM16.5 5.7c.9-1.1 1.5-2.7 1.3-4.2-1.3.1-2.9.9-3.9 2-.8.9-1.6 2.5-1.4 4 1.5.1 3-.7 4-1.8Z"/></svg>';
  const play = '<svg viewBox="0 0 28 31" aria-hidden="true"><path d="M1 1.5v28l14-14Z" fill="#59c8f8"/><path d="m1 1.5 17 10.2-4 3.8Z" fill="#69d291"/><path d="m1 29.5 17-10.2-4-3.8Z" fill="#f07186"/><path d="m18 11.7 8 4-8 3.6-4-3.8Z" fill="#ffd363"/></svg>';
  host.innerHTML = `<div class="ending-inner"><div class="ending-copy"><span class="ending-mark" aria-hidden="true">✳</span><h2 id="ending-title">Bu sabah senin.</h2><p>Yarın da Ponçik kapında olsun.</p><span id="ending-summary" class="ending-summary"></span></div><div class="ending-actions"><div class="ending-stores"><a href="#" data-end-store="apple" class="store-badge" aria-label="App Store’dan edinin">${apple}<span><small>App Store’dan</small><strong>Edinin</strong></span></a><a href="#" data-end-store="google" class="store-badge" aria-label="Google Play’den edinin">${play}<span><small>Google Play’den</small><strong>Edinin</strong></span></a></div><div class="ending-links"><button data-ending="games">Biraz daha kal</button><span aria-hidden="true">·</span><button data-ending="replay">Yeniden oyna</button><span aria-hidden="true">·</span><a href="intro.html">UyanBi’yi tanı</a></div><p id="ending-store-status" class="ending-store-status" role="status"></p></div></div><p class="visually-hidden" id="ending-announcement" role="status"></p>`;
  const stores = window.UYANBI_STORES || {};
  host.querySelectorAll('[data-end-store]').forEach(link => {
    const key = link.dataset.endStore;
    let valid = false;
    try {const url = new URL(stores[key]);valid = url.protocol === 'https:' && url.hostname === (key === 'apple' ? 'apps.apple.com' : 'play.google.com');} catch {}
    if(valid){link.href = stores[key];link.target = '_blank';link.rel = 'noopener noreferrer';}
    else link.addEventListener('click',event=>{event.preventDefault();document.getElementById('ending-store-status').textContent='Mağaza bağlantıları bu ön izlemede henüz bağlı değil.';});
  });
  host.addEventListener('click',event=>{const name=event.target.closest('[data-ending]')?.dataset.ending;if(name)actions[name]?.();});
  window.MorningEnding = {
    mount(callbacks){actions=callbacks;},
    show({seconds,steps}){const current=++visit;host.hidden=false;host.classList.remove('is-visible');document.getElementById('ending-summary').textContent=`${seconds} saniye · ${steps} adım · Güzel bir başlangıç.`;document.getElementById('ending-announcement').textContent='Günaydın, maceran tamamlandı. UyanBi’yi keşfedebilir veya biraz daha kalabilirsin.';requestAnimationFrame(()=>{if(current===visit)host.classList.add('is-visible');});},
    hide(){visit++;host.hidden=true;host.classList.remove('is-visible');document.getElementById('ending-store-status').textContent='';}
  };
})();
