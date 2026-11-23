/* Duraklar: after the balcony the page stops at full-screen, single-purpose "stops" (a fixed layer over the phone):
     jar -> Ayın Şampiyonu -> app -> Ponçik collection -> Sesini bırak -> waitlist, then the hub.
   First time through they follow one another; once the last is done the visitor reaches the hub (Ponçik on his island,
   a door to every stop) and from there goes where he likes; a finished stop returns to the hub.
   ending.js calls window.UyanbiStory.open() once the phone has come forward, and .close() on every reset.
   A move between stops is a soft cross-fade: the old view fades out in 180 ms, the new one rises from 12 px below
   in 240 ms (opacity only under prefers-reduced-motion); a second click while the change is running is ignored.
   Everything that moves does so with transform and opacity only. Nothing typed here ever leaves the page. */
(() => {
  const html = document.documentElement;
  const game = document.getElementById('game');
  const MAX = 7;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => html.classList.contains('is-phone');

  const STOPS = [
    { id: 'jar', name: 'Işık kavanozu', sub: 'Kavanozu 7 ışıkla doldur' },
    { id: 'champ', name: 'Ayın Şampiyonu', sub: 'Küçük bir sır' },
    { id: 'app', name: 'Uygulamayı gör', sub: 'Gerçek ekranlar' },
    { id: 'coll', name: 'Ponçik koleksiyonu', sub: 'Kartlar ve maketler' },
    { id: 'voice', name: 'Sesini bırak', sub: 'Bir günaydın bırak' },
    { id: 'pre', name: 'Ön kayıt', sub: 'Ön kayıt ve sorular' }
  ];
  const ICON = {
    jar: '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-sun"/></svg>',
    champ: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>',
    app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg>',
    coll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="11" height="15" rx="2.5" transform="rotate(-8 8.5 13.5)"/><rect x="10" y="3" width="11" height="15" rx="2.5" transform="rotate(8 15.5 10.5)"/></svg>',
    voice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/></svg>',
    pre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.5L4.5 16h15L18 12.5V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0"/></svg>'
  };
  const idx = id => STOPS.findIndex(s => s.id === id);

  let root = null, viewEl = null, cur = '', S = null, timers = [], vtimers = [], observer = null, fitFrame = 0, navigating = false, flights = [], buddyName = '';

  const after = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const vafter = (fn, ms) => { const t = setTimeout(fn, ms); vtimers.push(t); return t; };
  const q = sel => viewEl && viewEl.querySelector(sel);
  const ponSrc = name => 'assets/poncik/' + name + (reduced() ? '-still' : '') + '.webp';
  const fresh = () => ({
    hub: false, done: {}, seen: {},
    jar: { n: 0, landed: 0 },
    champ: { open: false },
    app: { shot: 0, viewed: [true, false, false, false], video: false },
    coll: { flipped: [false, false, false], merch: 0, touched: false },
    voice: { stars: [], k: 0 }
  });

  /* ---------- pieces shared by the views ---------- */
  const CAVEAT_FULL = 'Bu deneyim semboliktir. Gerçek uygulama bakiyesi, ödül veya para değildir.';
  const CAVEAT_PHONE = 'Bu deneyim semboliktir; gerçek uygulama bakiyesi değildir.';
  const nextLabel = () => S.hub ? '‹ Merkeze dön' : (idx(cur) < STOPS.length - 1 ? `Sıradaki: ${STOPS[idx(cur) + 1].name} ›` : 'Merkeze geç ›');
  const nextBtn = ghost => `<button type="button" class="dk-btn dk-next${ghost ? ' is-ghost' : ''}" data-dk="next" hidden>${nextLabel()}</button>`;
  const skipBtn = () => S.hub ? '' : '<button type="button" class="dk-skip" data-dk="skip">Atla ›</button>';
  const frame = ({ id, cls = '', eyebrow, title, lead, stage, act }) => `<div class="dk-wrap dk-${id}v ${cls}" data-v="${id}">
    <div class="dk-text"><span class="dk-eyebrow">${eyebrow}</span><h2 class="dk-title" id="dk-title" tabindex="-1">${title}</h2><p class="dk-lead" id="dk-lead">${lead}</p></div>
    <div class="dk-stage-row">${stage}</div>
    <div class="dk-act">${act}</div>
  </div>`;
  const storeRow = () => `<div class="store-row"><a class="store-btn" data-store="apple" href="#"><svg viewBox="0 0 24 28" aria-hidden="true"><use href="#i-apple"/></svg><span class="store-txt"><small class="soon">Çok yakında</small><small class="store-live" hidden>İndirin</small><strong>App Store</strong></span></a><a class="store-btn" data-store="google" href="#"><svg viewBox="0 0 28 31" aria-hidden="true"><use href="#i-play"/></svg><span class="store-txt"><small class="soon">Çok yakında</small><small class="store-live" hidden>İndirin</small><strong>Google Play</strong></span></a></div>`;
  const wrap = () => q('.dk-wrap');

  function swapText(el, text) {
    if (!el || el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('dk-swap'); void el.offsetWidth; el.classList.add('dk-swap');
  }
  function setPon(img, name, instant) {
    if (!img) return;
    if (img.dataset.pon === name) return;
    const first = !img.dataset.pon;
    img.dataset.pon = name;
    const src = ponSrc(name);
    if (instant || first || reduced()) { img.src = src; return; }
    img.classList.add('is-fading');
    vafter(() => { img.src = src; img.classList.remove('is-fading'); }, 170);
  }
  function say(text, pose) {
    const el = q('#dk-say'); if (el) el.textContent = text;
    if (pose) setPon(q('.dk-pon[data-main]'), pose);
  }
  /* the stop's job is done: the way on appears (and takes the keyboard focus) */
  function done(id, quiet) {
    S.done[id] = true;
    if (cur !== id) return;
    const w = wrap(); if (!w) return;
    const first = !w.classList.contains('is-done');
    w.classList.add('is-done');
    const next = q('[data-dk="next"]'); if (next) next.hidden = false;
    updateBar();
    if (first && !quiet && next) next.focus({ preventScroll: true });
  }

  /* ================= 1. the jar ================= */
  const JAR = `<div class="dk-fit"><div class="dk-stage">
    <div class="dk-superglow"></div><div class="dk-lid"></div><div class="dk-neck"></div>
    <div class="dk-glass"><div class="dk-beam"></div><div class="dk-liquid"></div><div class="dk-sparks"></div><span class="dk-label">uyanbi!<small>GÜN IŞIĞI</small></span></div>
    <div class="dk-counter" aria-hidden="true"><b>0</b><span>/ 7 IŞIK</span></div>
  </div></div>`;
  // how full the glass is (percent of its height, 82 = brim) at each light: every step shows
  const LEVEL = [0, 12, 24, 36, 48, 60, 71, 82];
  const JAR_TITLE = ['Her sabah biraz ışık topla', 'Uyandıkça biriken ışık, uygulamada seni bekliyor'];
  const JAR_LEAD = ['Uyandıkça Gün Işığı birikir. Dokun; ışık kavanozdan telefona uçsun.', 'Gerçek uygulamada Gün Işıklarını bu ekrandan takip edersin.'];
  // one line and one pose for every count, 0 to 7
  const JAR_SAY = [
    ['uykulu', 'Kavanoz bomboş. Bir ışık yak, ben de uyanayım.'], ['mutlu', 'Bir! İlk ışık telefona uçtu.'],
    ['saat', 'İki. Erken kalkana bol ışık.'], ['coin', 'Üç ışık. Cıngırdamaya başladı.'],
    ['kumbara', 'Dört! Yolun yarısı geçti.'], ['arastirmaci', 'Beş. Telefondaki sayı da büyüyor, bak.'],
    ['el-sallama', 'Altı! Son bir ışık kaldı.'], ['tamam', 'Yedi! Kavanoz tam dolu.']
  ];
  const SCREEN_GUNISIGI = (id, src, alt) => `<div class="dk-shot" ${id}><img src="${src}" alt="${alt}" width="540" height="1170" decoding="async"><span class="dk-bal" aria-hidden="true"><b id="dk-bal">0</b></span></div>`;

  function jarView() {
    return frame({
      id: 'jar', eyebrow: 'Gün Işığı', title: JAR_TITLE[0], lead: JAR_LEAD[0],
      stage: `<div class="dk-jarrow">
        <div class="dk-left">
          <div class="dk-buddy"><p class="dk-say" id="dk-say" role="status" aria-live="polite"></p><img class="dk-pon" data-main id="dk-buddy-img" alt="" width="360" height="330" decoding="async"></div>
          <div class="dk-jarbox dk-box">${JAR}</div>
        </div>
        <div class="dk-right"><div class="dk-phone" id="dk-phone">
          <div class="dk-badge" id="dk-badge" aria-live="polite"><span aria-hidden="true">☀</span> Gün Işığı <b id="dk-badge-n">0</b></div>
          ${SCREEN_GUNISIGI('', 'assets/v3/app-gunisigi.webp', 'UyanBi uygulamasında Kazandığın Gün Işıkları ekranı')}
        </div></div>
      </div>`,
      act: `<div class="dk-act-row"><button type="button" class="dk-btn dk-do dk-do-once" id="dk-plus">+ Bir ışık yak</button>${nextBtn()}${skipBtn()}</div>
        <p class="dk-hint" id="dk-hint"></p><p class="dk-caveat">${isPhone() ? CAVEAT_PHONE : CAVEAT_FULL}</p>`
    });
  }
  function paintJar(from) {
    const j = S.jar, n = j.n;
    q('.dk-counter b').textContent = n;
    q('.dk-liquid').style.transform = `scaleY(${n ? (LEVEL[n] / 82).toFixed(4) : '.02'})`;
    wrap().style.setProperty('--lv', (n / MAX).toFixed(3));
    const wrapEl = q('.dk-sparks');
    for (let i = from * 6; i < n * 6; i++) {
      const part = document.createElement('i');
      const x = 10 + ((i * 41 + 17) % 80), y = 25 + ((i * 17 + 13) % 67), s = 5 + i % 5;
      part.style.cssText = `left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:0s,${((i % 9) * -.28).toFixed(2)}s`;
      wrapEl.append(part);
    }
    q('#dk-hint').textContent = n >= MAX ? '7 / 7 ışık yakıldı' : `${n} / 7 ışık yakıldı`;
    say(JAR_SAY[n][1], JAR_SAY[n][0]);
  }
  function paintPhone(pop) {
    const l = S.jar.landed;
    q('#dk-badge-n').textContent = l; q('#dk-bal').textContent = l;
    if (!pop) return;
    const badge = q('#dk-badge'), bal = q('#dk-bal');
    badge.classList.remove('is-pop'); void badge.offsetWidth; badge.classList.add('is-pop');
    bal.classList.remove('is-pop'); void bal.offsetWidth; bal.classList.add('is-pop');
  }
  function fly() {
    const from = q('.dk-glass').getBoundingClientRect(), to = q('#dk-badge').getBoundingClientRect(), base = root.getBoundingClientRect();
    const sx = from.left + from.width / 2 - base.left, sy = from.top + from.height * .45 - base.top;
    const ex = to.left + to.width / 2 - base.left, ey = to.top + to.height / 2 - base.top;
    const spark = document.createElement('i');
    spark.className = 'dk-fly';
    root.append(spark);
    const mx = (sx + ex) / 2, my = Math.min(sy, ey) - Math.max(30, Math.abs(ex - sx) * .08);
    const move = spark.animate([
      { transform: `translate(${sx}px,${sy}px) scale(.6)`, opacity: 0 },
      { transform: `translate(${sx + (mx - sx) * .25}px,${sy - 30}px) scale(1.3)`, opacity: 1, offset: .15 },
      { transform: `translate(${mx}px,${my}px) scale(1.15)`, opacity: 1, offset: .55 },
      { transform: `translate(${ex}px,${ey}px) scale(.7)`, opacity: .9 }
    ], { duration: 950, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
    flights.push(move);
    move.finished.then(() => { spark.remove(); flights = flights.filter(f => f !== move); land(); }).catch(() => spark.remove());
  }
  function land() {
    if (!S) return;
    S.jar.landed++;
    if (cur === 'jar' && viewEl) {
      paintPhone(true);
      if (S.jar.landed >= MAX) jarFinish(false);
    } else if (S.jar.landed >= MAX) S.done.jar = true;
  }
  function jarFinish(quiet) {
    swapText(q('#dk-title'), JAR_TITLE[1]); swapText(q('#dk-lead'), JAR_LEAD[1]);
    q('#dk-plus').disabled = true;
    done('jar', quiet);
  }
  function jarLight() {
    const j = S.jar;
    if (j.n >= MAX) return;
    window.UyanbiSfx?.play('isik');
    const from = j.n; j.n++;
    paintJar(from);
    if (j.n >= MAX) q('#dk-plus').disabled = true;
    if (reduced()) land(); else fly();
  }
  function jarMount() {
    const j = S.jar;
    q('#dk-plus').addEventListener('click', jarLight);
    paintJar(0); paintPhone(false);
    if (j.landed >= MAX) { wrap().classList.add('is-done'); q('#dk-title').textContent = JAR_TITLE[1]; q('#dk-lead').textContent = JAR_LEAD[1]; q('#dk-plus').disabled = true; done('jar', true); }
  }
  /* the jar stage is a 620 x 600 design scaled into whatever box the layout gives it; the glass and lid are cropped to the jar */
  function fit() {
    fitFrame = 0;
    if (!root || cur !== 'jar') return;
    const box = q('.dk-box'), el = q('.dk-fit'), stage = q('.dk-stage'); if (!box || !el) return;
    const c = { x: 140, y: 60, w: 340, h: 530 };
    const aw = box.clientWidth, ah = box.clientHeight;
    const k = Math.max(.25, Math.min(aw / c.w, ah / c.h, 1.2));
    el.style.width = (c.w * k).toFixed(1) + 'px'; el.style.height = (c.h * k).toFixed(1) + 'px';
    el.style.left = ((aw - c.w * k) / 2).toFixed(1) + 'px'; el.style.top = ((ah - c.h * k) / 2).toFixed(1) + 'px';
    stage.style.transform = `translate(${(-c.x * k).toFixed(1)}px,${(-c.y * k).toFixed(1)}px) scale(${k.toFixed(4)})`;
  }
  const refit = () => { if (!fitFrame) fitFrame = requestAnimationFrame(fit); };

  /* ================= 2. Ayın Şampiyonu ================= */
  function champView() {
    return frame({
      id: 'champ', eyebrow: 'Ayın Şampiyonu', title: 'Küçük bir sır var',
      lead: 'Ayın Şampiyonu için özel koleksiyon hediyeleri olacak. Ne olduklarını şimdilik saklıyoruz.',
      stage: `<div class="dk-chestrow">
        <div class="dk-buddy-side"><p class="dk-say" id="dk-say" role="status" aria-live="polite"></p><img class="dk-pon" data-main alt="" width="360" height="354" decoding="async"></div>
        <div class="dk-chestcol"><button type="button" class="dk-chest" id="dk-chest" aria-label="Sandığı aç"><span class="dk-chest-glow"></span><span class="dk-chest-body"></span><span class="dk-chest-lid"></span><span class="dk-gift" aria-hidden="true"><small>✦ Ayın Şampiyonu ✦</small><strong>Özel koleksiyon hediyeleri</strong><span>İçerik şimdilik sürpriz</span></span></button></div>
      </div>`,
      act: `<div class="dk-act-row"><button type="button" class="dk-btn dk-do dk-do-once" id="dk-open">Sandığı aç</button>${nextBtn()}${skipBtn()}</div><p class="dk-hint" id="dk-hint"></p>`
    });
  }
  function champOpen(quiet) {
    const c = S.champ; c.open = true;
    if (!quiet) window.UyanbiSfx?.play('sandik');
    wrap().classList.add('is-chest-open');
    const chest = q('#dk-chest'); chest.disabled = true; chest.setAttribute('aria-label', 'Sandık açık: özel koleksiyon hediyeleri, içerik şimdilik sürpriz');
    q('#dk-hint').textContent = 'Sandık açıldı: özel koleksiyon hediyeleri. İçerik şimdilik sürpriz.';
    say('Sırrı sakla, olur mu?', 'mutlu');
    done('champ', quiet);
  }
  function champMount() {
    say('Dokun, sandığı açalım!', 'el-sallama');
    q('#dk-hint').textContent = 'Sandığa dokun.';
    q('#dk-chest').addEventListener('click', () => champOpen(false));
    q('#dk-open').addEventListener('click', () => champOpen(false));
    if (S.champ.open) { champOpen(true); }
  }

  /* ================= 3. the app ================= */
  const ALL_SHOTS = [
    { src: 'assets/v3/app-ana.webp', alt: 'UyanBi uygulamasının ana ekranı: kurulu alarm, hafta şeridi ve günlük seri', name: 'Ana ekran', cap: 'Kurduğun alarmlar, haftan ve günlük serin tek sayfada.' },
    { src: 'assets/v3/app-alarm-kur.webp', alt: 'UyanBi uygulamasında Alarm Oluştur ekranı: saat, alarm sesi ve görev seçimi', name: 'Alarm kur', cap: 'Saati seç, görevini belirle: soru çöz ya da etrafındaki bir nesneyi tara.' },
    { src: 'assets/v3/app-kumbara.webp', alt: 'UyanBi uygulamasında Kumbara ekranı: kalan meydan okuma hakları ve hareketler', name: 'Kumbara', cap: 'Kalan meydan okuma hakların ve kazandığın sabahlar burada.' },
    { src: 'assets/v3/app-kadran.webp', alt: 'UyanBi uygulamasında 24 saatlik kadranla alarm saati seçimi', name: 'Saat kadranı', cap: 'Alarmı 24 saatlik kadranla da kurabilirsin; 05:00 ile 08:00 arası ödül kazandırır.' }
  ];
  const shots = () => ALL_SHOTS;
  function appView() {
    const a = S.app;
    if (a.shot >= shots().length) a.shot = 0;
    const s = shots()[a.shot];
    return frame({
      id: 'app', cls: 'dk-split', eyebrow: 'Uygulamayı gör', title: 'Gerçek ekranlar, gerçek uygulama',
      lead: 'Ekranları sırayla gez ya da 35 saniyelik ekran kaydını izle.',
      stage: `<div class="dk-approw"><div class="dk-phone"><div class="dk-shot" id="dk-shot"><img id="dk-shot-img" src="${s.src}" alt="${s.alt}" width="540" height="1170" decoding="async"></div><img class="dk-pon" data-main alt="" width="360" height="354" decoding="async"></div></div>`,
      act: `<p class="dk-cap" id="dk-cap" role="status" aria-live="polite"><span><b id="dk-cap-name"></b><span id="dk-cap-text"></span></span></p>
        <ol class="dk-shotdots" id="dk-shotdots" aria-hidden="true">${shots().map(() => '<li></li>').join('')}</ol>
        <div class="dk-act-row"><button type="button" class="dk-btn dk-do" id="dk-nextshot">Sıradaki ekran ›</button><button type="button" class="dk-btn is-ghost" id="dk-film" aria-pressed="false">▶ Ekran kaydını izle</button></div>
        <div class="dk-act-row">${nextBtn()}${skipBtn()}</div>`
    });
  }
  function appPaint(fade) {
    const a = S.app, s = shots()[a.shot];
    q('#dk-cap-name').textContent = `${a.shot + 1} / ${shots().length} · ${s.name}`;
    q('#dk-cap-text').textContent = s.cap;
    [...q('#dk-shotdots').children].forEach((li, i) => li.classList.toggle('is-cur', i === a.shot));
    const img = q('#dk-shot-img');
    if (!img) return;
    const swap = () => { img.src = s.src; img.alt = s.alt; img.classList.remove('is-fading'); };
    if (fade && !reduced()) { img.classList.add('is-fading'); vafter(swap, 200); } else swap();
  }
  function appFilm(on) {
    const a = S.app; a.video = on;
    const shot = q('#dk-shot'), btn = q('#dk-film');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? '‹ Ekranlara dön' : '▶ Ekran kaydını izle';
    q('#dk-nextshot').disabled = on;
    if (on) {
      shot.innerHTML = '<video id="dk-video" controls playsinline preload="none" poster="assets/v3/uygulama-akisi-poster.webp" src="assets/v3/uygulama-akisi.mp4" aria-label="UyanBi uygulamasının 35 saniyelik ekran kaydı: alarm kurma, bildirimler, Kumbara ve özelleştirme"></video>';
      const v = q('#dk-video');
      v.addEventListener('play', () => done('app'), { once: true });
      v.play().catch(() => {});
      q('#dk-cap-name').textContent = 'Ekran kaydı · 35 saniye';
      q('#dk-cap-text').textContent = 'Alarm kurmaktan Kumbara ve özelleştirmeye, uygulamada bir tur.';
    } else {
      shot.innerHTML = `<img id="dk-shot-img" src="${shots()[a.shot].src}" alt="${shots()[a.shot].alt}" width="540" height="1170" decoding="async">`;
      appPaint(false);
    }
  }
  function appMount() {
    const a = S.app;
    setPon(q('.dk-pon[data-main]'), 'arastirmaci', true);
    shots().forEach(s => { const i = new Image(); i.src = s.src; });
    appPaint(false);
    q('#dk-nextshot').addEventListener('click', () => {
      window.UyanbiSfx?.play('ekran');
      a.shot = (a.shot + 1) % shots().length; a.viewed[a.shot] = true;
      appPaint(true);
      if (a.viewed.slice(0, shots().length).every(Boolean)) done('app');
    });
    q('#dk-film').addEventListener('click', () => appFilm(!a.video));
    if (a.viewed.slice(0, shots().length).every(Boolean)) done('app', true);
  }

  /* ================= 4. Ponçik collection ================= */
  const CARDS = [
    { src: 'assets/v3/card-isik.webp', name: 'Işık Bahçesi', line: 'Biraz ışık eker, kocaman neşe biçer' },
    { src: 'assets/v3/card-zaman.webp', name: 'Zaman Sörfü', line: 'Zamanın dalgasında, sabaha doğru' },
    { src: 'assets/v3/card-ruya.webp', name: 'Sonsuz Rüya', line: 'Ayın kucağında, rüyalar hiç bitmez' }
  ];
  // the mock-up photographs, identified one by one (the first four are AI-made product renders, the last a print mock-up)
  const MERCH = [
    { src: 'assets/v3/merch-yastik.webp', name: 'Nakışlı yastık', alt: 'Krem rengi bir yastığın üstünde mor ve sarı nakışla UyanBi yazısı' },
    { src: 'assets/v3/merch-sapka.webp', name: 'Nakışlı şapka', alt: 'Krem rengi bir şapkanın önünde mor ve sarı nakışla UyanBi yazısı' },
    { src: 'assets/v3/merch-sweatshirt.webp', name: 'Nakışlı sweatshirt', alt: 'Krem rengi bir sweatshirtün göğsünde mor ve sarı nakışla UyanBi yazısı' },
    { src: 'assets/v3/merch-tabela.webp', name: 'Işıklı tabela', alt: 'Bir duvarda arkadan aydınlatılan mor ve sarı UyanBi harfleri' },
    { src: 'assets/v3/merch-kagit.webp', name: 'Baskılı kâğıt', alt: 'Dokulu kâğıda mor ve sarı baskıyla UyanBi yazısı' }
  ];
  const SUN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><use href="#i-sun"/></svg>';
  function collView() {
    const m = S.coll.merch;
    return frame({
      id: 'coll', eyebrow: 'Ponçik koleksiyonu', title: 'Ponçik, bir koleksiyon',
      lead: 'Oyundaki üç kart ve tasarım aşamasındaki ürün maketleri. Dokun, yakından bak.',
      stage: `<div class="dk-collrow">
        <div class="dk-cards">${CARDS.map((c, i) => `<button type="button" class="dk-card" data-card="${i}" aria-pressed="false" aria-label="${c.name} kartını çevir"><span class="dk-card-in"><span class="dk-face"><img src="${c.src}" alt="${c.name}: Ponçik kartı" width="268" height="410" decoding="async"></span><span class="dk-face back">${SUN}<b>${c.name}</b><span>${c.line}</span></span></span></button>`).join('')}</div>
        <div class="dk-merch">
          <figure class="dk-merch-main" style="margin:0"><img id="dk-merch-img" src="${MERCH[m].src}" alt="${MERCH[m].alt}" width="880" height="880" decoding="async"><span class="dk-merch-tag">Maket</span><figcaption id="dk-merch-cap">${MERCH[m].name}</figcaption></figure>
          <div class="dk-thumbs" role="group" aria-label="Ürün maketleri">${MERCH.map((x, i) => `<button type="button" class="dk-thumb" data-merch="${i}" aria-pressed="${i === m}" aria-label="${x.name}"><img src="${x.src}" alt="" width="52" height="52" loading="lazy" decoding="async"></button>`).join('')}</div>
        </div>
      </div>`,
      act: `<p class="dk-hint" id="dk-hint">Bir karta ya da ürüne dokun.</p><p class="dk-note">Ürünler tasarım aşamasında; satış henüz açık değil. Fotoğraflar maket görselidir.</p>
        <div class="dk-act-row">${nextBtn()}${skipBtn()}</div>`
    });
  }
  function collMount() {
    const c = S.coll;
    const cards = [...viewEl.querySelectorAll('[data-card]')], thumbs = [...viewEl.querySelectorAll('[data-merch]')];
    const touch = () => { if (!c.touched) { c.touched = true; done('coll'); } };
    cards.forEach((b, i) => {
      const set = () => { b.classList.toggle('is-flip', c.flipped[i]); b.setAttribute('aria-pressed', c.flipped[i]); };
      set();
      b.addEventListener('click', () => { window.UyanbiSfx?.play('kart'); c.flipped[i] = !c.flipped[i]; set(); q('#dk-hint').textContent = c.flipped[i] ? `${CARDS[i].name}: ${CARDS[i].line}` : 'Bir karta ya da ürüne dokun.'; touch(); });
    });
    thumbs.forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.merch; if (i === c.merch) return;
      window.UyanbiSfx?.play('kart');
      c.merch = i;
      thumbs.forEach(t => t.setAttribute('aria-pressed', t === b));
      const img = q('#dk-merch-img');
      const swap = () => { img.src = MERCH[i].src; img.alt = MERCH[i].alt; q('#dk-merch-cap').textContent = MERCH[i].name; img.classList.remove('is-fading'); };
      if (reduced()) swap(); else { img.classList.add('is-fading'); vafter(swap, 220); }
      touch();
    }));
    if (c.touched) done('coll', true);
  }

  /* ================= 5. Sesini bırak ================= */
  // where the stars hang: a fixed 3 x 3 grid (percent of the sky), far enough apart that the star and its label
  // never touch (a star box is at most ~27% wide, ~19% tall of the sky); the bottom-left cell is Ponçik's, so
  // only 8 slots exist; once all are taken the oldest star gives up its slot to the new one.
  const SLOTS = [[16, 12], [50, 10], [84, 12], [30, 46], [57, 46], [84, 44], [50, 80], [84, 78]];
  function voiceView() {
    return frame({
      id: 'voice', eyebrow: 'Sesini bırak', title: 'Bir kişi uyanır, herkes duyar',
      lead: 'Bugüne bir günaydın cümlesi bırak. Yıldıza dönüşsün.',
      stage: `<div class="dk-skyrow"><div class="dk-sky" id="dk-sky"><p class="dk-sky-empty">Henüz yıldız yok. İlk günaydını sen bırak.</p>
        <div class="dk-skybuddy"><p class="dk-say" id="dk-say" aria-hidden="true"></p><img class="dk-pon" data-main alt="" width="360" height="354" decoding="async"></div></div></div>`,
      act: `<form class="dk-form" id="dk-form" autocomplete="off"><label class="dk-sr" for="dk-in">Bugünün ilk cümlesi</label><input id="dk-in" class="dk-input" type="text" maxlength="64" placeholder="Bugün güzel bir şey olacak..."><button type="submit" class="dk-btn dk-do">Yıldıza çevir</button></form>
        <p class="dk-hint" id="dk-hint" role="status" aria-live="polite"></p>
        <p class="dk-caveat">Cümlen hiçbir yere gönderilmez; yalnızca bu sayfada kalır, sayfayı kapatınca silinir.</p>
        <div class="dk-act-row">${nextBtn()}${skipBtn()}</div>`
    });
  }
  function addStar(text, animate) {
    const sky = q('#dk-sky'), v = S.voice;
    const slot = SLOTS[v.k % SLOTS.length];
    sky.querySelectorAll(`[data-slot="${v.k % SLOTS.length}"]`).forEach(n => n.remove());
    const star = document.createElement('div');
    star.className = 'dk-star dk-star-tw'; star.dataset.slot = v.k % SLOTS.length;
    star.style.left = slot[0] + '%'; star.style.top = `min(${slot[1]}%, calc(100% - 72px))`; // the 72px keeps a two-line star inside a short sky
    star.innerHTML = '<i></i><em></em>'; star.querySelector('em').textContent = text;
    sky.append(star); sky.classList.add('has-stars'); v.k++;
    if (animate && !reduced()) {
      const sr = sky.getBoundingClientRect(), r = star.getBoundingClientRect();
      const dx = sr.left + sr.width / 2 - (r.left + r.width / 2), dy = sr.top + sr.height * .92 - r.top;
      star.animate([
        { transform: `translate(${dx}px,${dy}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${dx * .35}px,${dy * .55 - 24}px) scale(1.25)`, opacity: 1, offset: .5 },
        { transform: 'none', opacity: 1 }
      ], { duration: 1100, easing: 'cubic-bezier(.3,.7,.3,1)' });
    }
  }
  function voiceMount() {
    const v = S.voice;
    say('Bir günaydın cümlesi yaz, yıldız yapalım.', 'el-sallama');
    v.stars.forEach(t => addStar(t, false));
    const input = q('#dk-in');
    q('#dk-form').addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim().replace(/\s+/g, ' ');
      if (!text) { q('#dk-hint').textContent = 'Önce bir cümle yaz.'; input.focus(); return; }
      v.stars.push(text); if (v.stars.length > SLOTS.length) v.stars.shift();
      addStar(text, true);
      window.UyanbiSfx?.play('yildiz');
      input.value = '';
      q('#dk-hint').textContent = 'Günaydının yıldız oldu. İstersen bir tane daha bırak.';
      say('Günaydının yıldız oldu!', 'mutlu');
      done('voice', true);
    });
    if (v.stars.length) done('voice', true);
  }

  /* ================= 6. the waitlist ================= */
  const FAQ = [
    ['Erteleme butonu gerçekten yok mu?', 'Yok. Alarm 90 saniye boyunca çalar; görevi tamamlamazsan 1 dakika sonra yeniden başlar.'],
    ['Nesne tarama nasıl çalışıyor?', 'Nesneyi sen seçmezsin. Alarm çaldığında UyanBi seçili eşyalar arasından birini rastgele ister; onu bulup kameraya gösterdiğinde alarm susar. Evde uyanacağını seçtiysen ev eşyaları da gelebilir. Ekranda nesnenin fotoğrafını göstermek işe yaramaz.'],
    ['Meydan okuma hakkı nedir?', 'Ödül modunda kurduğun her alarm, sabah görevi için bir meydan okuma hakkını riske atar. Görevi zamanında bitirirsen meydan okumayı kazanırsın: hakkın sende kalır, üstüne Gün Işığı kazanırsın. Meydan okumayı kaçırırsan bir hak eksilir. Kalan hakların ve hareketlerin Kumbara\'da görünür.'],
    ['Hangi ödüller var?', 'Kazandığın her meydan okuma Gün Işığı getirir ve serini büyütür. Haftalık ve aylık sıralamada yükselirsin; ayın en istikrarlı uyananları Ayın Şampiyonu olur ve özel koleksiyon hediyeleri kazanır. Davet kodunu paylaşıp arkadaşını getirdiğinde de ödül kazanırsın.'],
    ['Hangi telefonlarda çalışacak?', 'iPhone ve Android telefonlarda. UyanBi, lansman günü App Store ve Google Play\'de yerini alacak.']
  ];
  function preView() {
    return frame({
      id: 'pre', cls: 'dk-split dk-pre', eyebrow: 'Yarın sabah', title: 'Ertelemedin<br>Harekete geçtin',
      lead: 'UyanBi çok yakında App Store ve Google Play\'de. Ön kaydını bırak, ilk uyananlar arasında sen de ol.',
      stage: `<div class="dk-prerow"><div class="dk-faq"><img class="dk-pon dk-faq-pon" data-main alt="" width="360" height="364" decoding="async"><h3>Sıkça sorulan sorular</h3>
        ${FAQ.filter(f => !(f[2] && isPhone())).map(([a, b]) => `<details><summary>${a}</summary><p>${b}</p></details>`).join('')}</div></div>`,
      act: `<div class="dk-cta"><a class="dk-btn" data-store="waitlist" href="#">Ön kayıt ol</a>${storeRow()}${nextBtn(true)}</div>
        <p class="dk-note dk-phone-only">Mini oyun bilgisayarda oynanır.</p>`
    });
  }
  function preMount() {
    setPon(q('.dk-pon[data-main]'), 'el-sallama', true);
    // one answer open at a time: the list never grows past the screen
    const items = [...viewEl.querySelectorAll('.dk-faq details')];
    items.forEach(d => d.addEventListener('toggle', () => { if (d.open) items.forEach(o => { if (o !== d) o.open = false; }); }));
    done('pre', true);
  }

  /* ================= the hub ================= */
  function door(s) {
    return `<button type="button" class="dk-door ${S.done[s.id] || S.seen[s.id] ? 'is-seen' : ''}" data-dk-go="${s.id}"><span class="dk-door-ico">${ICON[s.id]}</span><span class="dk-door-txt"><b>${s.name}</b><small>${s.sub}</small></span><i class="dk-door-check" aria-hidden="true">✓</i></button>`;
  }
  function hubView() {
    return `<div class="dk-wrap dk-hubv" data-v="hub">
      <div class="dk-text"><span class="dk-eyebrow">Merkez</span><h2 class="dk-title" id="dk-title" tabindex="-1">Bir kapı seç</h2><p class="dk-lead">Gördüklerinden istediğine geri dön ya da ön kaydını bırak.</p></div>
      <div class="dk-stage-row"><div class="dk-hub">
        <div class="dk-doors dk-doors-l">${STOPS.slice(0, 3).map(door).join('')}</div>
        <div class="dk-isle"><p class="dk-say" id="dk-say" role="status">Hepsini gördün! Şimdi hangisine dönelim?</p><img class="dk-pon" data-main alt="" width="360" height="364" decoding="async"><span class="dk-isle-base" aria-hidden="true"></span></div>
        <div class="dk-doors dk-doors-r">${STOPS.slice(3).map(door).join('')}</div>
      </div></div>
      <div class="dk-act dk-hub-act">
        <div class="dk-cta"><a class="dk-btn" data-store="waitlist" href="#">Ön kayıt ol</a>${storeRow()}</div>
        <div class="dk-hub-links"><button type="button" class="dk-link" data-ending="replay">↻ Yeniden oyna</button><button type="button" class="dk-link" data-dk="home">‹ Ana sayfa</button></div>
        <p class="dk-note dk-phone-only">Mini oyun bilgisayarda oynanır.</p>
      </div>
    </div>`;
  }
  function hubMount() { setPon(q('.dk-pon[data-main]'), 'mutlu', true); }

  const VIEWS = { jar: [jarView, jarMount], champ: [champView, champMount], app: [appView, appMount], coll: [collView, collMount], voice: [voiceView, voiceMount], pre: [preView, preMount], hub: [hubView, hubMount] };

  /* ================= frame, bar, moving between stops ================= */
  function updateBar() {
    if (!root) return;
    const lis = root.querySelectorAll('.dk-dots li');
    STOPS.forEach((s, i) => { lis[i].classList.toggle('is-cur', s.id === cur); lis[i].classList.toggle('is-seen', s.id !== cur && !!(S.done[s.id] || S.seen[s.id])); });
    root.querySelector('.dk-dots').setAttribute('aria-label', cur === 'hub' ? 'Merkez' : `Durak ${idx(cur) + 1} / ${STOPS.length}: ${STOPS[idx(cur)].name}`);
    root.querySelector('[data-dk="hub"]').hidden = !(S.hub && cur !== 'hub');
    // in the first run (the hub has not been reached yet) every stop but the first offers the way back
    const pi = idx(cur), prev = root.querySelector('[data-dk="prev"]');
    prev.hidden = !(!S.hub && pi > 0);
    if (!prev.hidden) prev.setAttribute('aria-label', `Önceki durak: ${STOPS[pi - 1].name}`);
  }
  function render(id) {
    if (!root) return;
    vtimers.forEach(clearTimeout); vtimers = [];
    flights.forEach(f => { try { f.finish(); } catch {} }); // a light still in the air lands at once
    cur = id; S.seen[id] = true; buddyName = '';
    const [markup, mount] = VIEWS[id];
    viewEl.innerHTML = markup();
    root.dataset.view = id;
    root.setAttribute('aria-label', id === 'hub' ? 'Merkez' : STOPS[idx(id)].name);
    root.scrollTop = 0;
    mount();
    window.UyanbiStores?.bind(viewEl);
    updateBar();
    fit();
    if (id !== 'jar' || S.jar.n || S.jar.landed || navigated) q('#dk-title')?.focus({ preventScroll: true });
  }
  let navigated = false;

  function go(id) {
    if (!root || navigating || id === cur) return;
    window.UyanbiSfx?.play('gecis');
    navigated = true;
    navigating = true;
    viewEl.classList.add('is-swap');
    after(() => { render(id); viewEl.classList.remove('is-swap'); navigating = false; }, 180);
  }
  function next() {
    if (S.hub) { go('hub'); return; }
    const i = idx(cur);
    if (i < STOPS.length - 1) go(STOPS[i + 1].id);
    else { S.hub = true; go('hub'); }
  }
  function onClick(e) {
    const goto = e.target.closest('[data-dk-go]');
    if (goto) { go(goto.dataset.dkGo); return; }
    const a = e.target.closest('[data-dk]')?.dataset.dk;
    if (a === 'next' || a === 'skip') next();
    else if (a === 'prev') { const i = idx(cur); if (i > 0) go(STOPS[i - 1].id); }
    else if (a === 'hub') go('hub');
    else if (a === 'home') {
      // a computer goes through the corner button (game.js: back to the welcome screen); a phone has no welcome screen: it starts again
      if (isPhone()) location.assign(location.pathname);
      else document.querySelector('#story-nav [data-ending="home"]')?.click();
    }
  }

  function open() {
    if (root) return;
    S = fresh(); cur = ''; navigated = false;
    root = document.createElement('section');
    root.id = 'durak'; root.className = 'durak'; root.setAttribute('aria-label', 'Işık kavanozu');
    root.innerHTML = `<div class="dk-bar"><button type="button" class="dk-prevbtn" data-dk="prev" hidden><span aria-hidden="true">‹</span> Önceki</button><button type="button" class="dk-hubbtn" data-dk="hub" hidden><span aria-hidden="true">‹</span> Merkez</button><ol class="dk-dots" role="img">${STOPS.map(() => '<li></li>').join('')}</ol></div><div class="dk-view" id="dk-view"></div>`;
    game.appendChild(root);
    viewEl = root.querySelector('#dk-view');
    html.classList.add('durak-on');
    root.addEventListener('click', onClick);
    observer = new ResizeObserver(refit); observer.observe(root);
    render('jar');
    // soft open: the layer fades in over the phone that has just arrived
    requestAnimationFrame(() => requestAnimationFrame(() => root && root.classList.add('is-open')));
    // keyboard users land inside the layer; the next Tab reaches the button
    root.tabIndex = -1;
    after(() => { if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true }); }, 900);
  }
  function close() {
    timers.forEach(clearTimeout); timers = []; vtimers.forEach(clearTimeout); vtimers = [];
    flights = [];
    if (fitFrame) { cancelAnimationFrame(fitFrame); fitFrame = 0; }
    observer?.disconnect(); observer = null;
    root?.remove(); root = null; viewEl = null; S = null; cur = ''; navigating = false;
    html.classList.remove('durak-on');
  }

  window.UyanbiStory = { open, close };
})();
