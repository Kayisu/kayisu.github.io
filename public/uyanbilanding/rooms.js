/* Google Flow paintings are the environment. SVG only positions interaction
 * regions and lets the phone crop the exact same image as the room camera. */
(() => {
  'use strict';
  const W = 1376, H = 768;
  const rooms = {
    bedroom: {
      name: 'Yatak odası', exits:{hallway:{x:950,y:235,label:'Koridora çık',bounds:[914,132,166,332]}}, guide: {x:840,y:565,width:190}, portrait:[300,70,840,698],
      objects: [
        ['book','Kitap',607,399,100,52],
        ['bottle','Su şişesi',356,405,48,88],
        ['shoe','Terlik',245,704,142,70]
      ]
    },
    hallway: {
      name:'Koridor', exits:{bathroom:{x:490,y:265,label:'Banyo',bounds:[418,139,133,319]},kitchen:{x:950,y:235,label:'Mutfak',bounds:[917,139,164,316]},balcony:{x:737,y:265,label:'Balkon',bounds:[690,195,88,202]},bedroom:{x:430,y:640,label:'Yatak odası',back:true,bounds:[350,615,160,120]}}, guide:{x:850,y:570,width:188}, portrait:[300,70,840,698],
      objects:[['book','Kitap',242,493,126,60]]
    },
    kitchen: {
      name:'Mutfak',exits:{hallway:{x:470,y:680,label:'Koridora dön',back:true,bounds:[390,620,160,120]}},guide:{x:900,y:615,width:170},portrait:[355,70,840,698],
      objects:[['mug','Kupa',611,512,106,90],['apple','Elma',503,497,76,76],['bottle','Su şişesi',827,321,52,90]]
    },
    bathroom:{
      name:'Banyo',exits:{hallway:{x:610,y:690,label:'Koridora dön',back:true,bounds:[530,630,160,120]}},guide:{x:850,y:620,width:185},portrait:[300,70,840,698],
      objects:[['toothbrush','Diş fırçası',334,416,56,88],['bottle','Su şişesi',541,404,54,96]]
    },
    balcony:{
      name:'Balkon',exits:{hallway:{x:480,y:700,label:'İçeri dön',back:true,bounds:[0,480,170,280]}},guide:{x:840,y:660,width:192},portrait:[300,70,840,698],
      objects:[['apple','Elma',255,507,74,72]]
    }
  };
  function target([id,name,x,y,w,h]) {
    return `<g data-object="${id}" role="button" tabindex="0" aria-pressed="false" aria-label="${name} — kadraja al" transform="translate(${x} ${y})"><rect class="object-hit" x="${-w/2}" y="${-h}" width="${w}" height="${h}" rx="12"/><path class="object-reticle" d="M${-w/2} ${-h+12}v-12h12 M${w/2-12} ${-h}h12v12 M${w/2} -12v12h-12 M${-w/2+12} 0h-12v-12"/><g class="object-tooltip" transform="translate(0 ${-h-10})"><rect x="-68" y="-25" width="136" height="32" rx="12" fill="#fffaf0" stroke="#8b6f8b"/><text text-anchor="middle" y="-4" fill="#493455" font-size="14">${name}</text></g></g>`;
  }
  window.RoomArt = {
    render(key, interactive=true) {
      const room = rooms[key] || rooms.bedroom;
      const bed = key === 'bedroom' && interactive ? '<g data-scene-action="bed" role="button" tabindex="0" aria-label="Yatağa dönmeyi dene"><path class="bed-hit" d="M72 422 254 390 338 452 626 445 627 563 551 627 94 565Z"/></g>' : '';
      const image = `<image href="assets/rooms/${rooms[key]?key:'bedroom'}.webp" width="${W}" height="${H}" preserveAspectRatio="none"/>`;
      return `<svg class="scene-svg flow-room" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-label="${room.name}" role="group">${image}${bed}${interactive?room.objects.map(target).join(''):''}</svg>`;
    },
    layout(key) {
      const room=rooms[key]||rooms.bedroom;
      return {defaultViewBox:[0,0,W,H],exits:room.exits,guide:{...room.guide},portrait:{viewBox:[...room.portrait],guide:{...room.guide}}};
    }
  };
})();
