/* UyanbiPerde: the end of the game as a scene closing. Only after a won game on a computer (ending.js); the phone never sees it.

   The balcony stays as it is for a breath. Two red velvet curtains close from both sides of the picture under a gold valance;
   Ponçik drags the right one across (his hand on its edge) and stops in the middle, in front of it. Before the last part of the
   curtain has closed he takes a bow and a short applause runs. Then the camera sinks: the curtain and the stage lift away
   upward, gold sparks and soft vertical lines of light stream past, the night turns to the cream of the site, and the stops layer
   (duraklar.js) rises from below and settles. The layer is gone when it has settled.

   UyanbiPerde.play({ host, open, from, mark }) -> Promise<boolean>   true = finished, false = cancelled
     host   the element the layer lives in (#game; the welcome screen passes #app, because #game is hidden then)
     open   called once the curtain is shut, at the start of the flight; it opens the stops layer and returns its element (or null).
            The layer moves into that element's parent, so it sits in the same stacking context as the stops layer.
     from   where Ponçik starts: { x, y, bh, rot } = his feet centre in client pixels, his body height, his tilt in degrees.
            Omitted: where the game's own Ponçik stands.  null: a default place on the stage.
            UyanbiPerde.anchor(img, 'welcome') measures it for the welcome screen's picture (see STARTS).
     mark   false = do not put the perde-on class on the host (the game's own Ponçik and the phone are hidden by it)
   UyanbiPerde.ready() -> Promise   both poses decoded (at most 600 ms), so the first frame never waits for a picture
   UyanbiPerde.cancel()   at once: timers, animations, the layer and the sound are gone (Yeniden oyna, Ana sayfa, a second show)
   UyanbiPerde.timeline   the stages in ms;  UyanbiPerde.timeScale  1; a larger number slows everything (for looking at frames)

   Everything that moves is transform, opacity or filter. Particles: 34 sparks + 14 lines = 48 (limit 60).
   Reduced motion: no movement; the curtain fades in already closed, holds, and fades away while the stops layer opens. */
