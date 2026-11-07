/* Full-body animation only. The character is never assembled with added limbs. */
(() => {
  const host = document.getElementById('poncik-actor');
  if (!host) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 598;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Ponçik, uyanık sabah rehberin');
  const image = document.createElement('img'); image.alt = 'Ponçik, uyanık sabah rehberin'; image.draggable = false;
  host.append(canvas, image);
  const ctx = canvas.getContext('2d');
  const sources = { awake:'greeting', invite:'greeting', right:'point-right', left:'point-right', down:'point-right', wrong:'refusal', success:'greeting' };
  const buffers = new Map();
  let token = 0, pose = '', decoder = null, frameId = 0, paused = false, raf = 0, elapsed = 0, previous = null, mirror = false;
  const crop = [80, 100, 920, 860];
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
      if (visit === token && current === decoder) draw(result.image);
      result.image.close();
    } catch {}
  }
  function tick(now) {
    raf = 0;
    if (paused || reduced.matches || !decoder) { previous = null; return; }
    if (previous !== null) elapsed += now - previous;
    previous = now;
    const total = decoder.tracks.selectedTrack?.frameCount || 96;
    const heldGesture = ['right', 'left', 'down'].includes(pose);
    const last = heldGesture ? Math.min(48, total - 1) : total - 1;
    const index = Math.min(last, Math.floor(elapsed / (1000 / 24)));
    if (index !== frameId) { frameId = index; paintFrame(index, token); }
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
      const still = name === 'awake' ? 0 : Math.min(35, (decoder.tracks.selectedTrack?.frameCount || 96) - 1);
      await paintFrame(reduced.matches ? still : 0, visit);
      frameId = 0;
      if (!paused && !reduced.matches) raf = requestAnimationFrame(tick);
    } catch {
      if (visit !== token) return;
      canvas.hidden = true; image.hidden = false;
      image.onload = () => {
        if (visit !== token || (!paused && !reduced.matches)) return;
        draw(image); image.hidden = true; canvas.hidden = false;
        if (paused) host.dataset.frozenFallback = 'true';
      };
      image.style.transform = mirror ? 'scaleX(-1)' : '';
      try {
        if (!buffers.has(url)) buffers.set(url, fetch(url).then(response => response.arrayBuffer()));
        const data = await buffers.get(url);
        if (visit !== token) return;
        const blob = URL.createObjectURL(new Blob([data], {type:url.endsWith('.png') ? 'image/png' : 'image/webp'}));
        const previousUrl = image.dataset.blob; image.src = blob; image.dataset.blob = blob;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      } catch { image.src = url; }
      image.style.width = '117.4%'; image.style.height = '125.6%'; image.style.position = 'absolute'; image.style.left = '-8.7%'; image.style.top = '-11.63%';
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
  setPose('awake');
})();
