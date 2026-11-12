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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, ...crop, 0, 0, canvas.width, canvas.height); ctx.restore();
  }
  async function paintFrame(index, visit) {
    if (!decoder || visit !== token) return;
    const current = decoder;
    try {
      const result = await current.decode({ frameIndex:index });
      if (visit === token && current === decoder) { draw(result.image); markReady(); }
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
      frameId = 0;
      if (!paused && !reduced.matches) raf = requestAnimationFrame(tick);
    } catch {
      if (visit !== token) return;
      canvas.hidden = true;
      image.onload = () => {
        if (visit !== token || (!paused && !reduced.matches)) return;
        draw(image); image.hidden = true; canvas.hidden = false; markReady();
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
  window.PoncikActor = { setPose, setPaused };
  reduced.addEventListener('change', () => { const current = pose; pose = ''; setPose(current || 'awake'); });
  // The 4 MB greeting waits until the page has finished loading; the welcome screen uses a still image.
  // It also waits for the pictures the first screens need, so on a slow line it never starves them.
  const begin = () => { if (!pose) setPose('awake'); };
  const early = () => Promise.all([window.RoomArt?.load?.('bedPov'), window.RoomArt?.load?.('bedroom')]).catch(() => {}).then(() => setTimeout(begin, 400));
  if (document.readyState === 'complete') early(); else addEventListener('load', early, { once: true });
})();
