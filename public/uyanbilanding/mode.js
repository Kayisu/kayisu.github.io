/* Phone or computer. On a phone (UYANBI_PHONE_QUERY, set in the head) the page is the scrolling introduction only:
   the game's scripts and pictures are never fetched. On a computer the game scripts load as before. The mode only
   changes while the visitor is on the welcome screen or in the story, never in the middle of a game. */
(() => {
  const html = document.documentElement, query = matchMedia(window.UYANBI_PHONE_QUERY);
  const game = document.getElementById('game'), welcome = document.getElementById('welcome');
  const GAME = ['rooms.js', 'actor.js', 'scene.js', 'phone-games.js', 'game.js'], V = '?v=41';
  let loading = null, phone = query.matches;

  function loadGame() {
    if (loading) return loading;
    loading = new Promise(resolve => {
      GAME.forEach((file, i) => {
        const script = document.createElement('script');
        script.src = file + V; script.async = false; // in order, like the plain script tags they replace
        if (i === GAME.length - 1) script.onload = resolve;
        document.body.appendChild(script);
      });
    });
    return loading;
  }
  // The page opens on the introduction's first screen, also when the address carries #hikaye.
  function holdTop() {
    history.scrollRestoration = 'manual';
    const top = () => scrollTo(0, 0);
    requestAnimationFrame(top);
    if (document.readyState === 'complete') return;
    const release = () => { removeEventListener('scroll', top); ['wheel', 'touchstart', 'keydown'].forEach(type => removeEventListener(type, release)); };
    addEventListener('scroll', top);
    ['wheel', 'touchstart', 'keydown'].forEach(type => addEventListener(type, release, { once: true }));
    addEventListener('load', () => { top(); requestAnimationFrame(() => { top(); release(); }); }, { once: true });
  }
  function enterIntro() {
    welcome.hidden = true; game.hidden = false;
    game.classList.add('epilogue');
    if (window.UyanbiGame) { window.UyanbiGame.enterStory(); return; }
    window.MorningEnding.mount({ home: () => scrollTo({ top: 0, behavior: 'smooth' }), replay() {}, games() {} });
    window.MorningEnding.show({ preview: true });
    holdTop();
  }
  const state = () => window.UyanbiGame ? window.UyanbiGame.state() : 'story';

  html.classList.toggle('is-phone', phone);
  if (phone) enterIntro(); else loadGame();

  function change() {
    const next = query.matches;
    if (next === phone || state() === 'play') return;
    phone = next;
    html.classList.toggle('is-phone', phone);
    if (phone) { if (state() !== 'story') enterIntro(); return; } // already in the story: only the layout changes
    if (window.UyanbiGame) return; // the game is here already: the story simply goes on with the computer layout
    // First time on a computer layout: the story continues there (game.js opens #hikaye in its story state).
    history.replaceState(null, '', location.pathname + location.search + '#hikaye');
    window.MorningEnding.hide();
    loadGame();
  }
  query.addEventListener('change', change);
})();
