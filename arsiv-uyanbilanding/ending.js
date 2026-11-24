/* The ending. After a won game (computer) the balcony is closed like a stage: perde.js closes red curtains, Ponçik bows, the
   camera sinks and the stops layer (duraklar.js) settles from below; the phone never comes forward. Without the game
   (#hikaye typed in the address bar, phones) the stops layer simply opens (instant); "Uygulamayı dene" on a computer plays the same
   curtain from the welcome screen (curtainIn). The phone unit (rig) stays as the frame
   under the stops layer; its scroll placement (placeRig) is still used by that path. */
(() => {
  const $ = id => document.getElementById(id);
  const game = $('game'), rig = $('phone-rig'), phone = game.querySelector('.phone'), screen = phone.querySelector('.phone-screen');
  const nav = $('story-nav'), fade = $('game-fade'), screens = $('phone-story'), copy = $('ending-copy'), stores = $('scene-stores');
  const html = document.documentElement;
  const wide = () => matchMedia('(min-width: 1100px)').matches;
  let actions = {}, visit = 0, frame = 0;

  const announce = text => { const node = $('ending-announcement'); node.textContent = ''; setTimeout(() => { node.textContent = text; }, 80); };

  /* Scroll placement. Wide screens: nothing moves, the text columns pass on both sides.
     Narrow screens: over the first half screen of scrolling the unit shrinks towards the top (origin: its top
     edge, which stays under the buttons) and a band fades in behind it, so the text below never runs under Ponçik. */
  function placeRig() {
    if (!game.classList.contains('story')) { game.classList.remove('phone-small'); screen.inert = false; return; }
    let p = 0, scale = 1;
    // On a phone the unit is part of the first screen and scrolls away with it (phone.css): nothing to place.
    if (!wide() && html.classList.contains('story-on') && !html.classList.contains('is-phone')) {
      p = Math.min(1, Math.max(0, scrollY / (innerHeight * .5)));
      const h0 = rig.offsetHeight || 1, h1 = Math.min(h0, innerHeight * .53);
      scale = 1 + (h1 / h0 - 1) * p;
      html.style.setProperty('--band-h', `${Math.round(rig.offsetTop + h1 + 30)}px`); // solid to 12px under his feet, then an 18px fade
    }
    rig.style.setProperty('--sc', scale.toFixed(4));
    // A phone shrunk below 0.8 is a picture of the app (the store links are in the scene and the last section): no taps or focus inside it.
    const small = scale < .8;
    game.classList.toggle('phone-small', small); screen.inert = small;
    html.style.setProperty('--band', p.toFixed(3));
    // the scene's two cards fade as they scroll up, before they could pass under the corner buttons
    html.style.setProperty('--leave', html.classList.contains('is-phone') ? '0' : Math.min(1, Math.max(0, scrollY / (innerHeight * .3))).toFixed(3));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; placeRig(); }); }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);

  function layers(on) { [nav, fade, screens, copy, stores].forEach(node => { node.hidden = !on; }); }
  /* After a game the scene speaks to the winner; as an introduction (no game played: "Tanıtımı gör", #hikaye, phones)
     it uses the welcome screen's own lines. */
  const LINES = { won: ['Bu sabah senin', 'Yarın sabah da Ponçik yanında olsun'], intro: ['Bu sabahın kahramanı sensin', 'Sabahın bir hikâyesi var'] };
  function summary({ seconds, steps, preview }) {
    $('ending-summary').textContent = preview ? '' : `${seconds} saniyede ${steps} adım`;
    const [title, sub] = LINES[preview ? 'intro' : 'won'];
    $('ending-title').textContent = title;
    copy.querySelector('.ending-copy-title').textContent = title;
    copy.querySelector('.ending-copy-sub').textContent = sub;
  }
  function settle() {
    game.classList.add('story-ready');
    phone.inert = false;
    html.classList.add('story-on');
    window.UyanbiStory?.open();
    placeRig();
  }
  /* The curtain scene, one function for both ways in: after a won game (host: #game, Ponçik starts where the game's Ponçik stands)
     and from the welcome screen's "Uygulamayı dene" (host: #app, Ponçik starts where the welcome Ponçik stands; game.js passes
     `from`, and `prepare` to get the story's state ready at the moment the flight begins). The corner buttons are there from the
     first moment after a game (Yeniden oyna and Ana sayfa work during the flight); the stops layer opens when the curtain is shut
     (perde.js calls open) and rises into place under the camera. Resolves true when it settled, false when it was cancelled. */
  function curtain(token, { host = game, from, mark = true, prepare } = {}) {
    if (!window.UyanbiPerde) { prepare?.(); instant(); return Promise.resolve(false); }
    nav.hidden = false;
    return window.UyanbiPerde.play({
      host, from, mark,
      open() { if (token !== visit) return null; prepare?.(); instant(); return $('durak'); }
    });
  }
  function instant() {
    game.classList.add('story', 'handoff-on'); layers(true);
    settle();
  }
  function reset() {
    window.UyanbiPerde?.cancel();
    game.classList.remove('perde-on');
    rig.getAnimations().forEach(animation => animation.cancel());
    game.classList.remove('story', 'story-ready', 'handoff-on');
    layers(false);
    html.classList.remove('story-on'); html.style.removeProperty('--band'); html.style.removeProperty('--band-h'); html.style.removeProperty('--leave');
    rig.style.removeProperty('--sc');
    game.classList.remove('phone-small'); screen.inert = false;
    phone.inert = true;
    window.UyanbiStory?.close();
  }

  document.addEventListener('click', event => {
    const name = event.target.closest('[data-ending]')?.dataset.ending;
    if (name) actions[name]?.();
  });
  window.UyanbiStores?.bind(document);

  window.MorningEnding = {
    mount(callbacks) { actions = callbacks; },
    // preview: the ending without the game ("Tanıtımı gör" and #hikaye); it opens in its settled state.
    show({ seconds = 0, steps = 0, preview = false } = {}) {
      const token = ++visit;
      reset(); summary({ seconds, steps, preview });
      announce(preview ? 'UyanBi. Bir ışık yakarak kavanozu doldur.' : 'Maceran tamamlandı. Şimdi bir ışık yakarak kavanozu doldur.');
      if (preview) instant(); else curtain(token);
    },
    // The same curtain scene started from the welcome screen: { host, from, prepare } as in curtain(); returns its promise.
    curtainIn({ host, from, prepare } = {}) {
      const token = ++visit;
      reset(); summary({ preview: true });
      announce('UyanBi. Bir ışık yakarak kavanozu doldur.');
      return curtain(token, { host, from, mark: false, prepare });
    },
    hide() {
      visit++; reset();
      if (scrollY) scrollTo({ top: 0, behavior: 'instant' });
    }
  };
})();
