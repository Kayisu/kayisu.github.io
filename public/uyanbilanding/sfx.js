/* UyanbiSfx: every sound of the site, synthesised with Web Audio (noise buffers, filters, oscillators, envelopes). No files.

   UyanbiSfx.play(name, opts) -> boolean   one sound; false when it is off, unknown or the audio context is not running yet
   UyanbiSfx.unlock()                      creates / resumes the AudioContext (the first tap, key or click does it by itself)
   UyanbiSfx.setEnabled(bool)              the site's sound switch (game.js passes its own); off = silent and stops what plays
   UyanbiSfx.enabled() -> boolean
   UyanbiSfx.stop()                        fades everything that is playing (the ending's "Yeniden oyna" calls it)
   UyanbiSfx.render(name, opts) -> Promise<AudioBuffer>   the same sound drawn with an OfflineAudioContext (measuring, tests)
   UyanbiSfx.names                         the sounds below, and UyanbiSfx.length(name, opts) their length in seconds

   Sounds: adim (n: 0|1, slippers on a wooden floor, left/right), kirp, kapi, perde (dur: seconds, soft), alkis, ucus,
   isik, sandik, kart, yildiz, ekran, gecis. All are short and soft; the master level is MASTER. The phone page has no
   game: this file works on its own and opens the context on the first user gesture. */
