(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let userReduced = false, active = null, chosenTime = '07:30', toastTimer;
  const reduced = () => userReduced || motionPreference.matches;
  const copy = [
    [['Beş dakika', 'daha mı?'], 'Ben Ponçik. Tatlıyım, kabul.<br>Ama sabahları biraz inatçıyım.'],
    [['Güneş gelsin.', 'Ben açarım.'], 'Perdeyi de, gözlerini de.<br>Yeni güne küçük bir hareket yeter.'],
    [['Saat senden.', 'Israr benden.'], 'Alarmını kur, gün ışığını rehin bırak.<br>Uyanırsan gün ışığın sana geri döner.'],
    [['Bir kupa bul.', 'Biraz da yürü.'], 'Bir kupa tara ya da mini oyun oyna.<br>Adımlarını tamamla, güne başla.'],
    [['Uyan.', 'Günün değişsin.'], 'Uyan, gün ışığını geri al.<br>Haftanın uyananları ödül havuzunu paylaşır.'],
    [['Yarın sabah', 'görüşürüz.'], 'Ponçik seni bekliyor.<br>UyanBi’yi indir, ilk alarmını kur.']
  ];
  const template = $('stage');
  const header = template.querySelector('header');
  header.querySelector('#skip').remove();
  document.body.prepend(header);
  template.querySelector('footer')?.remove();
  template.querySelector('.chapter')?.remove();
  template.querySelector('.edge-progress').remove();
  template.removeAttribute('role');
  const story = document.createElement('main'); template.before(story);
  const local = (section, name) => section.querySelector(`[data-local="${name}"]`);
  const sections = copy.map(([title, description], index) => {
    const section = template.cloneNode(true);
    section.id = index === 5 ? 'download' : `morning-${index}`;
    section.dataset.scene = index;
    section.dataset.theme = index >= 4 ? 'day' : 'night';
    section.setAttribute('aria-label', title.join(' '));
    section.querySelectorAll('[id]').forEach(node => { node.dataset.local = node.id; node.removeAttribute('id'); });
    local(section, 'headline').innerHTML = title.map(line => `<span class="title-line"><span>${line}</span></span>`).join('');
    local(section, 'description').innerHTML = description;
    for (const [name, visible] of [['copy-action',index === 0],['time-picker',index === 2],['task-demo',index === 3],['start',index === 4],['download-area',index === 5]]) local(section, name).hidden = !visible;
    section.style.setProperty('--dawn', index >= 4 ? 1 : 0);
    section.style.setProperty('--curtain', 0);
    section.querySelector('.window').style.opacity = index === 1 ? 1 : 0;
    section.querySelector('.pull-cord').style.opacity = index === 1 ? 1 : 0;
    if (index === 2) { section.querySelector('.poncik-front').style.opacity = 0; section.querySelector('.poncik-turn').style.opacity = 1; }
    section.querySelector('.alarm-prop').style.opacity = index === 2 ? 1 : 0;
    section.querySelector('.alarm-prop').setAttribute('aria-hidden', String(index !== 2));
    section.querySelector('.task-prop').style.opacity = index === 3 ? 1 : 0;
    section.querySelector('.sun-coins').style.opacity = index === 4 ? 1 : 0;
    section.querySelector('.morning-label').style.opacity = index === 4 ? 1 : 0;
    story.append(section);
    return section;
  });
  template.remove();
  const first = sections[0];
  const hint = document.createElement('span'); hint.className = 'flow-hint'; hint.textContent = 'Biraz aşağı. Ponçik bekliyor. ↓'; first.append(hint);
  const limit = document.createElement('p'); limit.className = 'flow-limit'; limit.textContent = 'Ödül havuzu için alarm en geç 08:30’a.'; local(sections[2], 'time-picker').append(limit);
  const example = document.createElement('p'); example.className = 'flow-example'; example.textContent = 'İnternet yoksa bir işlem çöz, sonra kelimeleri sırala. İki yolda da adımların sayılır.'; sections[3].append(example);
  document.querySelector('.skip-link').href = '#download'; document.querySelector('.skip-link').textContent = 'İndirme alanına geç';
  // Scrolling supplies direction only. The document travels for the same 900 ms.
  let travelling = false, wheelSum = 0, wheelAt = 0, wheelUsed = false, touch = null, suppressClick = false;
  function goTo(index) {
    if (travelling) return;
    index = Math.max(0, Math.min(sections.length - 1, index));
    const target = sections[index], from = scrollY;
    if (Math.abs(target.offsetTop - from) < 1) return;
    if (reduced()) { window.scrollTo(0, target.offsetTop); return; }
    travelling = true;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 900), smooth = t * t * (3 - 2 * t);
      window.scrollTo(0, from + (target.offsetTop - from) * smooth);
      if (t < 1) requestAnimationFrame(tick); else travelling = false;
    };
    requestAnimationFrame(tick);
  }
  const nearby = () => sections.reduce((best, section, index) => Math.abs(section.offsetTop - scrollY) < Math.abs(sections[best].offsetTop - scrollY) ? index : best, 0);
  window.addEventListener('wheel', event => {
    if ($('promise-dialog').open || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelAt > 220) { wheelSum = 0; wheelUsed = false; }
    wheelAt = now;
    if (travelling || wheelUsed) return;
    wheelSum += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (Math.abs(wheelSum) >= 36) { wheelUsed = true; goTo(nearby() + Math.sign(wheelSum)); }
  }, {passive:false});
  window.addEventListener('pointerdown', event => { if (event.pointerType === 'touch' || event.pointerType === 'pen') touch = {x:event.clientX,y:event.clientY}; }, {passive:true});
  window.addEventListener('pointerup', event => {
    if (!touch || $('promise-dialog').open) { touch = null; return; }
    const dx = event.clientX - touch.x, dy = event.clientY - touch.y; touch = null;
    if (Math.abs(dy) < 36 || Math.abs(dx) > Math.abs(dy)) return;
    suppressClick = true; setTimeout(() => suppressClick = false, 350);
    goTo(nearby() + (dy < 0 ? 1 : -1));
  }, {passive:true});
  window.addEventListener('pointercancel', () => touch = null);
  document.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); } }, true);
  document.addEventListener('keydown', event => {
    if ($('promise-dialog').open || event.target.closest('button,a,input,select,textarea') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['ArrowDown','PageDown',' '].includes(event.key)) { event.preventDefault(); goTo(nearby()+1); }
    if (['ArrowUp','PageUp'].includes(event.key)) { event.preventDefault(); goTo(nearby()-1); }
  });
  $('home').addEventListener('click', event => { event.preventDefault(); goTo(0); });
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); goTo(5); });
  const acting = section => section.dataset.scene === '1' ? 'pull' : section.dataset.scene === '5' ? 'greeting' : null;
  const cache = new Map();
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3500); }
  function say(section, message) { const speech = local(section, 'speech'); speech.textContent = message; speech.classList.add('show'); setTimeout(() => speech.classList.remove('show'), 3000); }
  function curtain(section) {
    cancelAnimationFrame(section.curtainFrame);
    const start = performance.now();
    const tick = time => {
      if (active !== section || reduced()) return;
      const t = Math.max(0, Math.min(1, (time - start - 1200) / 2680));
      const value = t * t * (3 - 2 * t);
      section.style.setProperty('--curtain', value); section.style.setProperty('--light', value);
      if (t < 1) section.curtainFrame = requestAnimationFrame(tick);
    };
    section.curtainFrame = requestAnimationFrame(tick);
  }
  async function act(section, name) {
    const actor = local(section, 'poncik'), image = local(section, 'poncik-motion');
    const visit = section.visit = (section.visit || 0) + 1;
    if (reduced() || !name) { actor.classList.remove('has-motion'); return; }
    const ready = () => {
      if (section.visit !== visit || active !== section || reduced()) return;
      actor.classList.add('has-motion');
      if (name === 'pull') curtain(section);
    };
    image.onload = ready; image.onerror = () => actor.classList.remove('has-motion');
    try {
      if (!cache.has(name)) cache.set(name, fetch(`assets/poncik-${name}.webp?v=5`).then(r => { if (!r.ok) throw new Error('Unavailable'); return r.blob(); }));
      const blob = await cache.get(name);
      if (section.visit !== visit || active !== section || reduced()) return;
      if (section.actorUrl) URL.revokeObjectURL(section.actorUrl);
      section.actorUrl = URL.createObjectURL(blob); image.src = section.actorUrl;
    } catch { cache.delete(name); if (section.visit === visit && active === section) image.src = `assets/poncik-${name}.webp?v=5#${visit}`; }
  }
  function activate(section) {
    if (active === section) return;
    if (active) {
      active.visit = (active.visit || 0) + 1;
      cancelAnimationFrame(active.curtainFrame);
      local(active, 'poncik').classList.remove('has-motion');
      local(active, 'poncik-motion').removeAttribute('src');
      if (active.actorUrl) { URL.revokeObjectURL(active.actorUrl); active.actorUrl = null; }
    }
    active = section;
    document.body.classList.toggle('day-header', Number(section.dataset.scene) >= 4);
    document.querySelector('meta[name="theme-color"]').content = Number(section.dataset.scene) >= 4 ? '#fff8e5' : '#43258a';
    act(section, acting(section));
    if (section.dataset.scene === '1' && reduced()) section.style.setProperty('--curtain', 1);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting && entry.intersectionRatio >= .55) activate(entry.target);
  }, { threshold: [.55, .75] });
  sections.forEach(section => observer.observe(section));
  function layout() {
    const mobile = innerWidth <= 700;
    const poses = [[0,0,-2,1],[mobile?55:95,mobile?40:75,13,.72],[0,0,0,1],[mobile?55:100,mobile?17:45,5,.78],[0,-7,0,.92],[mobile?8:25,mobile?-8:-14,-6,.86]];
    sections.forEach((section, index) => {
      const [x,y,angle,scale] = poses[index]; local(section, 'poncik').style.transform = `translate(${x}px,${y}px) rotate(${reduced()?0:angle}deg) scale(${scale})`;
    });
  }
  function updateMotion() {
    document.body.classList.toggle('motion-reduced', reduced());
    $('motion-toggle').setAttribute('aria-pressed', String(reduced())); $('motion-toggle').setAttribute('aria-label', reduced() ? 'Animasyonları aç' : 'Animasyonları azalt');
    sections.forEach(section => { if (reduced()) { local(section, 'poncik').classList.remove('has-motion'); cancelAnimationFrame(section.curtainFrame); if (section.dataset.scene === '1') section.style.setProperty('--curtain', 1); } });
    layout(); if (active) act(active, acting(active));
  }
  $('motion-toggle').addEventListener('click', () => { userReduced = !userReduced; updateMotion(); });
  motionPreference.addEventListener('change', updateMotion); window.addEventListener('resize', layout, {passive:true});
  local(first, 'snooze').addEventListener('click', () => { say(first, 'Beş dakika mı? Ben o numarayı biliyorum.'); act(first, 'refusal'); });
  sections.forEach(section => local(section, 'poncik').addEventListener('click', () => { say(section, 'Tatlıyım diye ertelemem. Anlaştık mı?'); act(section, acting(section)); }));
  sections[2].querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => {
    chosenTime = button.dataset.time; local(sections[2], 'alarm-display').textContent = chosenTime;
    sections[2].querySelectorAll('[data-time]').forEach(item => { item.setAttribute('aria-pressed', String(item === button)); item.classList.toggle('selected', item === button); });
    say(sections[2], `${chosenTime}’da görüşürüz. Ben hazırım.`);
  }));
  local(sections[3], 'task-demo').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    const dots = [...sections[3].querySelectorAll('.steps span')]; dots.forEach(dot => dot.classList.remove('done'));
    for (let i=0;i<dots.length;i++) { dots[i].classList.add('done'); button.textContent = `Adım adım… ${i+1} / ${dots.length}`; if (!reduced()) await new Promise(resolve => setTimeout(resolve, 420)); }
    sections[3].classList.add('task-complete'); button.textContent = 'Örneği yeniden oynat'; button.disabled = false;
    toast('Görev akışını gördün. Gerçek eşya ve adım kontrolü uygulamada.');
  });
  const dialog = $('promise-dialog');
  const openPromise = () => { $('promise-time').textContent = chosenTime; dialog.showModal(); };
  local(sections[4], 'start').addEventListener('click', openPromise); local(sections[5], 'download-promise').addEventListener('click', openPromise);
  $('close-dialog').addEventListener('click', () => dialog.close());
  $('confirm').addEventListener('click', () => { dialog.close(); goTo(5); toast('Sözünü aldım. Gerçek alarmını UyanBi’de kurmayı unutma. 💛'); });
  const stores = window.UYANBI_STORES || {};
  sections[5].querySelectorAll('[data-store]').forEach(link => {
    const key = link.dataset.store; let valid = false;
    try { const url = new URL(stores[key]); valid = url.protocol === 'https:' && url.hostname === (key === 'apple' ? 'apps.apple.com' : 'play.google.com'); } catch {}
    if (valid) { link.href = stores[key]; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else link.addEventListener('click', event => { event.preventDefault(); toast('Şimdilik bir ön izleme. Mağaza bağlantısı henüz eklenmedi.'); });
  });
  updateMotion(); document.body.classList.add('ready');
})();
