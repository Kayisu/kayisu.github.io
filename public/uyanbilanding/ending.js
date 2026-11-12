/* The ending: Ponçik, hugging the phone, comes forward from the balcony to the middle of the screen and stays
   there (fixed) while the page scrolls on into the story. Ponçik, the live phone and his hands in front of it
   are one box (#phone-rig); it moves with transform and opacity only. */
(() => {
  const $ = id => document.getElementById(id);
  const game = $('game'), rig = $('phone-rig'), phone = game.querySelector('.phone'), screen = phone.querySelector('.phone-screen');
  const nav = $('story-nav'), fade = $('game-fade'), screens = $('phone-story'), copy = $('ending-copy'), stores = $('scene-stores');
  const back = $('hug-back'), hands = $('hug-hands');
  const html = document.documentElement;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = () => matchMedia('(min-width: 1100px)').matches;
  // A damped spring (about 4% overshoot), sampled; older engines get a plain overshooting curve.
  const SPRING = CSS.supports?.('transition-timing-function', 'linear(0, 1)')
    ? 'linear(0, .048, .163, .309, .46, .602, .724, .824, .901, .958, .996, 1.02, 1.033, 1.038, 1.038, 1.034, 1.029, 1.023, 1.017, 1.012, 1.008, 1.005, 1.002, 1.001, 1)'
    : 'cubic-bezier(.3,1.2,.5,1)';
  let actions = {}, visit = 0, timers = [], frame = 0;

  // Ponçik behind the phone, his hands in front of it: both ride inside the rig, so the three move as one.
  rig.prepend(back); rig.append(hands);

  const wait = ms => new Promise(resolve => timers.push(setTimeout(resolve, ms)));
  const announce = text => { const node = $('ending-announcement'); node.textContent = ''; setTimeout(() => { node.textContent = text; }, 80); };
  const decoded = img => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); }))
    .then(() => img.decode?.()).catch(() => {});

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
  const LINES = { won: ['Bu sabah senin.', 'Yarın sabah da Ponçik yanında olsun.'], intro: ['Bu sabahın kahramanı sensin.', 'Sabahın bir hikâyesi var.'] };
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
  /* Where Ponçik stands on the balcony: the unit starts there, his size, and grows into the middle. */
  function startBox() {
    const actor = $('poncik-actor'), box = actor?.getBoundingClientRect();
    if (!box || box.width < 8 || box.height < 8) return null;
    return box;
  }
  async function deliver(token) {
    phone.inert = true;
    // Ponçik never appears half-painted: wait for both layers. Until then the balcony stays as it is.
    await Promise.race([Promise.all([decoded(back), decoded(hands)]), wait(4000)]);
    if (token !== visit) return;
    // One frame: the standing Ponçik is measured, then the hugging one takes his place and size and comes forward.
    const from = startBox();
    game.classList.add('story', 'handoff-on'); layers(true);
    rig.getAnimations().forEach(animation => animation.cancel());
    placeRig();
    const to = rig.getBoundingClientRect();
    if (reduced() || !from || !to.height) {
      await rig.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 300 : 450, easing: 'linear' }).finished.catch(() => {});
    } else {
      const k = Math.min(.8, Math.max(.2, from.height / to.height));
      const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const move = rig.animate([
        { translate: `${dx.toFixed(1)}px ${dy.toFixed(1)}px`, scale: String(k), transformOrigin: '50% 50%' },
        { translate: '0px 0px', scale: '1', transformOrigin: '50% 50%' }
      ], { duration: 900, easing: SPRING });
      const show = rig.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      await Promise.all([move.finished, show.finished]).catch(() => {});
    }
    if (token !== visit) return;
    settle();
    $('ending-title').focus({ preventScroll: true });
  }
  function instant() {
    game.classList.add('story', 'handoff-on'); layers(true);
    settle();
  }
  function reset() {
    timers.forEach(clearTimeout); timers = [];
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
  $('story-scroll').addEventListener('click', event => {
    event.preventDefault();
    $('hikaye')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
  });
  window.UyanbiStores?.bind(document);

  window.MorningEnding = {
    mount(callbacks) { actions = callbacks; },
    // preview: the ending without the game ("Tanıtımı gör" and #hikaye); it opens in its settled state.
    show({ seconds = 0, steps = 0, preview = false } = {}) {
      const token = ++visit;
      reset(); summary({ seconds, steps, preview });
      announce(preview ? 'UyanBi tanıtımı. Aşağı kaydırarak devam edebilirsin.' : 'Maceran tamamlandı. Telefon sende. Aşağı kaydırarak UyanBi’yi keşfedebilirsin.');
      if (preview) instant(); else deliver(token);
    },
    hide() {
      visit++; reset();
      if (scrollY) scrollTo({ top: 0, behavior: 'instant' });
    }
  };
})();