(function (root) {
  'use strict';
  if (root.UyanbiSfx) return;
  const MASTER = .25;

  /* ---- little helpers: every recipe draws onto any BaseAudioContext, starting at time t ---- */
  const pool = new WeakMap();
  function noiseBuffer(c) {                       // two seconds of white noise, made once per context
    let buffer = pool.get(c);
    if (!buffer) {
      buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 2), c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      pool.set(c, buffer);
    }
    return buffer;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const END = .0001;
  // attack to peak, then fall exponentially to nothing over `decay` seconds
  function pluck(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(END, t + attack + decay);
  }
  function panned(c, out, pan) {
    if (!pan || !c.createStereoPanner) return out;
    const p = c.createStereoPanner(); p.pan.value = pan; p.connect(out); return p;
  }
  // a sine (or other) tone with an optional glide
  function tone(c, out, t, { type = 'sine', f = 440, to, glide = .1, peak = .3, attack = .004, decay = .2, pan = 0 }) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + glide);
    pluck(g, t, peak, attack, decay);
    o.connect(g); g.connect(panned(c, out, pan));
    o.start(t); o.stop(t + attack + decay + .03);
  }
  // a noise burst through one filter; the filter may sweep from `f` to `to`
  function puff(c, out, t, { type = 'bandpass', f = 2000, to, q = 1, peak = .3, attack = .005, decay = .05, pan = 0, skip = 0 }) {
    const s = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuffer(c);
    flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, t);
    if (to) flt.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    pluck(g, t, peak, attack, decay);
    s.connect(flt); flt.connect(g); g.connect(panned(c, out, pan));
    s.start(t, skip % 1.5); s.stop(t + attack + decay + .03);
  }
  // a long noise bed shaped by an arbitrary envelope curve (Float32Array over `dur` seconds), filter sweeping through `freqs`
  function bed(c, out, t, dur, { freqs, q = 1, type = 'bandpass', curve, peak = .4, pan = 0 }) {
    const s = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuffer(c); s.loop = true;
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(freqs[0], t);
    const step = dur / (freqs.length - 1);
    for (let i = 1; i < freqs.length; i++) flt.frequency.exponentialRampToValueAtTime(freqs[i], t + i * step);
    g.gain.setValueAtTime(0, t);
    g.gain.setValueCurveAtTime(Float32Array.from(curve, v => v * peak), t, dur);
    s.connect(flt); flt.connect(g); g.connect(panned(c, out, pan));
    s.start(t, rnd(0, 1)); s.stop(t + dur + .02);
  }
  const bell = (k, a = .3, b = .55) => { const x = Math.min(1, Math.max(0, k)); return x < a ? Math.pow(x / a, 1.6) : Math.pow(1 - (x - a) / (1 - a), 1 + b); };
  const curveOf = (n, fn) => Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
  // an inharmonic bell/chime voice: fundamental plus partials
  function chime(c, out, t, f, peak, decay, pan = 0) {
    tone(c, out, t, { f, peak, attack: .003, decay, pan });
    tone(c, out, t, { f: f * 2.76, peak: peak * .22, attack: .002, decay: decay * .45, pan });
    tone(c, out, t, { f: f * 5.4, peak: peak * .08, attack: .002, decay: decay * .22, pan });
  }

  /* ---- the sounds. dur = length in seconds (tail included) ---- */
  const recipes = {
    // slippers on wood: a soft low thump, a low-passed scuff, a tiny knock; the two feet differ and sit left / right
    adim: { dur: .22, make(c, out, t, o) {
      const n = (o.n | 0) % 2, base = (n ? 138 : 164) * rnd(.94, 1.06), pan = n ? .22 : -.22;
      tone(c, out, t, { f: base * 1.7, to: base * .5, glide: .08, peak: .55, attack: .003, decay: .1, pan });
      puff(c, out, t, { type: 'lowpass', f: n ? 760 : 900, to: 260, q: .7, peak: .42, attack: .004, decay: .075, pan, skip: rnd(0, 1.4) });
      puff(c, out, t + .004, { type: 'bandpass', f: n ? 1500 : 1750, q: 2.2, peak: .16, attack: .002, decay: .018, pan, skip: rnd(0, 1.4) });
    } },
    // an eyelid: a short cloth "fıs"
    kirp: { dur: .24, make(c, out, t) {
      puff(c, out, t, { f: 3400, to: 1300, q: .9, peak: .85, attack: .03, decay: .12, skip: rnd(0, 1.4) });
      puff(c, out, t + .02, { type: 'highpass', f: 5200, q: .5, peak: .15, attack: .03, decay: .09, skip: rnd(0, 1.4) });
    } },
    // a wooden door: latch click, a knock of the panel, the latch letting go
    kapi: { dur: .3, make(c, out, t) {
      puff(c, out, t, { f: 2300, q: 3, peak: .6, attack: .001, decay: .014, skip: rnd(0, 1.4) });
      tone(c, out, t + .004, { f: 196, to: 120, glide: .05, peak: .5, attack: .002, decay: .075 });
      tone(c, out, t + .004, { f: 318, to: 220, glide: .04, peak: .22, attack: .002, decay: .05 });
      puff(c, out, t + .085, { f: 2900, q: 3.5, peak: .32, attack: .001, decay: .011, skip: rnd(0, 1.4) });
      tone(c, out, t + .09, { f: 150, to: 105, glide: .04, peak: .16, attack: .002, decay: .05 });
    } },
    // a curtain pulled across: a long cloth rustle that swells and fades (opts.dur seconds; opts.soft = quieter)
    perde: { dur: 1.5, len: o => o.dur || 1.5, make(c, out, t, o) {
      const d = o.dur || 1.5, k = o.soft ? .55 : 1;
      const ph = [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)];
      const wob = x => .5 + .5 * Math.abs(Math.sin(x * d * 9.5 + ph[0]) * .6 + Math.sin(x * d * 15.5 + ph[1]) * .4);
      bed(c, out, t, d, { freqs: [1100, 2500, 3100, 1500], q: .85, peak: .8 * k, curve: curveOf(Math.ceil(d * 90) + 2, x => bell(x, .35, .8) * wob(x)) });
      bed(c, out, t, d, { type: 'lowpass', freqs: [260, 320, 240], q: .6, peak: .65 * k, curve: curveOf(Math.ceil(d * 40) + 2, x => bell(x, .4, .9) * (.6 + .4 * Math.sin(x * d * 5 + ph[2]) ** 2)) });
    } },
    // applause: a swell of many tiny hand claps (60 bursts), spread left to right, plus a soft bed that glues them
    alkis: { dur: 1.35, make(c, out, t) {
      const d = 1.15, lanes = [-.55, 0, .55].map(p => panned(c, out, p));
      for (let i = 0; i < 60; i++) {
        const x = Math.pow(Math.random(), .8), at = t + x * d, level = bell(x, .28, 1.1) * rnd(.4, 1);
        puff(c, lanes[i % 3], at, { f: rnd(1300, 4200), q: rnd(.8, 2.2), peak: .95 * level + .03, attack: .002, decay: rnd(.018, .042), skip: rnd(0, 1.4) });
      }
      bed(c, out, t, d, { freqs: [2200, 2600, 2000], q: .45, peak: .3, curve: curveOf(120, x => bell(x, .3, 1.2)) });
    } },
    // a glide through the air: wind that rises and falls
    ucus: { dur: 1.7, make(c, out, t) {
      const d = 1.55;
      bed(c, out, t, d, { freqs: [260, 900, 1900, 700, 380], q: 1.15, peak: 1.0, curve: curveOf(180, x => bell(x, .45, .9)), pan: -.1 });
      bed(c, out, t, d, { freqs: [1800, 3600, 5200, 3000], q: .8, peak: .3, curve: curveOf(180, x => bell(x, .5, 1)), pan: .12 });
      tone(c, out, t + .05, { f: 420, to: 880, glide: .7, peak: .035, attack: .5, decay: .9 });
    } },
    // a bright "ting"
    isik: { dur: 1.1, make(c, out, t) { chime(c, out, t, 1760, .6, .9); } },
    // a wooden lid: a thump, a creak that glides up, then a little glitter of three sparks
    sandik: { dur: 1.0, make(c, out, t) {
      tone(c, out, t, { f: 150, to: 72, glide: .09, peak: .55, attack: .003, decay: .12 });
      puff(c, out, t, { type: 'lowpass', f: 800, to: 300, peak: .3, attack: .003, decay: .06, skip: rnd(0, 1.4) });
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(170, t + .06); o.frequency.exponentialRampToValueAtTime(270, t + .38);
      lfo.frequency.value = 23; lg.gain.value = 7; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 780; f.Q.value = 2.4;
      g.gain.setValueAtTime(0, t + .06); g.gain.linearRampToValueAtTime(.2, t + .12); g.gain.linearRampToValueAtTime(.16, t + .3); g.gain.exponentialRampToValueAtTime(END, t + .42);
      o.connect(f); f.connect(g); g.connect(out); lfo.start(t + .06); o.start(t + .06); o.stop(t + .45); lfo.stop(t + .45);
      [[2637, .46, 0], [3136, .5, .07], [3951, .56, .14]].forEach(([hz, at, p]) => tone(c, out, t + at, { f: hz, peak: .26 - p, attack: .002, decay: .3, pan: p * 2 - .1 }));
    } },
    // a card turning over: the flick, then the card landing
    kart: { dur: .26, make(c, out, t) {
      puff(c, out, t, { type: 'highpass', f: 2400, to: 6500, q: .6, peak: .42, attack: .012, decay: .065, skip: rnd(0, 1.4) });
      puff(c, out, t + .085, { f: 1500, q: 2, peak: .34, attack: .001, decay: .016, skip: rnd(0, 1.4) });
      tone(c, out, t + .085, { f: 210, to: 130, glide: .03, peak: .2, attack: .001, decay: .035 });
    } },
    // a two-note chime
    yildiz: { dur: 1.05, make(c, out, t) { chime(c, out, t, 1318.5, .5, .65, -.08); chime(c, out, t + .11, 1975.5, .55, .8, .08); } },
    // a soft tap on glass
    ekran: { dur: .1, make(c, out, t) {
      tone(c, out, t, { f: 740, to: 420, glide: .03, peak: .36, attack: .002, decay: .035 });
      puff(c, out, t, { type: 'lowpass', f: 3200, q: .6, peak: .18, attack: .001, decay: .008, skip: rnd(0, 1.4) });
    } },
    // a light breath of air between two screens
    gecis: { dur: .65, make(c, out, t) {
      bed(c, out, t, .55, { freqs: [650, 1500, 900], q: .7, peak: .75, curve: curveOf(60, x => bell(x, .4, 1)) });
    } }
  };
  const lengthOf = (name, o = {}) => { const r = recipes[name]; return r ? (r.len ? r.len(o || {}) : r.dur) + .15 : 0; };

  /* ---- the live context ---- */
  let ctx = null, master = null, on = true;
  const live = new Set();
  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = MASTER; master.connect(ctx.destination); } catch { ctx = null; }
    return ctx;
  }
  function unlock() {
    const c = ensure();
    if (c && c.state !== 'running') c.resume().catch(() => {});
    return !!c && c.state === 'running';
  }
  function stop() {
    live.forEach(bus => {
      try { bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setTargetAtTime(0, ctx.currentTime, .015); } catch {}
      setTimeout(() => { try { bus.disconnect(); } catch {} }, 160);
    });
    live.clear();
  }
  function play(name, opts) {
    const r = recipes[name];
    if (!on || !r) return false;
    const c = ensure();
    if (!c) return false;
    // a suspended context (no gesture yet) would queue the sound and burst out later: skip it and ask to resume
    if (c.state !== 'running') { c.resume().catch(() => {}); return false; }
    try {
      const bus = c.createGain(); bus.connect(master);
      r.make(c, bus, c.currentTime + .005, opts || {});
      live.add(bus);
      setTimeout(() => { live.delete(bus); try { bus.disconnect(); } catch {} }, lengthOf(name, opts) * 1000 + 100);
      return true;
    } catch { return false; }
  }
  function render(name, opts) {
    const r = recipes[name], OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!r || !OAC) return Promise.reject(new Error('no such sound: ' + name));
    const rate = 44100, off = new OAC(2, Math.ceil(rate * lengthOf(name, opts)), rate), m = off.createGain();
    m.gain.value = MASTER; m.connect(off.destination);
    r.make(off, m, .005, opts || {});
    return off.startRendering();
  }
  // the first gesture opens the context (touchstart does not count as a gesture for audio: touchend does)
  const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
  function arm() {
    if (!root.document) return;
    const first = () => { if (unlock()) GESTURES.forEach(type => root.document.removeEventListener(type, first, true)); };
    GESTURES.forEach(type => root.document.addEventListener(type, first, { capture: true, passive: true }));
  }
  arm();

  root.UyanbiSfx = {
    play, unlock, stop, render,
    setEnabled(value) { on = !!value; if (!on) stop(); },
    enabled: () => on,
    names: Object.keys(recipes),
    length: (name, opts) => lengthOf(name, opts),
    master: MASTER
  };
})(window);
