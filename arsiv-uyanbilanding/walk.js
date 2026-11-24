/* UyanbiWalk: "two steps toward the door, one blink, the room changes" as a small shared module (walk.css holds the eyelids).
   The camera walks to the clicked door: every step pushes the picture in about the door (translate/scale only) with a
   small head bob, Ponçik walks ahead of it and gets a little smaller, a soft "tık" marks each step; then a single
   blink: the lids close, change() runs while they are shut, the lids open and the new room settles in from slightly
   close up, as if one had stepped through.

   UyanbiWalk.go(change, { stage, door, actor, fade, back = false, ready, sound, onStep }) -> Promise<void>
     change   called while the eyes are shut (at once when back is true)
     stage    the layers of the world that the camera pushes in: an Element, an array or a NodeList (picture, doors, light).
              The first one is the picture: its box is the screen the camera works in. Without it only the lids are used.
     door     the opening to walk to: an Element or a rect ({left, top, width, height}, client pixels). It is the pivot of
              the push and sets how far it goes (the door ends up filling about 78% of the picture's height, 1.6x to 1.9x).
              Default: the middle of the picture.
     actor    Ponçik's element (anchored at his feet: left/top is the ground point, translate(-50%,-100%) centres it). He
              walks to the door on his own track, smaller as he goes. Not part of stage.
     fade     elements that fade out while the camera walks (speech bubble, door signs)
     back     true: no steps, no blink, change() runs now
     ready    a Promise; the lids stay shut until it settles, 1500 ms at most
     sound    false = silent; default = the footstep of UyanbiSfx ('adim'). Games with their own mute switch pass false and
              play UyanbiWalk.tick(ctx, n) themselves from onStep.
     onStep   onStep(n, total) at the moment each foot lands (n = 1, 2)
   UyanbiWalk.blink(change, { stage, ready }) -> Promise<void>   only the blink (getting out of bed and the like): lids and a gentle arrival
   UyanbiWalk.busy() -> boolean      a transition is running or queued
   UyanbiWalk.cancel()               drops everything at once: change() is not called if it has not run yet
   UyanbiWalk.tick(ctx, n)           one footstep sound (UyanbiSfx 'adim'; ctx is ignored)
   UyanbiWalk.timeScale              1; a larger number slows every duration (for looking at frames)
   Ponçik never pops into a room: after a walk he is seen in front of the camera (bottom middle, a little larger, as if he had
   gone through the door first) and walks to his place in two hopping steps, settling to his normal size in about 650 ms
   (the room settles in 450); fade elements (his speech bubble, the door signs) come back as he arrives.
   UyanbiWalk.enter(actor)          going back (no walk, no blink): he slides in from the nearest side edge to his place (420 ms)
   Time: 2 x 650 ms of steps + 200 close + about 90 shut + 450 open and arrival = about 2.0 s. Reduced motion: no push,
   no bounce, a short dark (2 x 200 ms of steps, 120 in, 200 out).

   A second go() while one runs is queued, never dropped: its change() always runs, in order. */
