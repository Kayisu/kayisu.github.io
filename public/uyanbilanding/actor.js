/* Full-body animation only. The character is never assembled with added limbs. */
(() => {
  const host = document.getElementById('poncik-actor');
  if (!host) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 598;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Ponçik, uyanık sabah rehberin');
  const image = document.createElement('img'); image.alt = 'Ponçik, uyanık sabah rehberin'; image.draggable = false;
  // Until the first animation frame is decoded the mascot is the still welcome picture, never an empty box.
  const still = document.createElement('img'); still.className = 'actor-still img-wait'; still.src = 'assets/X1.webp'; still.alt = ''; still.setAttribute('aria-hidden', 'true'); still.draggable = false;
  image.hidden = true; // the animated-image fallback only shows once it has a picture
  host.append(still, canvas, image);
  window.RoomArt?.settle?.(still);
  const markReady = () => { host.dataset.ready = '1'; };
  const ctx = canvas.getContext('2d');
  const sources = { awake:'greeting', invite:'greeting', right:'point-right', left:'point-right', down:'point-right', wrong:'refusal', success:'greeting' };
  const buffers = new Map();
  let token = 0, pose = '', decoder = null, frameId = 0, paused = false, raf = 0, elapsed = 0, previous = null, mirror = false;
  const crop = [80, 100, 920, 860];
  /* Where the body stands inside each clip (source pixels of the crop above), measured on every frame (alpha > 40): the lowest
     opaque row (the feet) and the horizontal centre of the lower half of the body. The clips are framed a few pixels apart;
     draw() shifts each one so the feet always rest on FEET and the body is centred on CENTER (the middle of the box, which is
     where the room places him), mirrored clips included: changing pose never moves or resizes him. */
  const OFFSETS = { greeting: { feet: 853, cx: 464.9 }, 'point-right': { feet: 852, cx: 461.0 }, refusal: { feet: 853, cx: 460.3 } };
  /* The same measure frame by frame (centre of the lower half of the body, source pixels): the body leans and sways inside the
     clips by up to 45 px, so a pose that starts on a swayed frame would still jump. Each frame is moved most of the way
     (PIN) towards the centre line; the rest of the sway stays, so the animation still moves. */
  const CX_FRAMES = { greeting: [460.2,460.2,460.2,460.2,460.2,460.2,460.2,460.2,460.3,460.1,459.8,459.7,459.9,461,462.1,463.8,466,470.5,477.5,485,490.6,493.8,496.2,497.9,498.9,499.3,499.6,499.4,498.3,497.2,495.9,494.3,492.9,492.3,492.4,493.6,494.8,496,497.2,497.9,498.4,498.5,498.5,498.1,497.1,496.5,495.7,494.9,494.4,494.4,494.2,494.4,494.4,494.6,494.7,494.9,494.8,494.3,493.4,491.2,487.4,482,474.6,467.2,459.8,456.4,454.9,454.6,454.6,455,455.5,456.1,456.3,456.3,456.5,456.8,457.1,457.6,458,458.5,459,459.6,460.1,460.6,460.9,461.1,461.3,461.3,461.2,461.1,461,460.9,460.6,460.4,460.2,460.2],
    'point-right': [460.5,460.5,460.5,460.5,460.5,460.5,460.5,460.6,461,462,463.3,464.4,465.4,466,466.1,466.1,466.8,468.7,469.6,470,470.7,471.2,472.1,473.1,474.4,475.6,476.3,476.6,475.8,474.1,471.5,468,463.7,459.2,454.8,450.9,447.7,445,443.3,442.5,442.2,442.3,442.2,442.4,442.4,442.4,442.4,442.4,442.5],
    refusal: [460.3,460.2,460.2,460.2,460.3,460.2,460.3,460.2,460.3,459.8,459.5,459.4,460.4,462.7,465.4,467,469.2,472.8,475.9,478.2,479.6,480.3,481,481.7,482.2,482.4,482.2,480.8,478.3,474.9,470.7,465.7,459.8,453.8,447.7,442.1,438.7,437.5,437.9,440.5,445.4,451.5,458.3,464.4,470.5,474.8,478.2,481,483,483.4,482.9,481.1,478,474.2,469.8,464.8,459.4,454.2,450,447.1,446.9,448.8,452.7,457.3,462.3,467,470.9,474.2,476.4,477.7,477,475.7,473.6,470.8,467,464.4,463.3,461.9,460.2,458.8,458.4,458.9,459.6,460.1,460.2,460.2,460.2,460.2,460.1,460.1,460.1,460.2,460.2,460.2,460.2,460.2] };
  const PIN = .8;
  const FEET = 853, CENTER = crop[2] / 2;
  let shown = -1;   // the clip frame on the canvas
  const SHIFT_OFF = { feet: FEET, cx: CENTER };
  /* The sprites themselves are cut flat at x=108 and x=972 (of 1080): where an arm reaches that edge the pixels
     are simply not in the file. The crop already contains every frame, so it is not the cause. Frames that touch
     the edge (alpha measured per frame) are never drawn; the previous clean frame is held instead. A held
     gesture ends on clean frame 41 of the pointing clip. */
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const cut = { greeting:[18,32,33,34,35,48,49,50,61,62,63,64,65], 'point-right':[...range(20,35), ...range(42,48)], refusal:[...range(35,40), 60] };
  const HELD_END = 41;
  function sequence(name, total) {
    const source = sources[name] || 'greeting', bad = new Set(cut[source] || []), held = ['right', 'left', 'down'].includes(name), out = [];
    for (let i = 0; i < total && !(held && i > HELD_END); i++) { if (!bad.has(i)) out.push(i); else if (!held && out.length) out.push(out[out.length - 1]); }
    return out;
  }
  let frames = [];
  function urlFor(name) { return `assets/poncik-${sources[name] || 'greeting'}.webp?v=5`; }
  function draw(source) {
    const o = OFFSETS[sources[pose] || 'greeting'] || SHIFT_OFF;
    const own = CX_FRAMES[sources[pose] || 'greeting']?.[shown], cx = own == null ? o.cx : o.cx + (own - o.cx) * PIN;
    const dy = FEET - o.feet, dx = CENTER - (mirror ? crop[2] - cx : cx);              // how far the body must move on screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, crop[0] - (mirror ? -dx : dx), crop[1] - dy, crop[2], crop[3], 0, 0, canvas.width, canvas.height); ctx.restore();
  }
  /* A change of pose is a short cross-fade (about 120 ms): the last picture of the old pose is copied to a second canvas that
     fades out over the new pose's first picture. Both are aligned to the same feet line and centre. */
  const ghost = document.createElement('canvas');
  ghost.width = canvas.width; ghost.height = canvas.height; ghost.hidden = true; ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  host.append(ghost);
  let ghostFade = null;
  const FADE_MS = 120;
  function snapshot() {
    ghostFade?.cancel(); ghostFade = null;
    if (host.dataset.ready !== '1' || canvas.hidden) { ghost.hidden = true; return; }
    const g = ghost.getContext('2d'); g.clearRect(0, 0, ghost.width, ghost.height); g.drawImage(canvas, 0, 0);
    ghost.style.opacity = '1'; ghost.hidden = false;
  }
  function fadeGhost() {
    if (ghost.hidden) return;
    if (!ghost.animate || reduced.matches) { ghost.hidden = true; return; }
    ghostFade?.cancel();
    const fade = ghostFade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'linear', fill: 'forwards' });
    fade.onfinish = () => { if (ghostFade === fade) { ghost.hidden = true; ghostFade = null; } };
  }
  /* Where the feet and the body centre are on screen, for the picture shown now and for the fading old one (null when none):
     { feet, cx } in client pixels, read from the pixels (the lowest opaque row, the centre of the lower half). */
  let scratch = null;
  function scan(c) {
    const w = c.width, h = c.height;
    scratch ||= Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = scratch.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, w, h); g.drawImage(c, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let top = -1, bottom = -1;
    for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { top = y; break; }
    for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { bottom = y; break; }
    if (top < 0) return null;
    const from = Math.floor(top + (bottom - top) * .55); let sum = 0, n = 0;
    for (let y = from; y <= bottom; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { sum += x; n++; }
    return { bottom, cx: sum / n };
  }
  function probe() {
    const r = host.getBoundingClientRect(), at = s => s && { feet: r.top + (s.bottom + 1) / canvas.height * r.height, cx: r.left + s.cx / canvas.width * r.width };
    return { now: at(scan(canvas)), old: ghost.hidden ? null : at(scan(ghost)), pose, box: { left: r.left, top: r.top, width: r.width, height: r.height } };
  }
  async function paintFrame(index, visit) {
    if (!decoder || visit !== token) return;
    const current = decoder;
    try {
      const result = await current.decode({ frameIndex:index });
      if (visit === token && current === decoder) { shown = index; draw(result.image); markReady(); }
      result.image.close();
    } catch {}
  }
  function tick(now) {
    raf = 0;
    if (paused || reduced.matches || !decoder) { previous = null; return; }
    if (previous !== null) elapsed += now - previous;
    previous = now;
    const last = frames.length - 1;
    const index = Math.min(last, Math.floor(elapsed / (1000 / 24)));
    if (index !== frameId) { frameId = index; paintFrame(frames[index], token); }
    if (index < last) raf = requestAnimationFrame(tick);
  }
  async function setPose(name) {
    if (name === pose) return;
    pose = name; host.dataset.pose = name; delete host.dataset.frozenFallback; mirror = name === 'left' || name === 'down';
    snapshot();
    const visit = ++token; cancelAnimationFrame(raf); previous = null; elapsed = 0; frameId = -1;
    decoder?.close(); decoder = null;
    const url = reduced.matches && ['right','left','down'].includes(name) ? 'assets/poncik-point-right-still.png' : urlFor(name);
    try {
      if (url.endsWith('.png') || !('ImageDecoder' in window) || !await ImageDecoder.isTypeSupported('image/webp')) throw new Error('native image fallback');
      if (!buffers.has(url)) buffers.set(url, fetch(url).then(response => { if (!response.ok) throw new Error('animation unavailable'); return response.arrayBuffer(); }));
      const data = await buffers.get(url);
      if (visit !== token) return;
      decoder = new ImageDecoder({ data:data.slice(0), type:'image/webp', preferAnimation:true });
      await decoder.tracks.ready;
      if (visit !== token) return;
      image.hidden = true; canvas.hidden = false;
      frames = sequence(name, decoder.tracks.selectedTrack?.frameCount || 96);
      const still = name === 'awake' ? 0 : frames[Math.min(35, frames.length - 1)];
      await paintFrame(reduced.matches ? still : 0, visit);
      fadeGhost();
      frameId = 0;
      if (!paused && !reduced.matches) raf = requestAnimationFrame(tick);
    } catch {
      if (visit !== token) return;
      canvas.hidden = true;
      image.onload = () => {
        if (visit !== token || (!paused && !reduced.matches)) return;
        shown = -1; draw(image); image.hidden = true; canvas.hidden = false; markReady(); fadeGhost();
        if (paused) host.dataset.frozenFallback = 'true';
      };
      image.style.transform = mirror ? 'scaleX(-1)' : '';
      try {
        if (!buffers.has(url)) buffers.set(url, fetch(url).then(response => response.arrayBuffer()));
        const data = await buffers.get(url);
        if (visit !== token) return;
        const blob = URL.createObjectURL(new Blob([data], {type:url.endsWith('.png') ? 'image/png' : 'image/webp'}));
        const previousUrl = image.dataset.blob; image.src = blob; image.dataset.blob = blob; image.hidden = false;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      } catch { image.src = url; image.hidden = false; }
      const SOURCE = 1080; // the fallback <img> shows the same crop as the canvas
      Object.assign(image.style, { position:'absolute', width:`${SOURCE / crop[2] * 100}%`, height:`${SOURCE / crop[3] * 100}%`, left:`${-crop[0] / crop[2] * 100}%`, top:`${-crop[1] / crop[3] * 100}%` });
    }
  }
  function setPaused(value) {
    paused = !!value; previous = null;
    if (paused) {
      cancelAnimationFrame(raf); raf = 0;
      if (!image.hidden && image.complete && image.naturalWidth) { draw(image); image.hidden = true; canvas.hidden = false; host.dataset.frozenFallback = 'true'; }
    } else if (host.dataset.frozenFallback) { image.hidden = false; canvas.hidden = true; delete host.dataset.frozenFallback; }
    else if (decoder && !raf && !reduced.matches) raf = requestAnimationFrame(tick);
  }
  window.PoncikActor = { setPose, setPaused, probe, offsets: OFFSETS };
  reduced.addEventListener('change', () => { const current = pose; pose = ''; setPose(current || 'awake'); });
  // The 4 MB greeting waits until the page has finished loading; the welcome screen uses a still image.
  // It also waits for the pictures the first screens need, so on a slow line it never starves them.
  const begin = () => { if (!pose) setPose('awake'); };
  const early = () => Promise.all([window.RoomArt?.load?.('bedPov'), window.RoomArt?.load?.('bedroom')]).catch(() => {}).then(() => setTimeout(begin, 400));
  if (document.readyState === 'complete') early(); else addEventListener('load', early, { once: true });
})();
