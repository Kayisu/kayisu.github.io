/* Google Flow paintings are the environment. SVG only positions interaction
 * regions and lets the phone crop the exact same image as the room camera. */
(() => {
  'use strict';
  const W = 1376, H = 768;
    /* Doors are the painted openings, as polygons in painting pixels (corners measured on the 1376x768 art).
     Only forward doors live in the picture; the way back is the top-left HUD button (game.js). */
  const rooms = {
    bedroom: {
      name: 'Yatak odası', exits:{hallway:{label:'Koridor',door:[[921,132],[1079,132],[1079,466],[921,460]]}}, guide: {x:790,y:610,width:190}, portrait:[300,70,840,698], portraitGuide:{x:808,y:512,width:120},
      objects: [
        ['book','Kitap',607,399,100,52],
        ['bottle','Su şişesi',356,405,48,88],
        ['shoe','Terlik',245,704,142,70]
      ]
    },
    hallway: {
      name:'Koridor', exits:{bathroom:{label:'Banyo',door:[[418,133],[549,133],[549,462],[418,462]]},kitchen:{label:'Mutfak',door:[[920,129],[1080,129],[1080,463],[920,462]]},balcony:{label:'Balkon',door:[[681,181],[790,181],[790,400],[681,400]]}}, guide:{x:850,y:680,width:188}, portrait:[300,70,840,698], portraitGuide:{x:808,y:512,width:120},
      objects:[['book','Kitap',242,493,126,60]]
    },
    kitchen: {
      name:'Mutfak',exits:{},guide:{x:900,y:615,width:170},portrait:[230,70,840,698],portraitGuide:{x:738,y:512,width:120},
      objects:[['mug','Kupa',611,512,106,90],['apple','Elma',503,497,76,76],['bottle','Su şişesi',827,321,52,90]]
    },
    bathroom:{
      name:'Banyo',exits:{},guide:{x:850,y:620,width:185},portrait:[220,70,840,698],portraitGuide:{x:728,y:512,width:120},
      objects:[['toothbrush','Diş fırçası',334,416,56,88],['bottle','Su şişesi',541,404,54,96]]
    },
    balcony:{
      name:'Balkon',exits:{},guide:{x:840,y:660,width:192},portrait:[300,70,840,698],portraitGuide:{x:808,y:512,width:120},
      objects:[['apple','Elma',255,507,74,72]]
    }
  };
  function target([id,name,x,y,w,h]) {
    return `<g data-object="${id}" role="button" tabindex="0" aria-pressed="false" aria-label="${name}, taramak için seç" transform="translate(${x} ${y})"><rect class="object-hit" x="${-w/2}" y="${-h}" width="${w}" height="${h}" rx="12"/><path class="object-reticle" d="M${-w/2} ${-h+12}v-12h12 M${w/2-12} ${-h}h12v12 M${w/2} -12v12h-12 M${-w/2+12} 0h-12v-12"/><g class="object-tooltip" transform="translate(0 ${-h-10})"><rect x="-68" y="-25" width="136" height="32" rx="12" fill="#fffaf0" stroke="#8b6f8b"/><text text-anchor="middle" y="-4" fill="#493455" font-size="14">${name}</text></g></g>`;
  }
  /* Room paintings are fetched once into blob URLs. A room mount then never waits
     on the network or HTTP cache, and the scene keeps the old room until the next one is ready. */
  const blobs = new Map(), inflight = new Map();
  const files = { bedPov: 'assets/rooms/bedroom-pov.webp' }; // the view from the bed, not a room of the house
  const known = key => !!(rooms[key] || files[key]);
  const pathFor = key => files[key] || `assets/rooms/${rooms[key] ? key : 'bedroom'}.webp`;
  function load(key) {
    if (!known(key)) key = 'bedroom';
    if (blobs.has(key)) return Promise.resolve(blobs.get(key));
    if (!inflight.has(key)) inflight.set(key, fetch(pathFor(key)).then(response => { if (!response.ok) throw new Error('room'); return response.blob(); })
      .then(blob => { const url = URL.createObjectURL(blob), img = new Image(); img.src = url; return img.decode().catch(() => {}).then(() => url); })
      .catch(() => pathFor(key)).then(url => { blobs.set(key, url); inflight.delete(key); return url; }));
    return inflight.get(key);
  }
  window.RoomArt = {
    load, ready: key => blobs.has(known(key) ? key : 'bedroom'),
    render(key, interactive=true) {
      const room = rooms[key] || rooms.bedroom;
      const bed = key === 'bedroom' && interactive ? '<g data-scene-action="bed" role="button" tabindex="0" aria-label="Yatağa dönmeyi dene"><path class="bed-hit" d="M72 422 254 390 338 452 626 445 627 563 551 627 94 565Z"/></g>' : '';
      const image = `<image href="${blobs.get(rooms[key]?key:'bedroom')||pathFor(key)}" width="${W}" height="${H}" preserveAspectRatio="none"/>`;
      return `<svg class="scene-svg flow-room" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-label="${room.name}" role="group">${image}${bed}${interactive?room.objects.map(target).join(''):''}</svg>`;
    },
    layout(key) {
      const room=rooms[key]||rooms.bedroom;
      return {defaultViewBox:[0,0,W,H],exits:room.exits,guide:{...room.guide},portrait:{viewBox:[...room.portrait],guide:{...(room.portraitGuide||room.guide)}}};
    }
  };
  /* Images marked img-wait stay invisible until they are fully decoded: never half-painted. */
  const settle = img => { const done = () => { img.classList.remove('img-wait'); img.classList.add('img-ok'); }; (img.decode ? img.decode() : Promise.reject()).then(done, done); };
  window.RoomArt.settle = settle;
  document.querySelectorAll('img.img-wait').forEach(settle);
})();

