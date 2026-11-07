/* One world camera supplies room art, the mascot's ground anchor and phone crop. */
(() => {
  const game = document.getElementById('game');
  const art = document.getElementById('room-art');
  const guide = document.getElementById('guide');
  const bubble = document.getElementById('guide-message');
  let room = 'bedroom', selected = null;
  const portrait = () => matchMedia('(max-width: 600px)').matches;
  const baseLayout = () => RoomArt.layout?.(room) || { guide: { x: 850, y: 640, width: 190 }, portrait: { viewBox: [380, 180, 660, 720], guide: { x: 670, y: 640, width: 180 } } };
  function layout() {
    const data = baseLayout();
    if(room === 'balcony' && game.classList.contains('epilogue')) { data.guide = {x:innerHeight < 460 && !portrait() ? 710 : 840,y:565,width:150}; data.portrait.guide = {...data.guide}; }
    return data;
  }
  function frame() {
    const data = layout();
    const base = (portrait() ? data.portrait?.viewBox : data.defaultViewBox) || [0, 0, 1440, 900];
    return [...base];
  }

  function projection(box) {
    const rect = art.getBoundingClientRect();
    const scale = Math.max(rect.width / box[2], rect.height / box[3]);
    return { scale, x: rect.left + (rect.width - box[2] * scale) / 2 - box[0] * scale, y: rect.top + (rect.height - box[3] * scale) / 2 - box[1] * scale };
  }
  function positionGuide(box) {
    const data = layout(), anchor = portrait() ? (data.portrait?.guide || data.guide) : data.guide;
    const p = projection(box), rect = game.getBoundingClientRect();
    const width = Math.min(portrait() ? 166 : 220, Math.max(120, anchor.width * p.scale));
    const x = p.x + anchor.x * p.scale - rect.left;
    const y = p.y + anchor.y * p.scale - rect.top;
    guide.style.visibility = x < -30 || x > innerWidth + 30 ? 'hidden' : '';
    guide.style.left = `${x}px`; guide.style.top = `${y}px`; guide.style.width = `${width}px`;
    guide.style.setProperty('--actor-width', `${width}px`);
    bubble.style.top = 'auto'; bubble.style.bottom = 'calc(100% + 4px)';
    const desiredWidth = portrait() ? Math.min(230, innerWidth - 36) : 252;
    const safeLeft = 16, safeRight = portrait() ? innerWidth - 16 : innerWidth - 310;
    const left = Math.max(safeLeft, Math.min(x - desiredWidth / 2, safeRight - desiredWidth));
    bubble.style.width = `${desiredWidth}px`;
    bubble.style.left = `${left - (x - width / 2)}px`;
  }
  function positionNavigation(box = frame()) {
    const p = projection(box), rect = game.getBoundingClientRect();
    const exits = layout().exits || {};
    document.querySelectorAll('#navigation [data-room]').forEach(button => {
      const exit = exits[button.dataset.room];
      if (!exit) { button.hidden = true; return; }
      button.hidden = false;
      const [bx,by,bw,bh] = exit.bounds;
      const area = art.getBoundingClientRect();
      const left = Math.max(area.left + 4, Math.min(area.right - 52, p.x + bx * p.scale));
      const top = Math.max(area.top + 6, Math.min(area.bottom - 56, p.y + by * p.scale));
      const right = Math.max(left + 48, Math.min(area.right - 4, p.x + (bx + bw) * p.scale));
      const bottom = Math.max(top + 48, Math.min(area.bottom - 4, p.y + (by + bh) * p.scale));
      button.style.left = `${left - rect.left}px`; button.style.top = `${top - rect.top}px`;
      button.style.width = `${right - left}px`; button.style.height = `${bottom - top}px`;
      button.classList.toggle('back-route', !!exit.back);
      button.querySelector('.nav-name').textContent = (exit.back ? '↶ ' : '') + exit.label;
    });
  }
  function avoidBubbleCollisions() {
    const current = bubble.getBoundingClientRect(), actor = guide.getBoundingClientRect();
    const visible = node => node && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none';
    const obstacles = [...document.querySelectorAll('.hud, .location, .game-tools, .game-caption')]
      .filter(visible).map(node => node.getBoundingClientRect());
    const exits = [];
    const width = current.width, height = current.height;
    const clampX = x => Math.max(16, Math.min(innerWidth - width - 16, x));
    const clampY = y => Math.max(16, Math.min(innerHeight - height - 16, y));
    const navTop = exits.length ? Math.min(...exits.map(r => r.top)) : current.top;
    const candidates = [
      {x:current.left,y:current.top},
      {x:clampX(current.left),y:clampY(navTop - height - 12)},
      {x:clampX(actor.left - width - 14),y:clampY(actor.top + 4)},
      {x:16,y:clampY(actor.top - height - 14)}
    ];
    const phone = {left:portrait()?innerWidth*.5:innerWidth-330,top:innerHeight*(portrait()?.58:.29),right:innerWidth,bottom:innerHeight};
    const blocks = [...obstacles,actor,phone];
    const overlap = (c,r) => Math.max(0,Math.min(c.x+width+6,r.right)-Math.max(c.x-6,r.left))*Math.max(0,Math.min(c.y+height+6,r.bottom)-Math.max(c.y-6,r.top));
    const chosen = candidates.reduce((best,c) => blocks.reduce((sum,r)=>sum+overlap(c,r),0) < blocks.reduce((sum,r)=>sum+overlap(best,r),0) ? c : best,candidates[0]);
    bubble.style.bottom = 'auto'; bubble.style.top = `${chosen.y - actor.top}px`; bubble.style.left = `${chosen.x - actor.left}px`;
  }
  function positionPhoneControl() {
    const phone = document.querySelector('.phone');
    if (!phone) return;
    const rect = phone.getBoundingClientRect();
    game.style.setProperty('--phone-control-x',`${Math.max(90,Math.min(innerWidth-90,(rect.left+rect.right)/2))}px`);
  }
  function paint() {
    if (!art.querySelector('svg')) return;
    const box = frame();
    art.querySelector('svg').setAttribute('viewBox', box.join(' '));
    positionGuide(box); positionNavigation(box); avoidBubbleCollisions(); positionPhoneControl();
    const camera = document.querySelector('#camera-live > svg');
    if (camera) {
      if (selected) camera.setAttribute('viewBox', `${selected.x - 145} ${selected.y - 105} 290 210`);
      else {
        const cropWidth = Math.min(760, box[2] * .83), cropHeight = cropWidth * .69;
        const cx = box[0] + box[2] / 2, cy = box[1] + box[3] * .57;
        camera.setAttribute('viewBox', `${cx - cropWidth / 2} ${cy - cropHeight / 2} ${cropWidth} ${cropHeight}`);
      }
    }
  }
  window.GameScene = {
    mount(nextRoom) {
      room = nextRoom; selected = null;
      art.innerHTML = RoomArt.render(room, true);
      document.getElementById('camera-live').innerHTML = RoomArt.render(room, false);
      game.dataset.room = room;
      paint(); requestAnimationFrame(paint);
    },
    positionNavigation() { positionNavigation(); positionGuide(frame()); avoidBubbleCollisions(); },
    focusObject(node) {
      const point = node.getAttribute('transform')?.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/);
      if (point) selected = { x: Number(point[1]), y: Number(point[2]) - Number(node.querySelector('.object-hit')?.getAttribute('height') || 80) / 2 };
      paint();
    },
    refresh: paint
  };
  document.getElementById('phone-rig').addEventListener('transitionend',positionPhoneControl);
  new ResizeObserver(paint).observe(art);
  new MutationObserver(() => requestAnimationFrame(paint)).observe(game, { attributes: true, attributeFilter: ['class'] });
})();
