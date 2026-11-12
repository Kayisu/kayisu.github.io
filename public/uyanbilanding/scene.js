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
  /* In bed Ponçik stands on the blanket between the two foot bumps, close to the viewer (image fractions of
     bedroom-pov.webp; y is where his feet touch the blanket). The picture is object-fit: cover; its
     object-position (CSS) is read back so both agree. */
  const BED = { x: .5, portraitX: .546, y: .93, width: .22 };
  /* Where the mission card sits once focused, from layout alone (the rig is mid-FLIP while it moves). */
  function focusedPhoneBox() {
    const rig = document.getElementById('phone-rig'), w = rig.offsetWidth, left = rig.offsetLeft - w / 2; // in bed the card is always centred
    return { left, right: left + w, top: rig.offsetTop, bottom: rig.offsetTop + rig.offsetHeight };
  }
  function bedAnchor() {
    const img = document.getElementById('bed-pov'), rect = game.getBoundingClientRect();
    const nw = img.naturalWidth || 1600, nh = img.naturalHeight || 893;
    const scale = Math.max(rect.width / nw, rect.height / nh);
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    return { x: (rect.width - nw * scale) * px + (portrait() ? BED.portraitX : BED.x) * nw * scale, y: (rect.height - nh * scale) * py + BED.y * nh * scale, width: BED.width * nw * scale };
  }
  /* Where the phone held in the corner rests. Read only while it is at rest (not opened, not mid-FLIP), so Ponçik's
     stance never changes when the phone is opened or closed: one fixed spot per room and screen. */
  const rig = document.getElementById('phone-rig');
  let held = [];
  function heldRects() {
    if (!game.classList.contains('phone-focused') && !game.classList.contains('bed-view') && !rig.classList.contains('flip'))
      held = [game.querySelector('.phone'), document.querySelector('.phone-open-label')].map(node => node.getBoundingClientRect()).filter(r => r.width);
    return held;
  }
  const HEAD = .935; // the character box is 920:860; the bubble stands on its top edge
  function positionGuide(box) {
    const data = layout(), anchor = portrait() ? (data.portrait?.guide || data.guide) : data.guide;
    const p = projection(box), rect = game.getBoundingClientRect();
    let width = Math.min(portrait() ? 166 : 220, Math.max(120, anchor.width * p.scale));
    let x = p.x + anchor.x * p.scale - rect.left;
    let y = p.y + anchor.y * p.scale - rect.top;
    const inBed = game.classList.contains('bed-view');
    if (inBed) {
      const bed = bedAnchor();
      x = bed.x; y = bed.y; width = Math.min(portrait() ? 200 : 320, Math.max(130, bed.width));
      // Beside the mission card, never behind it: on screens where the card is centred he steps to the free side.
      if (game.classList.contains('phone-focused')) {
        const card = focusedPhoneBox(), half = width * .5 + 8, top = y - width * .93;
        if (Math.min(x + half, card.right) > Math.max(x - half, card.left) && Math.min(y, card.bottom) - Math.max(top, card.top) > 44) {
          // The right side first: the blanket is wider there, the left side is the door.
          const options = [card.right + 14 + width * .5, card.left - 14 - width * .5].filter(c => c >= half && c <= rect.width - half);
          if (options.length) x = options[0];
        }
      }
    }
    // The phone held in the corner (and its label) never covers him: if it would, he steps left of it.
    const phones = inBed ? [] : heldRects();
    phones.forEach(obstacle => {
      const body = { left: rect.left + x - width * .3, right: rect.left + x + width * .3, top: rect.top + y - width * HEAD * .93, bottom: rect.top + y };
      const hit = Math.min(body.right, obstacle.right + 22) > Math.max(body.left, obstacle.left - 22) && Math.min(body.bottom, obstacle.bottom) > Math.max(body.top, obstacle.top);
      if (hit) x = Math.max(width * .3 + 10, obstacle.left - 22 - rect.left - width * .3);
    });
    guide.style.visibility = x < -30 || x > innerWidth + 30 ? 'hidden' : '';
    guide.style.left = `${x}px`; guide.style.top = `${y}px`; guide.style.width = `${width}px`;
    guide.style.setProperty('--actor-width', `${width}px`);
    // In bed, before the mission card comes forward, the bubble also keeps clear of the phone still in the hand.
    const live = inBed && !game.classList.contains('phone-focused') ? [game.querySelector('.phone').getBoundingClientRect()].filter(r => r.width) : phones;
    placeBubble(x, y, width, live, rect);
  }
  /* The speech bubble always stands on Ponçik's head: a fixed width per screen (longer text only grows it upwards),
     centred on him, slid along only where a screen edge, the held phone or the mission card is in the way.
     Its tail stays on him wherever the bubble slides. */
  function placeBubble(x, y, width, phones, rect) {
    const W = rect.width, headTop = y - width * HEAD;
    let min = 12, max = W - 12;
    if (game.classList.contains('bed-view') && game.classList.contains('phone-focused')) {
      const card = focusedPhoneBox();
      if (x >= card.right) min = Math.max(min, card.right + 10); else if (x <= card.left) max = Math.min(max, card.left - 10);
    }
    phones.forEach(r => {
      if (r.top - rect.top >= headTop) return;
      const l = r.left - rect.left, rr = r.right - rect.left;
      if (x <= l) max = Math.min(max, l - 10); else if (x >= rr) min = Math.max(min, rr + 10);
    });
    const desired = portrait() ? Math.min(240, W - 24) : 264;
    const w = Math.max(150, Math.min(desired, max - min));
    const left = Math.max(min, Math.min(x - w / 2, max - w));
    bubble.style.top = 'auto'; bubble.style.bottom = '';
    bubble.style.width = `${w}px`;
    bubble.style.left = `${left - (x - width / 2)}px`;
    bubble.style.setProperty('--tail-x', `${Math.max(20, Math.min(w - 20, x - left))}px`);
  }
  /* Doors: each painted opening is a polygon in painting pixels, projected exactly like the cover-cropped picture.
     Only the polygon takes clicks (the button box lets them through); the label hangs from the top middle of the
     opening like a sign. A door the crop leaves off screen becomes a tab on that screen edge. */
  function doorFx(button) {
    const svg = button.querySelector('.door-fx');
    if (svg && !svg.firstChild) {
      const id = `door-${button.dataset.room}`;
      svg.innerHTML = `<defs><clipPath id="${id}-clip"><polygon class="door-shape"/></clipPath>`
        + `<radialGradient id="${id}-light" cx=".5" cy="1" r="1.1"><stop offset="0" stop-color="#fff4c8" stop-opacity=".95"/><stop offset=".42" stop-color="#ffd977" stop-opacity=".5"/><stop offset="1" stop-color="#ffb850" stop-opacity=".1"/></radialGradient>`
        + `<linearGradient id="${id}-sheen" x1="0" x2="1"><stop offset="0" stop-color="#fffbe6" stop-opacity="0"/><stop offset=".5" stop-color="#fffbe6" stop-opacity=".5"/><stop offset="1" stop-color="#fffbe6" stop-opacity="0"/></linearGradient>`
        + `</defs>`
        + `<g class="door-glow"><g clip-path="url(#${id}-clip)"><rect class="door-light" fill="url(#${id}-light)"/><rect class="door-sheen" fill="url(#${id}-sheen)"/></g></g>`
        + `<polygon class="door-edge"/><polygon class="door-hit"/>`;
    }
    return svg;
  }
  function positionNavigation(box = frame()) {
    const p = projection(box), rect = game.getBoundingClientRect(), W = rect.width, H = rect.height;
    const exits = layout().exits || {};
    document.querySelectorAll('#navigation [data-room]').forEach(button => {
      const exit = exits[button.dataset.room];
      if (!exit?.door) { button.hidden = true; return; }
      button.hidden = false;
      const name = button.querySelector('.nav-name');
      name.textContent = exit.label; button.setAttribute('aria-label', exit.label);
      const pts = exit.door.map(([px, py]) => [p.x + px * p.scale - rect.left, p.y + py * p.scale - rect.top]);
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      const L = Math.min(...xs), R = Math.max(...xs), T = Math.min(...ys), B = Math.max(...ys);
      const visible = Math.min(R, W) - Math.max(L, 0);
      const off = visible < Math.min(56, (R - L) * .5);
      button.classList.toggle('door-offscreen', off);
      if (off) {
        const side = (L + R) / 2 < W / 2 ? 'left' : 'right';
        button.dataset.side = side;
        Object.assign(button.style, { left: side === 'left' ? '0px' : 'auto', right: side === 'right' ? '0px' : 'auto', width: '', height: '', top: `${Math.max(150, Math.min(H - 150, (T + B) / 2))}px` });
        name.style.removeProperty('--label-offset'); name.style.left = ''; name.style.top = '';
        return;
      }
      delete button.dataset.side;
      Object.assign(button.style, { left: `${L}px`, right: 'auto', top: `${T}px`, width: `${R - L}px`, height: `${B - T}px` });
      const svg = doorFx(button), local = pts.map(([qx, qy]) => [qx - L, qy - T]), points = local.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ');
      svg.setAttribute('width', (R - L).toFixed(1)); svg.setAttribute('height', (B - T).toFixed(1));
      svg.querySelectorAll('.door-shape, .door-edge, .door-hit').forEach(node => node.setAttribute('points', points));
      svg.querySelectorAll('.door-light, .door-sheen').forEach(node => { node.setAttribute('height', (B - T).toFixed(1)); node.setAttribute('width', ((R - L) * (node.classList.contains('door-sheen') ? .45 : 1)).toFixed(1)); });
      // The threshold: the bottom edge of the opening (corners 3 and 4), where the light spills onto the floor (CSS ::before).
      const [br, bl] = [local[2], local[3]];
      button.style.setProperty('--sill-x', `${((br[0] + bl[0]) / 2).toFixed(1)}px`); button.style.setProperty('--sill-y', `${((br[1] + bl[1]) / 2).toFixed(1)}px`);
      button.style.setProperty('--sill-w', `${(Math.abs(br[0] - bl[0]) * 1.15).toFixed(1)}px`); button.style.setProperty('--sill-h', `${Math.max(16, (B - T) * .07).toFixed(1)}px`);
      // The sign: top middle of the opening, the same rule on every door; kept on screen when the crop cuts the door.
      const [tl, tr] = [local[0], local[1]], topX = (tl[0] + tr[0]) / 2, topY = (tl[1] + tr[1]) / 2;
      name.style.left = `${topX}px`; name.style.top = `${topY + 10}px`;
      const half = name.offsetWidth / 2, absolute = L + topX;
      const lo = Math.max(0, L) + half + 6, hi = Math.min(W, R) - half - 6;
      const target = lo <= hi ? Math.max(lo, Math.min(hi, absolute)) : Math.max(half + 8, Math.min(W - half - 8, absolute));
      name.style.setProperty('--label-offset', `${(target - absolute).toFixed(1)}px`);
    });
  }
  function paint() {
    if (!art.querySelector('svg')) return;
    const box = frame();
    art.querySelector('svg').setAttribute('viewBox', box.join(' '));
    positionGuide(box); positionNavigation(box);
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
  let mountToken = 0, warmed = false;
  window.GameScene = {
    // The previous room stays on screen until the next painting is decoded, so a slow
    // connection can delay a room change but never shows an empty scene.
    mount(nextRoom) {
      const token = ++mountToken;
      const apply = () => {
        if (token !== mountToken) return;
        room = nextRoom; selected = null;
        art.innerHTML = RoomArt.render(room, true);
        document.getElementById('camera-live').innerHTML = RoomArt.render(room, false);
        game.dataset.room = room;
        paint(); requestAnimationFrame(paint);
      };
      if (RoomArt.ready(nextRoom)) apply(); else RoomArt.load(nextRoom).then(apply);
      if (!warmed) { warmed = true; ['bedroom', 'hallway', 'kitchen', 'bathroom', 'balcony'].forEach(key => RoomArt.load(key)); }
    },
    positionNavigation() { positionNavigation(); positionGuide(frame()); },
    focusObject(node) {
      const point = node.getAttribute('transform')?.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/);
      if (point) selected = { x: Number(point[1]), y: Number(point[2]) - Number(node.querySelector('.object-hit')?.getAttribute('height') || 80) / 2 };
      paint();
    },
    refresh: paint
  };
  // In bed he slides aside when the mission card arrives; the speech bubble is placed again once he has arrived.
  guide.addEventListener('transitionend', event => { if (event.propertyName === 'left') paint(); });
  new ResizeObserver(paint).observe(art);
  new MutationObserver(() => requestAnimationFrame(paint)).observe(game, { attributes: true, attributeFilter: ['class'] });
  // Once the held phone has finished moving back into the hand, its resting place is read again.
  new MutationObserver(() => { if (!rig.classList.contains('flip')) requestAnimationFrame(paint); }).observe(rig, { attributes: true, attributeFilter: ['class'] });
})();