(function (root) {
  'use strict';
  if (!root.document || root.UyanbiPerde) return;
  const doc = root.document, html = doc.documentElement;

  /* The bow (reverans) before the curtain is shut, with the short applause: one switch. false = Ponçik only pulls the curtain. */
  const REVERANS = true;

  const POSE_PULL = 'el-sallama', POSE_FLY = 'mutlu';        // assets/poncik/<name>.webp (…-still.webp for reduced motion)
  const SPARKS = 34, LINES = 14;
  const DRESS = 380, PULL_FROM = 400, PULL_MS = 900;         // the valance drops; the curtains start; the pull to Ponçik's spot
  const BOW_MS = 520, PAUSE = REVERANS ? 520 : 140;          // the bow (or a breath) with the curtain still ajar
  const SEAL_MS = 330, HOLD = 100;                           // the last part closes; a beat of rest
  const FLIGHT_MS = 800, DURAK_AT = 560, DURAK_MS = 860;     // the lift; the stops layer starts this long after the lift does
  const T_GAP = PULL_FROM + PULL_MS, T_SEAL = T_GAP + PAUSE, T_SHUT = T_SEAL + SEAL_MS, T_FLY = T_SHUT + HOLD;
  const T_END = T_FLY + DURAK_AT + DURAK_MS;
  const K0 = .17;                                            // how much of its width a curtain shows while it is drawn open
  const FLOOR = .105, VALANCE = .19;                         // stage floor and valance, as a share of the screen height
  const EASE_PULL = 'cubic-bezier(.45,.02,.45,1)', EASE_SEAL = 'cubic-bezier(.4,0,.2,1)', EASE_UP = 'cubic-bezier(.5,0,.88,.5)';
  const SETTLE = CSS.supports?.('transition-timing-function', 'linear(0, 1)')
    ? 'linear(0, .07, .24, .48, .7, .87, .97, 1.018, 1.026, 1.018, 1.008, 1.002, 1)' : 'cubic-bezier(.2,.9,.3,1.05)';

  /* Where the body stands in each clip of assets/poncik (pixels of the file, alpha > 40, median over all frames, the biggest
     connected shape only so confetti and sparks do not count): w, h = file size; feet = lowest row of the body; cx = centre of its
     lower half; bh = body height. The clips are framed differently; the curtain scene lays every pose out so that the feet stay
     on one line, the body centre on one vertical and the body keeps one height, whichever pose is shown. */
  const METRICS = {
    'arastirmaci': { w: 360, h: 354, feet: 286, cx: 173.2, bh: 212 }, 'coin': { w: 360, h: 354, feet: 302, cx: 174.3, bh: 262 },
    'el-sallama': { w: 360, h: 364, feet: 328, cx: 200.7, bh: 322 }, 'kalem': { w: 360, h: 354, feet: 297, cx: 196.2, bh: 234 },
    'kamera': { w: 360, h: 354, feet: 337, cx: 185.0, bh: 293 }, 'kumbara': { w: 360, h: 354, feet: 297, cx: 171.4, bh: 242 },
    'mutlu': { w: 360, h: 330, feet: 274, cx: 181.8, bh: 229 }, 'saat': { w: 360, h: 354, feet: 292, cx: 185.3, bh: 220 },
    'tamam': { w: 360, h: 354, feet: 293, cx: 168.1, bh: 222 }, 'uykulu': { w: 360, h: 354, feet: 310, cx: 174.4, bh: 260 },
    'uyuyan': { w: 360, h: 296, feet: 254, cx: 182.2, bh: 178 }, 'uzgun-kumbara': { w: 360, h: 354, feet: 272, cx: 179.5, bh: 193 },
    'uzgun': { w: 360, h: 292, feet: 248, cx: 175.0, bh: 195 },
    'el-sallama-still': { w: 360, h: 364, feet: 328, cx: 202.0, bh: 323 }, 'mutlu-still': { w: 360, h: 330, feet: 249, cx: 183.6, bh: 209 }
  };
  /* Pictures the curtain Ponçik can take over from (pixels of the file, alpha > 40, biggest shape): feet = lowest row of the body,
     cx = centre of its lower half, top = highest row. The welcome screen's Ponçik is a still (assets/X1.webp), tilted 4 degrees by css. */
  const STARTS = { welcome: { w: 1024, h: 1024, feet: 901, cx: 526.3, top: 68 } };
  const metric = name => METRICS[name + (reduced() ? '-still' : '')] || METRICS[name];
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canAnimate = typeof Element !== 'undefined' && !!Element.prototype.animate;
  const sfx = (name, opts) => { try { root.UyanbiSfx?.play(name, opts); } catch {} };
  const pose = name => `assets/poncik/${name}${reduced() ? '-still' : ''}.webp`;

  /* Where a picture's body stands on the screen now, whatever css transform (tilt, scale) its parents carry: two probe points
     (his feet centre and the top of his head) are placed in the picture's own layout box and read back in client pixels. */
  function anchor(img, name) {
    const m = STARTS[name], p = img && img.offsetParent;
    if (!m || !p || !img.complete || img.offsetWidth < 40 || img.offsetHeight < 40) return null;
    const kx = img.offsetWidth / m.w, ky = img.offsetHeight / m.h;
    const at = (sx, sy) => {
      const i = doc.createElement('i');
      i.style.cssText = `position:absolute;left:${img.offsetLeft + sx * kx}px;top:${img.offsetTop + sy * ky}px;width:0;height:0;pointer-events:none`;
      p.append(i); const r = i.getBoundingClientRect(); i.remove(); return { x: r.left, y: r.top };
    };
    const feet = at(m.cx, m.feet), head = at(m.cx, m.top);
    return { x: feet.x, y: feet.y, bh: Math.hypot(head.x - feet.x, head.y - feet.y), rot: Math.atan2(head.x - feet.x, feet.y - head.y) * 180 / Math.PI };
  }
  function ready() {
    const load = name => { const img = new Image(); img.src = pose(name); return img.decode ? img.decode().catch(() => {}) : Promise.resolve(); };
    return Promise.race([Promise.all([POSE_PULL, POSE_FLY].map(load)), new Promise(resolve => setTimeout(resolve, 600))]);
  }

  /* ---------------- the art ---------------- */
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const f1 = v => Math.round(v * 10) / 10;
  const HUE = 351;
  // one fold's cross-section: shadow, body, a broad light, a thin sheen at the crest, back down into shadow
  function foldStops(p, m, hue = HUE) {
    const S = [[0, 5, 74], [.14, 12, 78], [p - .2, 22, 80], [p - .07, 34 * m, 80], [p, 45 * m, 72], [p + .08, 35 * m, 79], [p + .3, 20, 80], [.88, 10, 78], [1, 4, 72]];
    return S.map(([o, l, s]) => `<stop offset="${f1(o * 100) / 100}" stop-color="hsl(${hue} ${s}% ${f1(l)}%)"/>`).join('');
  }
  const goldStops = n => Array.from({ length: n }, (_, i) => `<stop offset="${f1(i / (n - 1) * 100)}%" stop-color="${['#f9dc8a', '#c18a2a', '#ffeeb4', '#a8741d', '#e8bf5e'][i % 5]}"/>`).join('');
  function tassel(x, y, s) {   // a gold tassel hanging from (x, y): cord, bead, collar, skirt of threads
    let threads = '';
    for (let i = -4; i <= 4; i++) threads += `<path d="M${f1(x + i * 1.6 * s)} ${f1(y + 20 * s)}Q${f1(x + i * 3.1 * s)} ${f1(y + 42 * s)} ${f1(x + i * 3.5 * s)} ${f1(y + 66 * s)}" stroke="url(#pfgv)" stroke-width="${f1(2.1 * s)}" fill="none" stroke-linecap="round"/>`;
    return `<g><path d="M${f1(x)} ${f1(y - 34 * s)}V${f1(y)}" stroke="url(#pfgv)" stroke-width="${f1(3 * s)}"/><circle cx="${f1(x)}" cy="${f1(y + 7 * s)}" r="${f1(8 * s)}" fill="url(#pfgr)"/>`
      + `<rect x="${f1(x - 6 * s)}" y="${f1(y + 15 * s)}" width="${f1(12 * s)}" height="${f1(6 * s)}" rx="${f1(2 * s)}" fill="url(#pfgv)"/>${threads}</g>`;
  }
  const defsCommon = `<linearGradient id="pfgv" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#8f5f14"/><stop offset=".35" stop-color="#ffe9a4"/><stop offset=".7" stop-color="#d49b32"/><stop offset="1" stop-color="#8a5a10"/></linearGradient>`
    + `<radialGradient id="pfgr" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff4c4"/><stop offset=".45" stop-color="#e0a93a"/><stop offset="1" stop-color="#7d4e0c"/></radialGradient>`;

  /* One curtain (W = 600 units wide, H units tall: the viewBox has the real proportions of the box, so a bead stays round).
     Folds are strips with wavy edges, each with its own cross-section gradient; the hem is a wave that hangs lowest at every crest. */
  function panelSVG(seed, W, H, mirror) {
    const r = rng(seed), N = 9, hemBase = H * .925, hemAmp = H * .0125, amp = 4.5, ph = Array.from({ length: N + 1 }, () => r() * 6.28);
    const raw = Array.from({ length: N }, () => .74 + r() * .55), sum = raw.reduce((a, b) => a + b, 0), xs = [0];
    raw.forEach(w => xs.push(xs[xs.length - 1] + w / sum * W));
    const bx = (b, y) => xs[b] + (b === 0 || b === N ? 0 : amp * Math.sin(y / H * 6.28 * 1.2 + ph[b]));
    const hem = (i, x) => hemBase + hemAmp * Math.cos(2 * Math.PI * ((x - xs[i]) / (xs[i + 1] - xs[i]) - .5));
    const hemAt = x => { let i = 0; while (i < N - 1 && x > xs[i + 1]) i++; return hem(i, x); };
    let defs = defsCommon + `<linearGradient id="pfgh" gradientUnits="userSpaceOnUse" x1="0" x2="${W}" y1="0" y2="0">${goldStops(23)}</linearGradient>`, folds = '', crest = '', creases = '';
    for (let i = 0; i < N; i++) {
      const p = .38 + r() * .18, m = .8 + r() * .38, step = H / 40;
      defs += `<linearGradient id="pff${i}" x1="0" x2="1" y1="0" y2="0">${foldStops(p, m)}</linearGradient>`;
      const yL = hem(i, xs[i]), yR = hem(i, xs[i + 1]), pts = [];
      for (let y = 0; y < yL; y += step) pts.push([bx(i, y), y]);
      for (let u = 0; u <= 1.001; u += .125) { const xa = bx(i, hemBase), xb = bx(i + 1, hemBase), x = xa + (xb - xa) * u; pts.push([x, hem(i, xs[i] + (xs[i + 1] - xs[i]) * u)]); }
      const up = []; for (let y = 0; y < yR; y += step) up.push([bx(i + 1, y) + 1.2, y]);
      folds += `<path d="M${pts.concat(up.reverse()).map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z" fill="url(#pff${i})"/>`;
      let c = '', cr = '';
      for (let y = H * .06; y < yR - H * .05; y += step) c += `${c ? 'L' : 'M'}${f1(bx(i, y) + (bx(i + 1, y) - bx(i, y)) * (p + .01))} ${f1(y)}`;
      crest += `<path d="${c}" stroke="hsla(${HUE + 4},88%,78%,.2)" stroke-width="2.2" fill="none"/>`;
      for (let y = 0; y < yL; y += step) cr += `${cr ? 'L' : 'M'}${f1(bx(i, y))} ${f1(y)}`;
      creases += `<path d="${cr}" stroke="rgba(0,0,0,.34)" stroke-width="2.4" fill="none"/>`;
    }
    defs += `<linearGradient id="pfts" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#16020a" stop-opacity=".78"/><stop offset=".55" stop-color="#16020a" stop-opacity=".16"/><stop offset="1" stop-color="#16020a" stop-opacity="0"/></linearGradient>`
      + `<linearGradient id="pfbs" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#16020a" stop-opacity="0"/><stop offset="1" stop-color="#16020a" stop-opacity=".42"/></linearGradient>`
      + `<linearGradient id="pfle" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#16020a" stop-opacity="0"/><stop offset="1" stop-color="#16020a" stop-opacity=".5"/></linearGradient>`;
    let trim = '', fringe = '';
    for (let x = 0; x <= W; x += 8) trim += `${trim ? 'L' : 'M'}${f1(x)} ${f1(hemAt(x) - H * .034)}`;
    for (let x = 3; x < W; x += 8.4) { const y = hemAt(x) + 1, dx = (r() - .5) * 3; fringe += `M${f1(x)} ${f1(y)}L${f1(x + dx)} ${f1(y + H * (.034 + r() * .014))}`; }
    const svg = `<svg viewBox="0 0 ${W} ${f1(H)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"${mirror ? ' style="transform:scaleX(-1)"' : ''}><defs>${defs}</defs>`
      + `<rect width="${W}" height="${f1(H)}" fill="hsl(${HUE} 80% 7%)"/>${folds}${creases}${crest}`
      + `<rect width="${W}" height="${f1(H * .3)}" fill="url(#pfts)"/><rect y="${f1(H * .62)}" width="${W}" height="${f1(H * .38)}" fill="url(#pfbs)"/><rect x="${W - 54}" width="54" height="${f1(H)}" fill="url(#pfle)"/>`
      + `<path d="${trim}" stroke="rgba(30,10,0,.55)" stroke-width="13" fill="none" transform="translate(0 1.4)"/><path d="${trim}" stroke="url(#pfgh)" stroke-width="10" fill="none"/>`
      + `<path d="${fringe}" stroke="url(#pfgh)" stroke-width="3.2" stroke-linecap="round" fill="none"/>${tassel(W - 22, hemAt(W - 22) - H * .03, H / 520)}</svg>`;
    return svg;
  }

  /* The valance: a gold rod with ball ends, scalloped swags of red pleats, gold braid and fringe along the swags, tassels at the joins. */
  function valanceSVG(Wv, Hv) {
    const r = rng(11), N = Math.max(2, Math.round(Wv / 430)), w = Wv / N, J = 11, top = 15, phs = Array.from({ length: N * (J + 1) }, () => r() * 6.28);
    const edge = u => 98 + 66 * Math.sin(Math.PI * u);
    let defs = defsCommon + `<linearGradient id="pfgh" gradientUnits="userSpaceOnUse" x1="0" x2="${f1(Wv)}" y1="0" y2="0">${goldStops(Math.max(9, Math.round(Wv / 90)) | 1)}</linearGradient>`
      + `<linearGradient id="pfrod" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff2bd"/><stop offset=".3" stop-color="#e5b44c"/><stop offset=".72" stop-color="#8f5f14"/><stop offset="1" stop-color="#d9a73f"/></linearGradient>`
      + `<linearGradient id="pfvt" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#12020a" stop-opacity=".75"/><stop offset=".5" stop-color="#12020a" stop-opacity="0"/></linearGradient>`, bands = '', shadow = '', braid = '', fringe = '', tassels = '';
    for (let m = 0; m < N; m++) {
      const x0 = m * w;
      let sil = `M${f1(x0)} ${top}H${f1(x0 + w)}`;
      for (let u = 1; u >= -.001; u -= .05) sil += `L${f1(x0 + w * Math.max(0, u))} ${f1(edge(Math.max(0, u)))}`;
      bands += `<path d="${sil}Z" fill="hsl(${HUE} 80% 8%)"/>`;
      for (let j = 0; j < J; j++) {
        const id = `pfv${m}_${j}`, p = .38 + r() * .18, a = j / J, b = (j + 1) / J, pa = phs[m * (J + 1) + j], pb = phs[m * (J + 1) + j + 1];
        defs += `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">${foldStops(p, .85 + r() * .35)}</linearGradient>`;
        const col = (u, s, ph) => x0 + w * u + (u <= 0 || u >= 1 ? 0 : 5 * Math.sin(s * 3.1 + ph) * s);
        const L = [], R = [], B = [];
        for (let s = 0; s <= 1.001; s += .1) { L.push([col(a, s, pa), top + (edge(a) - top) * s]); R.push([col(b, s, pb), top + (edge(b) - top) * s]); }
        for (let u = a; u <= b + .001; u += (b - a) / 3) B.push([x0 + w * u, edge(u)]);
        bands += `<path d="M${L.concat(B, R.reverse()).map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z" fill="url(#${id})" stroke="rgba(0,0,0,.3)" stroke-width="1.4"/>`;
      }
      let e = '';
      for (let u = 0; u <= 1.001; u += .04) e += `${e ? 'L' : 'M'}${f1(x0 + w * u)} ${f1(edge(u))}`;
      shadow += `<path d="${e}" stroke="rgba(8,0,6,.36)" stroke-width="22" fill="none" transform="translate(0 10)" stroke-linecap="round"/>`;
      braid += `<path d="${e}" stroke="rgba(30,10,0,.55)" stroke-width="9" fill="none" transform="translate(0 1.3)"/><path d="${e}" stroke="url(#pfgh)" stroke-width="7" fill="none"/>`;
      for (let u = .006; u < 1; u += 9 / w) { const y = edge(u) + 2, dx = (r() - .5) * 2.6; fringe += `M${f1(x0 + w * u)} ${f1(y)}L${f1(x0 + w * u + dx)} ${f1(y + 15 + r() * 6)}`; }
    }
    for (let m = 0; m <= N; m++) tassels += tassel(Math.min(Wv - 26, Math.max(26, m * w)), 110, 1.1);
    return `<svg viewBox="0 0 ${f1(Wv)} ${Hv}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>${defs}</defs>${shadow}`
      + `<rect y="${top}" width="${f1(Wv)}" height="40" fill="hsl(${HUE} 80% 7%)"/>${bands}<rect y="${top}" width="${f1(Wv)}" height="70" fill="url(#pfvt)"/>`
      + `<path d="${fringe}" stroke="url(#pfgh)" stroke-width="3" stroke-linecap="round" fill="none"/>${braid}${tassels}`
      + `<rect width="${f1(Wv)}" height="21" rx="4" fill="url(#pfrod)"/><rect y="2.4" width="${f1(Wv)}" height="2.6" fill="rgba(255,250,215,.7)"/>`
      + `<circle cx="17" cy="10.5" r="17" fill="url(#pfgr)"/><circle cx="${f1(Wv - 17)}" cy="10.5" r="17" fill="url(#pfgr)"/></svg>`;
  }

  /* ---------------- the run ---------------- */
  let run = null;
  function cancel() {
    if (!run) return;
    const r = run; run = null;
    r.dead = true;
    r.timers.forEach(clearTimeout);
    r.anims.forEach(a => { try { a.cancel(); } catch {} });
    r.layer?.remove();
    if (r.durak) { r.durak.style.removeProperty('transition'); }
    try { root.UyanbiSfx?.stop(); } catch {}
    r.resolve(false);
  }
  function prime() {   // the two poses are fetched while the game is played, so the curtain never waits for them
    if (prime.done || html.classList.contains('is-phone')) return;
    prime.done = true;
    [POSE_PULL, POSE_FLY].forEach(name => { const img = new Image(); img.decoding = 'async'; img.src = pose(name); });
  }
  if (root.requestIdleCallback) root.requestIdleCallback(prime, { timeout: 4000 }); else setTimeout(prime, 2500);

  function play({ host, open, from, mark = true } = {}) {
    cancel();
    host ||= doc.getElementById('game');
    const vw = root.innerWidth, vh = root.innerHeight, quiet = reduced() || !canAnimate;
    const r = run = { dead: false, timers: [], anims: [], layer: null, durak: null, resolve: null };
    const done = new Promise(resolve => { r.resolve = resolve; });
    const ts = Math.max(.1, Number(api.timeScale) || 1);
    const later = (fn, ms) => { const t = setTimeout(() => { if (!r.dead) fn(); }, ms * ts); r.timers.push(t); };
    const anim = (el, keys, opts) => {
      if (!el || !canAnimate) return null;
      const a = el.animate(keys, { fill: 'both', ...opts, duration: opts.duration * ts, delay: (opts.delay || 0) * ts });
      r.anims.push(a); return a;
    };

    // geometry
    const P = Math.round(vw * .56), floorPx = Math.round(vh * FLOOR), panelH = vh - floorPx, S = Math.round(Math.min(Math.max(vh * .4, 190), 440, vw * .34));
    const REF = metric(POSE_PULL), f = S / REF.w;                                      // f: pixels per file pixel of the pulling pose
    const fl = { x: (REF.w - REF.cx) * f, y: REF.feet * f };                           // his feet inside his box (the clip is mirrored: his hand is on the curtain edge)
    const edge = k => vw - P * k, handX = k => edge(k) + .06 * S - S;               // his box left when his hand is on the right curtain edge
    const kGap = Math.min(.9, Math.max(.5, (vw / 2 + fl.x - .94 * S) / P));       // where the edge is when his body is exactly in the middle
    const feetY = vh - floorPx * .58;                                                  // the line his feet stand on
    // where the game Poncik stands (his box is the 920:860 crop of the clip; feet on source row 853, body 803 high): the curtain Poncik starts there
    const act = doc.getElementById('poncik-actor'), ar = act && act.getBoundingClientRect();
    const here = from !== undefined ? from : ar && ar.width > 40 && ar.height > 40 ? { x: ar.left + ar.width / 2, y: ar.top + 853 / 860 * ar.height, bh: 803 * ar.width / 920, rot: 0 } : null;

    const layer = r.layer = doc.createElement('div');
    layer.className = 'perde'; layer.setAttribute('aria-hidden', 'true');
    layer.style.setProperty('--floor', floorPx + 'px'); layer.style.setProperty('--val', Math.round(vh * VALANCE) + 'px');
    layer.style.setProperty('--S', S + 'px');
    const unit = Math.round(vh * VALANCE) / 220;
    layer.innerHTML = `<div class="pd-bg"><i class="pd-night"></i><i class="pd-dusk"></i><i class="pd-dawn"></i></div><div class="pd-fx"></div>`
      + `<div class="pd-stage"><div class="pd-panel pd-l">${panelSVG(7, 600, 600 * panelH / P, false)}</div><div class="pd-panel pd-r">${panelSVG(23, 600, 600 * panelH / P, true)}<i class="pd-lead"></i></div>`
      + `<div class="pd-floor"><i class="pd-lights"></i></div><div class="pd-sheen"></div><div class="pd-light"></div>`
      + `<div class="pd-valance">${valanceSVG(Math.round(vw / unit), 220)}</div>`
      + `<div class="pd-pon"><div class="pd-body"><img class="pd-a" src="${pose(POSE_PULL)}" width="360" height="364" alt="" draggable="false"><img class="pd-b" src="${pose(POSE_FLY)}" width="360" height="330" alt="" draggable="false" style="opacity:0"></div><i class="pd-shadow"></i></div></div>`;
    host.append(layer);
    if (mark) host.classList.add('perde-on');                        // the game's own Ponçik fades out (perde.css)

    const q = sel => layer.querySelector(sel);
    // each pose is laid out in the pulling pose box so that feet line, body centre and body height are the same for all of them
    const place = (img, name) => {
      const m = metric(name), k = f * REF.bh / m.bh;
      Object.assign(img.style, { width: `${m.w * k}px`, left: `${(REF.w - REF.cx) * f - (m.w - m.cx) * k}px`, top: `${REF.feet * f - m.feet * k}px` });
    };
    const stage = q('.pd-stage'), L = q('.pd-l'), R = q('.pd-r'), val = q('.pd-valance'), pon = q('.pd-pon'), body = q('.pd-body'), fx = q('.pd-fx'), dawn = q('.pd-dawn'), bg = q('.pd-bg');
    const imgA = q('.pd-a'), imgB = q('.pd-b');
    place(imgA, POSE_PULL); place(imgB, POSE_FLY);
    body.style.height = `${REF.h * f}px`; pon.style.width = `${S}px`; pon.style.height = `${REF.h * f}px`;
    pon.style.transformOrigin = body.style.transformOrigin = `${fl.x}px ${fl.y}px`;
    const rest = x => `${Math.round(x)}px ${Math.round(feetY - fl.y)}px`;           // translate that puts his feet on the line, his box left at x

    // the layer is taken down, the promise says "finished"
    function finish() { const rr = r; run = null; rr.dead = true; rr.anims.forEach(x => { try { x.cancel(); } catch {} }); rr.layer.remove(); if (rr.durak) rr.durak.style.removeProperty('transition'); rr.resolve(true); }

    function fly() {                                                  // the camera sinks: curtain and stage lift away, light streams past
      if (r.dead) return;
      sfx('ucus');
      const el = typeof open === 'function' ? open() : null;
      const a = el && el.getBoundingClientRect ? el : null;
      if (a && a.parentNode && a.parentNode !== layer.parentNode) a.parentNode.append(layer);   // the welcome screen hosted it: join the stops layer's stacking context
      // the jumping pose takes over from the waving one: a 120 ms cross-fade, same feet, same centre, same body height
      anim(imgA, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear' });
      anim(imgB, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' });
      bg.style.opacity = '1';
      anim(stage, [{ transform: 'translateY(0)' }, { transform: `translateY(${-Math.round(vh * 1.08)}px)` }], { duration: FLIGHT_MS, easing: EASE_UP });
      // night -> a warm dusk -> the cream of the site (the stops layer's own ground), over the whole flight
      const span = FLIGHT_MS + DURAK_AT + 200;
      anim(q('.pd-dusk'), [{ opacity: 0 }, { opacity: 1, offset: .5 }, { opacity: 1 }], { duration: span, easing: 'ease-in-out' });
      anim(dawn, [{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }], { duration: span, easing: 'ease-in-out' });
      let bits = '';
      for (let i = 0; i < SPARKS; i++) bits += `<i class="pd-spark s${i % 3}"></i>`;
      for (let i = 0; i < LINES; i++) bits += '<i class="pd-line"></i>';
      fx.innerHTML = bits;
      const pick = (lo, hi) => lo + Math.random() * (hi - lo);
      fx.querySelectorAll('.pd-spark').forEach(s => {
        const size = pick(8, 21), x = pick(2, 98);
        s.style.cssText = `left:${x}%;width:${size}px;height:${size}px`;
        const d = pick(850, 1400);
        anim(s, [{ transform: 'translateY(0) rotate(0deg)', opacity: 0 }, { opacity: 1, offset: .16 }, { opacity: .9, offset: .78 }, { transform: `translateY(${-Math.round(vh * 1.2)}px) rotate(${pick(-90, 90)}deg)`, opacity: 0 }],
          { duration: d, delay: pick(0, 420), easing: 'cubic-bezier(.3,.1,.6,1)' });
      });
      fx.querySelectorAll('.pd-line').forEach(s => {
        const h = pick(18, 36);
        s.style.cssText = `left:${pick(3, 97)}%;height:${h}vh;width:${pick(2, 4)}px`;
        anim(s, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: pick(.7, 1), offset: .25 }, { opacity: .4, offset: .75 }, { transform: `translateY(${-Math.round(vh * 1.45)}px)`, opacity: 0 }],
          { duration: pick(650, 980), delay: pick(0, 520), easing: 'cubic-bezier(.4,.05,.75,.55)' });
      });
      // the stops layer comes up from below and settles; it is solid (no fade) while it travels. Its start position is held by
      // the animation's own delay, so it never shows at its final place before it is due.
      if (a) {
        r.durak = a; a.style.transition = 'none';
        anim(a, [{ translate: '0 105%' }, { translate: '0 0' }], { duration: DURAK_MS, delay: DURAK_AT, easing: SETTLE });
      }
      later(() => finish(), DURAK_AT + DURAK_MS + 40);
    }

    if (quiet) {                                                      // reduced motion: shut already, a soft fade in, a soft fade out
      L.style.transform = R.style.transform = 'none'; val.style.transform = 'none';
      pon.style.translate = rest(vw / 2 - fl.x); pon.style.opacity = '1';
      anim(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      sfx('perde', { dur: .6, soft: true });
      later(() => {
        bg.style.opacity = '1';
        const el = typeof open === 'function' ? open() : null;
        anim(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: 'ease-in', delay: 80 });
        later(finish, 700);
      }, 920);
      return done;
    }

    // ---- the closing scene, one clock: every animation below is anchored to the same start ----
    // the valance drops, the curtains and the stage light come in; the game's Ponçik is gone (perde.css) before the other arrives
    anim(val, [{ transform: 'translateY(-105%)' }, { transform: 'translateY(0)' }], { duration: DRESS, easing: 'cubic-bezier(.2,.7,.2,1)' });
    [L, R].forEach(p => anim(p, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'linear' }));
    [q('.pd-floor'), q('.pd-light')].forEach(e => anim(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 520, easing: 'ease-out' }));
    // the curtains: drawn open (K0) -> to the gap Ponçik stands in (kGap) -> a pause for the bow -> shut. Offsets are absolute times.
    const D = T_SHUT, off = ms => ms / D;
    const panelKeys = [
      { offset: 0, transform: `scaleX(${K0})`, easing: 'linear' },
      { offset: off(PULL_FROM), transform: `scaleX(${K0})`, easing: EASE_PULL },
      { offset: off(T_GAP), transform: `scaleX(${kGap})`, easing: 'linear' },
      { offset: off(T_SEAL), transform: `scaleX(${kGap})`, easing: EASE_SEAL },
      { offset: 1, transform: 'scaleX(1.012)' }
    ];
    [L, R].forEach(p => anim(p, panelKeys, { duration: D, composite: 'replace' }));
    // Poncik starts exactly where the game Poncik stood (same feet, same body height), walks to the curtain edge with a hop
    // while the valance drops, then rides the edge with the same easing as the curtain (his x is linear in the edge) and stays
    const xs0 = handX(K0), xs1 = handX(kGap), t1 = PULL_FROM - 70;
    pon.style.opacity = '1';
    const first = here ? { tx: here.x - fl.x, ty: here.y - fl.y, sc: here.bh / (REF.bh * f), rot: here.rot || 0 } : { tx: xs0 + S * .5, ty: feetY - fl.y, sc: 1, rot: 0 };
    const walkIn = [];
    for (let i = 0; i <= 10; i++) {
      const k = i / 10, p = k * k * (3 - 2 * k), lift = Math.sin(Math.PI * k) * S * .07;
      walkIn.push({ offset: off(t1 * k), translate: `${Math.round(first.tx + (xs0 - first.tx) * p)}px ${Math.round(first.ty + (feetY - fl.y - first.ty) * p - lift)}px`, scale: +(first.sc + (1 - first.sc) * p).toFixed(4), rotate: `${+(first.rot * (1 - p)).toFixed(3)}deg`, easing: 'linear' });
    }
    anim(pon, [
      ...walkIn,
      { offset: off(PULL_FROM), translate: rest(xs0), scale: 1, rotate: '0deg', easing: EASE_PULL },
      { offset: off(T_GAP), translate: rest(xs1), scale: 1, rotate: '0deg' },
      { offset: 1, translate: rest(xs1), scale: 1, rotate: '0deg' }
    ], { duration: D });
    // he leans into the pull: a little hop on every step of the way
    anim(body, [{ transform: 'translateY(0)' }, { transform: `translateY(${-Math.round(S * .028)}px)` }, { transform: 'translateY(0)' }], { duration: 238, delay: PULL_FROM, iterations: 4, easing: 'ease-in-out', fill: 'none' });
    // the sheen: a slow diagonal glint across the shut curtain
    anim(q('.pd-sheen'), [{ transform: 'translateX(-80vw) skewX(-18deg)', opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .75 }, { transform: 'translateX(90vw) skewX(-18deg)', opacity: 0 }], { duration: 900, delay: T_SEAL + 80, easing: 'ease-in-out' });

    // the game's Ponçik leaves at once (class perde-on), the sound of the cloth starts with the pull
    later(() => sfx('perde', { dur: PULL_MS / 1000 + .1 }), PULL_FROM);
    if (REVERANS) {
      const bow = [{ transform: 'rotate(0) scale(1,1)' }, { transform: 'rotate(13deg) translateY(3%) scale(1.05,.88)', offset: .38 }, { transform: 'rotate(13deg) translateY(3%) scale(1.05,.88)', offset: .55 }, { transform: 'rotate(-3deg) scale(.99,1.03)', offset: .85 }, { transform: 'rotate(0) scale(1,1)' }];
      later(() => { anim(body, bow, { duration: BOW_MS, easing: 'ease-in-out', fill: 'none' }); sfx('alkis'); }, T_GAP + 40);
    }
    later(() => sfx('perde', { dur: SEAL_MS / 1000 + .1, soft: true }), T_SEAL);
    later(() => { bg.style.opacity = '1'; }, T_SHUT - 20);           // the night is already there behind the shut curtain
    later(fly, T_FLY);
    return done;
  }

  const api = root.UyanbiPerde = {
    timeScale: 1,
    play, cancel, prime, ready, anchor, reverans: REVERANS, poses: METRICS, metric,
    timeline: { dress: DRESS, pullFrom: PULL_FROM, gap: T_GAP, seal: T_SEAL, shut: T_SHUT, fly: T_FLY, durak: T_FLY + DURAK_AT, end: T_END }
  };
})(window);
