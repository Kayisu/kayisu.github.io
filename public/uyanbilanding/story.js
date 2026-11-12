/* The story below the ending: it decides which phone screen is showing, reveals blocks once as they
   arrive and lets go of the fixed unit when the download section begins. Nothing here counts or loops. */
(() => {
  const $ = id => document.getElementById(id);
  const html = document.documentElement, game = $('game'), story = $('hikaye');
  const phone = game.querySelector('.phone');
  const screens = [...document.querySelectorAll('#phone-story .ps')];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = () => matchMedia('(min-width: 1100px)').matches;
  let current = 'end', ioScreen = null, ioReveal = null, ioOut = null, opened = false;

  function setScreen(name, force = false) {
    if (name === current && !force) return;
    current = name;
    // Should the arcade still be open, scrolling on returns the phone to the story screens.
    if (name !== 'end' && game.classList.contains('phone-game-mode')) { window.PhoneGames?.close(); game.classList.remove('phone-game-mode', 'relaxing'); }
    screens.forEach(screen => { const on = screen.dataset.screen === name; screen.classList.toggle('is-active', on); screen.inert = !on; });
    game.classList.toggle('story-night', name === 'b1');
  }
  function observeScreens() {
    ioScreen?.disconnect();
    // A thin reading line: through the middle on wide screens, in the text area under the pinned unit on narrow ones.
    ioScreen = new IntersectionObserver(entries => {
      const hit = entries.filter(entry => entry.isIntersecting).pop();
      if (hit) setScreen(hit.target.dataset.ps);
    }, { rootMargin: wide() ? '-47% 0px -47% 0px' : '-62% 0px -33% 0px' });
    document.querySelectorAll('[data-ps]').forEach(node => ioScreen.observe(node));
  }
  function observeReveal() {
    ioReveal?.disconnect();
    story.querySelectorAll('.rv').forEach(node => {
      const siblings = [...node.parentElement.children].filter(child => child.classList.contains('rv'));
      node.style.setProperty('--i', Math.min(5, siblings.indexOf(node)));
    });
    ioReveal = new IntersectionObserver(entries => entries.forEach(entry => {
      // Blocks already scrolled past (jumps, "Kaydır") must not stay hidden.
      if (entry.isIntersecting || entry.boundingClientRect.top < 0) { entry.target.classList.add('in'); ioReveal.unobserve(entry.target); }
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    story.querySelectorAll('.rv').forEach(node => ioReveal.observe(node));
  }
  function observeOut() {
    ioOut?.disconnect();
    // The unit leaves as soon as the download section's top edge shows, long before its text arrives.
    ioOut = new IntersectionObserver(([entry]) => {
      const out = entry.isIntersecting || entry.boundingClientRect.top < 0;
      game.classList.toggle('story-out', out);
      phone.inert = out;
    }, { rootMargin: '0px 0px -8% 0px' });
    ioOut.observe($('b6'));
  }
  function start() { observeScreens(); observeReveal(); observeOut(); }

  let resizing = 0;
  addEventListener('resize', () => { if (!opened) return; clearTimeout(resizing); resizing = setTimeout(observeScreens, 150); });

  window.UyanbiStory = {
    open() {
      if (opened) return;
      opened = true; story.hidden = false; html.classList.add('story-js');
      // The camera picture of the mock-up is the decoded kitchen painting, not a CSS url that paints progressively.
      window.RoomArt?.load('kitchen').then(url => game.style.setProperty('--m-cam-img', `url(${url})`));
      setScreen('end', true); start();
    },
    close() {
      opened = false;
      [ioScreen, ioReveal, ioOut].forEach(observer => observer?.disconnect());
      story.hidden = true; html.classList.remove('story-js');
      game.classList.remove('story-out', 'story-night');
      story.querySelectorAll('.rv.in').forEach(node => node.classList.remove('in'));
      phone.inert = true;
      setScreen('end', true);
    }
  };
})();