(function (root) {
  'use strict';
  if (!root.document || root.UyanbiWalk) return;
  const doc = root.document;
  const STEP = 650, CLOSE = 200, OPEN = 320, ARRIVE = 450, HOLD = 70, READY_MAX = 1500;   // ms (OPEN: the lids, ARRIVE: the room settling)
  const FILL = .78, ZOOM_MIN = 1.6, ZOOM_MAX = 1.9;                  // the door's share of the picture height at the last step; the zoom is kept between these
  const FIRST_STEP = .42;                                            // share of the push done by the first step
  const ARRIVE_ZOOM = 1.08, BLINK_ZOOM = 1.018;                      // the new room starts this close up
const ACTOR_ARRIVE = 650, ACTOR_HOPS = 2, ACTOR_START = 1.45;      // Ponçik got through the door before the camera: he is in front of it (bottom middle, 1.45x) and hops to his place in 650 ms
const ENTER_MS = 420;                                              // going back: he slides in from the nearest side edge
  const SAMPLES = 22;                                                // keyframes per step
  const STEP_QUIET = 200, FADE_IN = 120, FADE_OUT = 200;             // reduced motion: no sway, a short dark instead of lids
  const LIFT = .3, LAND = .58;                                       // where in a step the foot rises / lands (0..1)
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canAnimate = typeof Element !== 'undefined' && !!Element.prototype.animate;

  /* ---- sound: the footstep lives in sfx.js (UyanbiSfx 'adim': slippers on wood, left/right). tick(ctx, n, out) keeps the old
     signature; the context argument is no longer needed, the sound is UyanbiSfx's own and follows its on/off switch ---- */
  function tick(ctx, n = 0) { try { root.UyanbiSfx?.play('adim', { n }); } catch {} }
  const ownTick = n => tick(null, n);

  /* ---- the eyelid layer: one fixed, full-screen element of its own ---- */
  let layer = null, lidTop = null, lidBottom = null;
  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = doc.createElement('div');
    layer.className = 'uw'; layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<i class="uw-lid uw-top"></i><i class="uw-lid uw-bottom"></i>';
    lidTop = layer.firstChild; lidBottom = layer.lastChild;
    doc.body.append(layer);
    return layer;
  }

  /* ---- the stage: elements that sway about one shared pivot (the centre of the first one) ---- */
  function collect(stage) {
    if (!stage) return [];
    const list = stage.nodeType === 1 ? [stage] : Array.from(stage);
    return list.filter(el => el && el.nodeType === 1 && el.isConnected);
  }
  /* scale/translate are the individual transform properties: they stack on top of an element's own `transform`
     (the guide centres itself with one) instead of replacing it. The pivot of the scale is the transform-origin
     measured from each element's own layout box, so every layer scales about the same point of the screen. */
  function pivots(els, point) {
    if (!els.length) return [];
    let px, py;
    if (point) { px = point.x; py = point.y; }
    else { const first = els[0].getBoundingClientRect(); px = first.left + first.width / 2; py = first.top + first.height / 2; }
    return els.map(el => {
      const parent = el.offsetParent;
      if (!parent) return '50% 50%';
      const box = parent.getBoundingClientRect();
      const left = box.left + parent.clientLeft + el.offsetLeft - parent.scrollLeft, top = box.top + parent.clientTop + el.offsetTop - parent.scrollTop;
      return `${(px - left).toFixed(1)}px ${(py - top).toFixed(1)}px`;
    });
  }
  const rectOf = target => {
    if (!target) return null;
    const r = typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target;
    return r && Number.isFinite(r.left) && Number.isFinite(r.top) ? { left: r.left, top: r.top, width: r.width || 0, height: r.height || 0 } : null;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let generation = 0, pending = 0, tail = Promise.resolve(), active = null;
  const scale = () => Math.max(.1, Number(api.timeScale) || 1);

  function startRun(kind) {
    const run = { kind, cancelled: false, waits: new Set(), timers: new Set(), anims: new Set() };
    // A wait ends on time or when the run is cancelled; wait.release() ends it early.
    run.wait = ms => {
      let release = () => {};
      const promise = new Promise(resolve => {
        if (run.cancelled) { resolve(); return; }
        const done = () => { clearTimeout(timer); run.waits.delete(done); resolve(); };
        const timer = setTimeout(done, ms * scale());
        run.waits.add(done); release = done;
      });
      promise.release = () => release();
      return promise;
    };
    run.later = (fn, ms) => { const timer = setTimeout(() => { run.timers.delete(timer); if (!run.cancelled) fn(); }, ms * scale()); run.timers.add(timer); };
    run.animate = (el, keyframes, options) => {
      if (!canAnimate || !el) return null;
      const animation = el.animate(keyframes, options);
      run.anims.add(animation);
      return animation;
    };
    run.drop = animation => { if (animation) { animation.cancel(); run.anims.delete(animation); } };
    run.stop = () => {
      run.cancelled = true;
      run.timers.forEach(clearTimeout); run.timers.clear();
      [...run.waits].forEach(done => done());
      run.anims.forEach(animation => { try { animation.cancel(); } catch {} }); run.anims.clear();
      if (layer) { layer.classList.remove('on', 'dark'); }
    };
    active = run;
    return run;
  }
  function endRun(run) {
    run.anims.forEach(animation => { try { animation.cancel(); } catch {} }); run.anims.clear();
    if (layer) layer.classList.remove('on', 'dark');
    if (active === run) active = null;
  }
  const frames = n => new Promise(resolve => { const next = k => (k ? requestAnimationFrame(() => next(k - 1)) : resolve()); (root.requestAnimationFrame ? next(n) : resolve()); });

  /* The camera walk. Two steps are one continuous animation per layer, sampled so that every step pushes forward in a
     pulse, dips at the footfall and lifts again. The picture, the doors and the light scale about the door (a screen
     point, so the door stays where it is and swells); a share of the way to the middle of the screen is added as a pan.
     The bob and the pan are clamped to what the zoom has already uncovered, so no edge of the picture ever shows.
     Ponçik is not scaled with the world: his feet are the origin of his scale, so he walks his own track toward the
     door sill (translate = where his feet are now minus where they stood), smaller the farther he goes. */
  function cameraPlan(els, actor, door, ms) {
    const base = els[0].getBoundingClientRect(), W = base.width || 1, H = base.height || 1;
    const rect = rectOf(door), hasDoor = rect && (rect.width || rect.height);
    const dx = hasDoor ? rect.left + rect.width / 2 : base.left + W / 2, dy = hasDoor ? rect.top + rect.height / 2 : base.top + H * .55;
    const doorH = hasDoor && rect.height > 4 ? rect.height : H * .5;
    const D = { x: dx - base.left, y: dy - base.top };                       // pivot, in the picture's own box
    const S = clamp(FILL * H / doorH, ZOOM_MIN, ZOOM_MAX);                  // zoom at the last step
    const pan = { x: (W / 2 - D.x) * .55, y: (H * .52 - D.y) * .55 };
    const amp = clamp(H * .014, 6, 14), TAU = Math.PI * 2;
    const dip = k => { const c0 = Math.cos(TAU * LAND), c = Math.cos(TAU * (k - LAND)); return (c - c0) / (1 - c0); };  // 0 .. 1 (down) .. 0
    const pulse = (k, strength) => k - strength * Math.sin(TAU * k) / TAU;                   // 0..1, quick at the footfall
    const share = (i, k) => (i ? FIRST_STEP + (1 - FIRST_STEP) * pulse(k, .55) : FIRST_STEP * pulse(k, .55));
    // Ponçik's track is drawn on the screen, not in the world: from where his feet stand to the doorstep as it looks at the
    // last step (the camera has swollen the door and brought it to the middle), stopping just short of it.
    let F0 = null, target = null, aw = 0;
    if (actor) {
      const a = actor.getBoundingClientRect();
      aw = a.width; F0 = { x: a.left + a.width / 2 - base.left, y: a.bottom - base.top };
      const sill = hasDoor ? rect.top + rect.height - base.top : D.y + H * .2;
      const end = { x: D.x + pan.x, y: Math.min(H * .94, D.y + S * (sill - D.y) + pan.y) };
      target = { x: F0.x + (end.x - F0.x) * .92, y: F0.y + (end.y - F0.y) * .92 };
    }
    const bounds = s => ({ x0: -(s - 1) * (W - D.x), x1: (s - 1) * D.x, y0: -(s - 1) * (H - D.y), y1: (s - 1) * D.y });
    const world = [], hero = [];
    for (let i = 0; i < 2; i++) for (let n = (i ? 1 : 0); n <= SAMPLES; n++) {
      const k = n / SAMPLES, f = share(i, k), s = Math.pow(S, f), offset = (i * SAMPLES + n) / (2 * SAMPLES);
      const side = (i % 2 ? 1 : -1) * Math.sin(Math.PI * k) * amp * .35;
      const lim = bounds(s);
      const t = { x: clamp(pan.x * f + side, lim.x0, lim.x1), y: clamp(pan.y * f + amp * dip(k), lim.y0, lim.y1) };
      world.push({ offset, scale: +s.toFixed(4), translate: `${t.x.toFixed(1)}px ${t.y.toFixed(1)}px` });
      if (F0) {
        const wf = i ? FIRST_STEP + (1 - FIRST_STEP) * pulse(k, .8) : FIRST_STEP * pulse(k, .8), shrink = 1 - .3 * wf;
        const hop = aw * .07 * 4 * k * (1 - k) * s * shrink;
        const feet = { x: F0.x + (target.x - F0.x) * wf + side, y: F0.y + (target.y - F0.y) * wf + amp * .6 * dip(k) - hop };
        hero.push({ offset, scale: +(s * shrink).toFixed(4), translate: `${(feet.x - F0.x).toFixed(1)}px ${(feet.y - F0.y).toFixed(1)}px` });
      }
    }
    return { world, hero, S, point: { x: dx, y: dy } };
  }
  function walkCamera(run, els, actor, door, fade, ms) {
    const plan = cameraPlan(els, actor, door, ms), origins = pivots(els, plan.point), options = { duration: 2 * ms * scale(), easing: 'linear', fill: 'forwards' };
    const anims = [];
    els.forEach((el, i) => anims.push(run.animate(el, plan.world.map(f => ({ ...f, transformOrigin: origins[i] })), options)));
    if (actor && plan.hero.length) anims.push(run.animate(actor, plan.hero.map(f => ({ ...f, transformOrigin: '0px 0px' })), options));
    fade.forEach(el => anims.push(run.animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 * scale(), easing: 'ease-in', fill: 'forwards' })));
    return anims.filter(Boolean);
  }

  function lidsClose(run, quiet) {
    const shell = ensureLayer();
    shell.classList.toggle('dark', quiet); shell.classList.add('on');
    if (quiet) { run.animate(shell, [{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN * scale(), easing: 'linear', fill: 'forwards' }); return FADE_IN; }
    const options = { duration: CLOSE * scale(), easing: 'cubic-bezier(.55,0,.8,.4)', fill: 'forwards' };
    run.animate(lidTop, [{ transform: 'translateY(-110%)' }, { transform: 'none' }], options);
    run.animate(lidBottom, [{ transform: 'translateY(110%)' }, { transform: 'none' }], options);
    return CLOSE;
  }
  function lidsOpen(run, quiet) {
    run.anims.forEach(animation => run.drop(animation));
    if (quiet) { run.animate(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT * scale(), easing: 'linear', fill: 'forwards' }); return FADE_OUT; }
    const options = { duration: OPEN * scale(), easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' };
    run.animate(lidTop, [{ transform: 'none' }, { transform: 'translateY(-110%)' }], options);
    run.animate(lidBottom, [{ transform: 'none' }, { transform: 'translateY(110%)' }], options);
    return OPEN;
  }
  /* The new room settles in as the lids open: it starts a little close up and eases back to its size (a walk: 1.08x, as if
     one had stepped through; a plain blink: barely), with a slight blur that clears (added to any filter the layer
     already has). Ponçik is on the same screen: his feet are the origin of his own scale, moved to where the zoom puts them. */
  function arrival(run, els, actor, kind, fade = []) {
    const walking = kind === 'walk', zoom = walking ? ARRIVE_ZOOM : BLINK_ZOOM, ms = walking ? ARRIVE : OPEN;
    const options = { duration: ms * scale(), easing: 'cubic-bezier(.2,.7,.25,1)' };
    const base = els.length ? els[0].getBoundingClientRect() : null;
    const centre = base ? { x: base.left + base.width / 2, y: base.top + base.height / 2 } : null;
    const origins = pivots(els, centre);
    els.forEach((el, i) => {
      run.animate(el, [{ filter: `blur(${walking ? 4 : 6}px)` }, { filter: 'blur(0px)' }], { ...options, easing: 'ease-out', composite: 'add' });
      run.animate(el, [{ scale: zoom, transformOrigin: origins[i] }, { scale: 1, transformOrigin: origins[i] }], options);
    });
    if (actor && centre && walking) {
      // Walk in from the front: bottom middle of the picture, larger, two hops (his feet are the origin of his scale).
      const a = actor.getBoundingClientRect(), fx = a.left + a.width / 2, fy = a.bottom, x0 = base.left + base.width / 2, y0 = base.top + base.height * .985;
      const N = 26, hop = a.width * .09, ease = k => 1 - Math.pow(1 - k, 2.1), keys = [];
      for (let i = 0; i <= N; i++) {
        const k = i / N, p = ease(k), s = 1 + (ACTOR_START - 1) * (1 - p);
        const lift = hop * Math.pow(Math.abs(Math.sin(Math.PI * ACTOR_HOPS * k)), 1.5) * (1 - .4 * k) * s;   // soft landing: no speed at the floor
        keys.push({ offset: k, scale: +s.toFixed(4), translate: `${((x0 - fx) * (1 - p)).toFixed(1)}px ${((y0 - fy) * (1 - p) - lift).toFixed(1)}px`, transformOrigin: '0px 0px' });
      }
      run.animate(actor, keys, { duration: ACTOR_ARRIVE * scale(), easing: 'linear' });
      fade.forEach(el => run.animate(el, [{ opacity: 0 }, { opacity: 0, offset: .6 }, { opacity: 1 }], { duration: ACTOR_ARRIVE * scale(), easing: 'ease-out' }));
      return ACTOR_ARRIVE;
    }
    if (actor && centre) {
      const a = actor.getBoundingClientRect(), fx = a.left + a.width / 2, fy = a.bottom;
      run.animate(actor, [
        { scale: zoom, translate: `${((zoom - 1) * (fx - centre.x)).toFixed(1)}px ${((zoom - 1) * (fy - centre.y)).toFixed(1)}px`, transformOrigin: '0px 0px' },
        { scale: 1, translate: '0px 0px', transformOrigin: '0px 0px' }], options);
    }
    return ms;
  }
  /* Going back: no steps, no blink. In the new room he comes in from the nearest side edge to his place with a short slide. */
  let slide = null;
  function enter(target) {
    const el = collect(target)[0];
    slide?.cancel(); slide = null;
    if (!el || reduced() || !canAnimate) return;
    const a = el.getBoundingClientRect(), W = root.innerWidth || doc.documentElement.clientWidth, cx = a.left + a.width / 2;
    const from = cx < W / 2 ? -(a.right + 8) : (W - a.left) + 8;
    const anim = slide = el.animate([{ translate: `${from.toFixed(1)}px 0px` }, { translate: '0px 0px' }], { duration: ENTER_MS * scale(), easing: 'cubic-bezier(.2,.8,.25,1)' });
    anim.onfinish = anim.oncancel = () => { if (slide === anim) slide = null; };
  }

  async function transition(run, change, o, steps) {
    const quiet = reduced(), els = collect(o.stage), actor = collect(o.actor)[0] || null, fade = collect(o.fade);
    const stepMs = quiet ? STEP_QUIET : STEP;
    const ready = Promise.resolve(o.ready).then(() => {}, () => {});
    ensureLayer().dataset.kind = run.kind;   // 'walk' or 'blink'
    let walking = [];
    if (!quiet && steps && els.length) walking = walkCamera(run, els, actor, o.door, fade, stepMs);
    for (let i = 0; i < steps; i++) {
      run.later(() => {
        if (typeof o.onStep === 'function') { try { o.onStep(i + 1, steps); } catch (e) { console.error(e); } }
        if (o.sound !== false) ownTick(i);
      }, stepMs * LAND);
      await run.wait(stepMs);
      if (run.cancelled) return;
    }
    const closeMs = lidsClose(run, quiet);
    await run.wait(closeMs);
    if (run.cancelled) return;
    // Behind the lids: the walk stops where it is, the new place takes over.
    walking.forEach(animation => run.drop(animation)); walking = [];
    try { change(); } catch (e) { console.error(e); }
    const limit = run.wait(READY_MAX), hold = run.wait(quiet ? 0 : HOLD);
    await Promise.race([ready, limit]); limit.release(); await hold;
    if (run.cancelled) return;
    const paint = run.wait(80);   // a hidden tab never fires animation frames: do not wait for them forever
    await Promise.race([frames(2), paint]); paint.release();
    if (run.cancelled) return;
    const lidMs = lidsOpen(run, quiet);
    // A plain blink keeps its own picture-and-Ponçik list as one stage; a walk keeps Ponçik apart.
    const settle = quiet ? 0 : arrival(run, els, actor, run.kind, fade);
    await run.wait(Math.max(lidMs, settle));
  }
  function schedule(change, o, steps, kind) {
    const mine = generation;
    pending++;
    const job = tail.then(async () => {
      if (mine !== generation) return;
      const run = startRun(kind);
      // change() runs exactly once, whatever goes wrong on the way: the caller's state has already moved on.
      let changed = false;
      const once = () => { if (!changed) { changed = true; change(); } };
      try { await transition(run, once, o, steps); } catch (e) { console.error(e); } finally { endRun(run); }
      if (!changed && !run.cancelled) { try { once(); } catch (e) { console.error(e); } }
    });
    tail = job.catch(() => {});
    return job.finally(() => { pending--; });
  }

  const api = root.UyanbiWalk = {
    timeScale: 1,
    tick,
    busy: () => pending > 0,
    go(change, { stage, door, actor, fade, back = false, ready, sound, onStep } = {}) {
      if (back) {
        if (!pending) { try { change(); return Promise.resolve(); } catch (e) { return Promise.reject(e); } }
        const mine = generation;
        pending++;
        const job = tail.then(() => { if (mine === generation) change(); });
        tail = job.catch(() => {});
        return job.finally(() => { pending--; });
      }
      return schedule(change, { stage, door, actor, fade, ready, sound, onStep }, 2, 'walk');
    },
    blink(change, { stage, ready } = {}) {
      return schedule(change, { stage, ready, sound: false }, 0, 'blink');
    },
    enter,
    cancel() {
      generation++;
      slide?.cancel(); slide = null;
      if (active) { const run = active; run.stop(); }
    }
  };
})(window);
