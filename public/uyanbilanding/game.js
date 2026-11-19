/* The game clock owns all gameplay work. Pausing freezes both the deadline and
   pending scans/transitions; no delayed callback can outlive a session.
   The deadline starts running the moment the adventure starts, while the alarm still rings. */
(function (root) {
  'use strict';

  // Doors are [target room, key direction]. Labels live in rooms.js, the single source.
  const ROUTES = {
    bedroom: [['hallway', '↑']],
    hallway: [['bathroom', '←'], ['kitchen', '→'], ['balcony', '↑'], ['bedroom', '↶']],
    kitchen: [['hallway', '↶']],
    bathroom: [['hallway', '↶']],
    balcony: [['hallway', '↶']]
  };
  const GOAL_STEPS = 10, STEPS_PER_DOOR = 2;
  const OBJECT_NAMES = { mug: 'Kupa', book: 'Kitap', bottle: 'Su şişesi', shoe: 'Terlik', apple: 'Elma', toothbrush: 'Diş fırçası' };

  // How long the balcony stays as it is after the last step ("İşte bu!") before the curtain closes (perde.js).
  const CELEBRATION_MS = 800;
  class GameEngine {
    constructor(options = {}) {
      this.duration = options.durationMs ?? 60000;
      this.scanDuration = options.scanMs ?? 850;
      this.moveDuration = options.moveMs ?? 480;
      this.celebrationDuration = options.celebrationMs ?? CELEBRATION_MS;
      this.restart();
    }
    restart() {
      this.current = { room: 'bedroom', phase: 'asleep', snoozed: false, steps: 0, leftMs: this.duration, selected: null, cup: false, mode:'scan', paused: false, scanning: false, moving: false, frozen: false, feedback: null };
      this.pending = null;
      this.events = [];
    }
    get state() { return { ...this.current, feedback: this.current.feedback && { ...this.current.feedback }, pending: this.pending && { ...this.pending } }; }
    drain() { const events = this.events; this.events = []; return events; }
    emit(type, detail = {}) { this.events.push({ type, ...detail }); }
    isPlaying() { return this.current.phase === 'seek' || this.current.phase === 'walk'; }
    // The deadline runs from the first alarm until the final arrival (it stands still in the finale).
    clockRuns() { return !this.current.frozen && ['asleep', 'alarm', 'seek', 'walk'].includes(this.current.phase); }
    // A room change is a walk the player watches (about 2 s): the deadline stands still for it, and so does everything that
    // follows the move (the celebration). Only the move itself still runs out, so its end is ready the moment the walk is over.
    freeze(value = true) { this.current.frozen = !!value; }
    canAct() { return this.isPlaying() && !this.current.paused && !this.pending && this.current.leftMs > 0; }
    snooze() {
      // There is no snooze: the call is recorded for the mascot's reply, nothing else changes.
      if (this.current.phase !== 'asleep' || this.current.snoozed) return false;
      this.current.snoozed = true;
      return true;
    }
    wake() {
      if (this.current.phase !== 'asleep') return false;
      this.current.phase = 'alarm';
      return true;
    }
    accept() {
      if (this.current.phase !== 'alarm' || this.current.paused) return false;
      this.current.phase = 'seek';
      return true;
    }
    select(object) {
      if (!this.canAct() || this.current.phase !== 'seek' || this.current.mode !== 'scan' || !OBJECT_NAMES[object]) return false;
      this.current.selected = object;
      this.current.feedback = null;
      this.emit('selected', { object });
      return true;
    }
    scan() {
      if (!this.canAct() || this.current.phase !== 'seek' || this.current.mode !== 'scan' || !this.current.selected) return false;
      this.current.scanning = true;
      this.pending = { type: 'scan', remaining: this.scanDuration, object: this.current.selected };
      this.emit('scan-start');
      return true;
    }
    beginOffline() {
      if (!this.canAct() || this.current.phase !== 'seek' || this.current.cup) return false;
      Object.assign(this.current,{mode:'offline',selected:null,feedback:null});
      return true;
    }
    returnToCamera() {
      if (!this.canAct() || this.current.phase !== 'seek' || this.current.cup) return false;
      Object.assign(this.current,{mode:'scan',selected:null,feedback:null}); return true;
    }
    completeOffline() {
      if (!this.canAct() || this.current.phase !== 'seek' || this.current.mode !== 'offline') return false;
      Object.assign(this.current,{cup:true,phase:'walk',feedback:{type:'success',object:'offline'}});
      this.emit('cup',{offline:true}); return true;
    }
    move(room) {
      if (!this.canAct() || !ROUTES[this.current.room].some(route => route[0] === room)) return false;
      Object.assign(this.current, { room, steps: this.current.steps + STEPS_PER_DOOR, selected: null, feedback: null, moving: true });
      // A valid final arrival is accepted only while time remains. Its scene
      // transition and celebration then run with the deadline frozen.
      if (this.current.cup && this.current.steps >= GOAL_STEPS && room === 'balcony') this.current.phase = 'finale';
      this.pending = { type: 'move', remaining: this.moveDuration };
      this.emit('room', { room, final: this.current.phase === 'finale' });
      return true;
    }
    pause() {
      if (!['asleep', 'alarm', 'seek', 'walk', 'finale'].includes(this.current.phase) || this.current.paused) return false;
      this.current.paused = true;
      return true;
    }
    resume() {
      if (!this.current.paused) return false;
      this.current.paused = false;
      return true;
    }
    // The story preview ("Tanıtımı gör", #hikaye) opens on the finished balcony without playing.
    preview() {
      Object.assign(this.current, { room: 'balcony', phase: 'won', cup: true, steps: GOAL_STEPS, leftMs: this.duration, snoozed: false });
      this.pending = null; this.events = [];
    }
    home() {
      this.current.phase = 'home';
      this.current.paused = false;
      this.current.scanning = false;
      this.current.moving = false;
      this.current.frozen = false;
      this.pending = null;
      this.events = [];
    }
    finish(won) {
      this.current.phase = won ? 'won' : 'timeout';
      this.current.paused = false;
      this.current.scanning = false;
      this.current.moving = false;
      this.current.frozen = false;
      this.pending = null;
      this.emit('finished', { won });
    }
    completePending() {
      const job = this.pending;
      this.pending = null;
      if (job.type === 'scan') {
        this.current.scanning = false;
        this.current.selected = null;
        if (job.object === 'mug') {
          this.current.cup = true;
          this.current.phase = 'walk';
          this.current.feedback = { type: 'success', object: job.object };
          this.emit('cup');
        } else {
          this.current.feedback = { type: 'error', object: job.object };
          this.emit('wrong', { object: job.object });
        }
      } else if (job.type === 'move') {
        this.current.moving = false;
        this.emit('move-end');
        if (this.current.phase === 'finale') {
          this.pending = { type: 'celebration', remaining: this.celebrationDuration };
          this.emit('celebration');
        }
      } else if (job.type === 'celebration') this.finish(true);
    }
    advance(milliseconds) {
      let remaining = Math.max(0, Number(milliseconds) || 0);
      if (this.current.paused) return;
      while (remaining > 0 && ['asleep', 'alarm', 'seek', 'walk', 'finale'].includes(this.current.phase)) {
        if (this.current.frozen && this.pending?.type !== 'move') return;
        const clockRuns = this.clockRuns();
        const clockBoundary = clockRuns ? this.current.leftMs : Infinity;
        const jobBoundary = this.pending ? this.pending.remaining : Infinity;
        const amount = Math.min(remaining, clockBoundary, jobBoundary);
        if (!Number.isFinite(amount)) return;
        if (clockRuns) this.current.leftMs = Math.max(0, this.current.leftMs - amount);
        if (this.pending) this.pending.remaining = Math.max(0, this.pending.remaining - amount);
        remaining -= amount;
        // A completion exactly on the deadline is late. This order is fixed,
        // independent of RAF cadence or how the browser orders callbacks.
        if (clockRuns && this.current.leftMs <= 0) { this.finish(false); return; }
        if (this.pending && this.pending.remaining <= 0) this.completePending();
        else if (amount === 0) return;
      }
    }
  }

  root.UyanbiGameEngine = GameEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = { GameEngine, ROUTES, GOAL_STEPS, STEPS_PER_DOOR };
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  const game = $('game');
  const dialog = $('game-dialog');
  if (!game || !dialog) return;
  const engine = new GameEngine();
  const names = { bedroom: 'Yatak odası', hallway: 'Koridor', kitchen: 'Mutfak', bathroom: 'Banyo', balcony: 'Balkon' };
  const subtitles = { bedroom: 'Gün burada başlıyor.', hallway: `Her oda geçişi ${STEPS_PER_DOOR} adım.`, kitchen: 'Kupa masada seni bekliyor.', bathroom: 'Biraz su, biraz ferahlık.', balcony: 'Yeni güne bir adım daha.' };
  const wrongMessages = {
    book: 'Güzel kitap, sonra okuruz. Bizim görevimiz bir kupa bulmak!',
    shoe: 'Terlik tamam. Şimdi mutfaktaki kupayı bulalım.',
    bottle: 'Su iyi fikir! Ama ben bir kupa taramanı istiyorum.',
    apple: 'Kahvaltı birazdan. Önce masadaki kupa!',
    toothbrush: 'Diş fırçası burada. Kupamız mutfakta bekliyor.'
  };
  const phoneEl = game.querySelector('.phone'), rig = $('phone-rig');
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let previousTime = null;
  let dialogKind = '';
  let sound = false, soundTouched = false;
  let audio = null, alarmTimer = 0, alarmBus = null;
  let returnFocus = null;
  let navRoom = '', bedReplies = 0;
  let startTimer = 0, wakeTimer = 0, snoozeTimer = 0, flipAnimation = null;
  let rising = false, riseTimers = [], bedOk = false;
  const bed = $('bed-pov');
  // Room changes walk (two steps, one blink) through walk.js; without it a change simply happens.
  const walkApi = root.UyanbiWalk || { busy: () => false, go: change => { change(); return Promise.resolve(); }, blink: change => { change(); return Promise.resolve(); }, cancel() {}, tick() {} };
  let epoch = 0, gate = null, moveBack = false; // epoch: bumped when a session is torn down; gate: events held until the walk is over

  // Everything the frame loop and the tab-visibility guard look after: the clock also runs on the alarm screen and in bed.
  const clocked = state => ['asleep', 'alarm', 'seek', 'walk', 'finale'].includes(state.phase);
  const remainingSteps = state => Math.max(0, GOAL_STEPS - state.steps);
  const lastDoorFrom = GOAL_STEPS - STEPS_PER_DOOR;
  const taskTitle = state => !state.cup ? (state.mode === 'offline' ? 'Zihnini aç' : 'Bir kupa bul') : remainingSteps(state) ? `${remainingSteps(state)} adım daha at` : 'Şimdi balkona çık';
  function pose(name) { root.PoncikActor?.setPose?.(name); }
  function roomPose(state) {
    if (state.phase === 'finale' || state.phase === 'won') return 'success';
    if (state.phase === 'asleep' || state.phase === 'alarm') return 'awake';
    if (state.mode === 'offline' && !state.cup) return 'invite';
    if (state.room === 'kitchen' && !state.cup) return 'down';
    if (state.room === 'hallway') return state.cup && state.steps >= lastDoorFrom ? 'invite' : 'right';
    return 'invite';
  }
  function say(message, actorPose) {
    $('guide-message').textContent = message;
    if (actorPose) pose(actorPose);
  }
  function announce(text) {
    const node = $('wake-status');
    node.textContent = '';
    setTimeout(() => { node.textContent = text; }, 80);
  }
  function guideMessage(state) {
    if (state.phase === 'asleep') return 'Alarm çalıyor. Uyanma zamanı!';
    if (state.phase === 'alarm') return 'Telefonundaki göreve bakalım.';
    if (state.phase === 'finale' || state.phase === 'won') return 'İşte bu! Gün seninle başladı.';
    if (state.feedback?.type === 'error') return wrongMessages[state.feedback.object];
    if (state.mode === 'offline' && !state.cup) return 'Bir işlem, sonra küçük bir cümle. Telefonunda devam edelim.';
    if (state.cup) {
      const left = remainingSteps(state);
      if (!left) return state.room === 'hallway' ? 'Adımların tamam! Karşıdaki balkona çıkalım.' : 'Görev de adımlar da tamam. Şimdi balkona çıkalım!';
      if (state.room === 'balcony') return `${left} adımımız kaldı. Biraz daha dolaşıp buraya dönelim.`;
      return `${state.mode === 'offline' ? 'Zihin görevi tamam!' : 'Kupa tamam!'} ${left} adım daha atalım, sonra balkonda buluşalım.`;
    }
    return {
      bedroom: 'Kupayı mutfakta görmüştüm. Hadi, kapıdan çıkalım!',
      hallway: 'Mutfak sağda! İstersen diğer odalara da bakabilirsin.',
      kitchen: 'İşte orada! Masadaki kupaya dokun, sonra tara.',
      bathroom: 'Diş fırçası burada. Bizim kupamız mutfakta!',
      balcony: 'Manzara güzel! Önce mutfaktaki kupayı bulalım.'
    }[state.room];
  }

  /* ---- sound: short Web Audio patterns; the alarm is a looping pattern on its own bus ---- */
  function unlockAudio() {
    try { audio ??= new (root.AudioContext || root.webkitAudioContext)(); audio.resume().catch(() => {}); } catch {}
    root.UyanbiSfx?.unlock();
  }
  function chirp(kind = 'tap') {
    if (!sound) return;
    try {
      unlockAudio();
      const start = audio.currentTime;
      const alarm = kind === 'alarm';
      if (alarm && !alarmBus) { alarmBus = audio.createGain(); alarmBus.connect(audio.destination); }
      const out = alarm ? alarmBus : audio.destination;
      const notes = kind === 'success' ? [523, 659, 784] : kind === 'error' ? [220, 174] : alarm ? [880, 698, 880, 698] : [440];
      const gap = alarm ? .17 : .13;
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain(), at = start + index * gap;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(alarm ? .06 : .055, at + .02);
        gain.gain.exponentialRampToValueAtTime(.001, at + (alarm ? .15 : .16));
        oscillator.connect(gain); gain.connect(out);
        oscillator.start(at); oscillator.stop(at + .2);
      });
    } catch {}
  }
  // The footstep follows the same switch and the same audio context as chirp().
  function footstep(n) {
    if (!sound) return;
    try { unlockAudio(); walkApi.tick(audio, n); } catch {}
  }
  function stopAlarm() {
    clearInterval(alarmTimer); alarmTimer = 0;
    if (!alarmBus) return;
    const bus = alarmBus; alarmBus = null;
    try { bus.gain.setTargetAtTime(0, audio.currentTime, .015); } catch {}
    setTimeout(() => { try { bus.disconnect(); } catch {} }, 200);
  }
  function syncAlarm() {
    const on = sound && !game.hidden && !document.hidden && engine.state.phase === 'asleep' && !engine.state.paused;
    if (!on) { stopAlarm(); return; }
    if (alarmTimer) return;
    chirp('alarm'); alarmTimer = setInterval(() => chirp('alarm'), 1900);
  }
  function setSound(value) {
    sound = value; root.UyanbiSfx?.setEnabled(value); // sfx.js follows the same switch
    $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', sound ? 'Sesi kapat' : 'Sesi aç');
    const slash = $('sound').querySelector('.sound-slash'); if (slash) slash.hidden = sound;
  }
  root.UyanbiSfx?.setEnabled(false); // silent until the game's own switch turns on (start) or the story opens

  /* ---- painting ---- */
  function paintTimer() {
    const state = engine.state, seconds = Math.max(0, Math.ceil(state.leftMs / 1000));
    $('time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if ($('time-arc')) $('time-arc').style.strokeDashoffset = String(132 * (1 - state.leftMs / engine.duration));
    $('timer-box').classList.toggle('urgent', state.leftMs <= 15000 && engine.clockRuns());
  }
  function paintSteps(count) {
    const state = engine.state, shown = Math.min(GOAL_STEPS, count ?? state.steps);
    $('steps').textContent = shown;
    $('steps').parentElement?.setAttribute('aria-label', `Hedef: ${shown} / ${GOAL_STEPS} adım. Toplam ${count ?? state.steps} adım.`);
    [...($('step-dots')?.children || [])].forEach((dot, index) => dot.classList.toggle('done', shown > index));
    $('step-dots')?.setAttribute('aria-hidden', 'true');
  }
  function recommendation(state) {
    if (state.room === 'kitchen' && !state.cup) return null; // the mug is here: nothing to recommend leaving for
    if (state.room !== 'hallway') return 'hallway';
    if (!state.cup) return 'kitchen';
    if (state.steps >= lastDoorFrom) return 'balcony';
    return 'bathroom';
  }
  // The way back is never a door in the picture: it is the top-left HUD button, named after the room it returns to.
  const backNames = { bedroom: 'Yatak odasına dön', hallway: 'Koridora dön' };
  function paintNavigation() {
    const state = engine.state, navigation = $('navigation');
    if (navRoom !== state.room) {
      // Painted doors only. Shape, label and aria-label are written by GameScene.positionNavigation from rooms.js.
      navigation.innerHTML = ROUTES[state.room].filter(route => route[1] !== '↶').map(([room]) => `<button type="button" class="nav-button door" data-room="${room}"><svg class="door-fx" aria-hidden="true" focusable="false"></svg><span class="nav-name"></span></button>`).join('');
      navRoom = state.room;
    }
    const blocked = !engine.isPlaying() || state.paused || state.scanning || state.moving || walkApi.busy();
    const rec = recommendation(state);
    navigation.querySelectorAll('[data-room]').forEach(button => {
      button.disabled = blocked;
      button.classList.toggle('recommended', button.dataset.room === rec);
    });
    const back = ROUTES[state.room].find(route => route[1] === '↶'), backButton = $('room-back');
    const showBack = !!back && ['seek', 'walk'].includes(state.phase);
    backButton.hidden = !showBack; $('hud').classList.toggle('has-back', showBack);
    if (back) {
      backButton.dataset.room = back[0]; $('room-back-name').textContent = names[back[0]];
      backButton.setAttribute('aria-label', backNames[back[0]] || names[back[0]]);
    } else delete backButton.dataset.room;
    backButton.disabled = blocked;
    backButton.classList.toggle('recommended', !!back && back[0] === rec);
    root.GameScene?.positionNavigation?.();
  }

  /* ---- phone focus: layout flips instantly, the rig is animated with transform only (FLIP) ---- */
  function phoneBox() {
    const g = game.getBoundingClientRect(), r = rig.getBoundingClientRect(), p = phoneEl.getBoundingClientRect();
    return { cx: p.left + p.width / 2 - g.left, cy: p.top + p.height / 2 - g.top, h: phoneEl.offsetHeight * (r.width / (rig.offsetWidth || 1)) };
  }
  let instantPhone = false; // behind closed eyelids the phone jumps to its new place, no FLIP
  function flipPhone(change) {
    if (game.hidden || reducedMotion() || instantPhone || !rig.animate) { change(); return; }
    const first = phoneBox();
    flipAnimation?.cancel();
    rig.classList.add('flip');
    change();
    const last = phoneBox(), cs = getComputedStyle(rig);
    if (!first.h || !last.h) { rig.classList.remove('flip'); return; }
    const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
    const rest = new DOMMatrix().translate(ox, oy).multiply(new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform)).translate(-ox, -oy);
    const k = first.h / last.h, Lx = rig.offsetLeft, Ly = rig.offsetTop;
    const from = new DOMMatrix([rest.a * k, rest.b * k, rest.c * k, rest.d * k,
      rest.e * k + (k - 1) * Lx - k * last.cx + first.cx, rest.f * k + (k - 1) * Ly - k * last.cy + first.cy]);
    const animation = flipAnimation = rig.animate(
      [{ transformOrigin: '0 0', transform: from.toString() }, { transformOrigin: '0 0', transform: rest.toString() }],
      { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const done = () => { if (flipAnimation === animation) { flipAnimation = null; rig.classList.remove('flip'); } };
    animation.onfinish = done; animation.oncancel = done;
  }
  function syncInert(focused) {
    const state = engine.state;
    const locked = focused || game.classList.contains('waking') || ['asleep', 'finale', 'won', 'timeout'].includes(state.phase);
    $('room-art').inert = locked; $('navigation').inert = locked;
  }
  function setPhoneFocus(focused) {
    const state = engine.state;
    focused = !!focused && !['asleep', 'finale', 'timeout', 'home'].includes(state.phase) && (state.phase !== 'won' || game.classList.contains('relaxing'));
    if (game.classList.contains('phone-focused') !== focused) flipPhone(() => game.classList.toggle('phone-focused', focused));
    phoneEl.inert = !focused && !game.classList.contains('story');
    $('phone-open').setAttribute('aria-expanded', String(focused));
    // The mission card in bed stays in the middle until "Göreve başla": no way back to the room yet.
    $('phone-close').hidden = !focused || state.phase === 'alarm'; $('phone-close').innerHTML = '<span aria-hidden="true">‹</span> Odaya dön'; $('phone-close').setAttribute('aria-label', 'Odaya dön');
    syncInert(focused);
  }
  function focusRoom() {
    const state = engine.state, heading = $('room-name');
    heading.tabIndex = -1;
    heading.setAttribute('role', 'heading'); heading.setAttribute('aria-level', '2');
    heading.setAttribute('aria-label', `${names[state.room]}. Toplam ${state.steps} adım. ${taskTitle(state)}`);
    heading.focus({ preventScroll: true });
  }
  function paintMission() {
    const state = engine.state;
    const intro = ['asleep', 'alarm'].includes(state.phase);
    $('room-name').setAttribute('aria-label', `${names[state.room]}. Toplam ${state.steps} adım. ${taskTitle(state)}`);
    $('phone-alarm').hidden = state.phase !== 'alarm';
    $('offline-entry').hidden = state.cup || intro; $('camera-return').hidden = state.mode !== 'offline';
    $('camera').hidden = state.mode === 'offline';
    $('offline-play').hidden = state.mode === 'offline';
    $('offline-entry').querySelector('p').innerHTML = state.mode === 'offline' ? 'Kamerayı kullanmak ister misin?' : 'İnternetin yok mu?<br><b>Dert değil.</b>';
    root.PhoneGames?.setPaused(state.paused);
    $('phone-mission').hidden = intro;
    $('room-art').querySelectorAll('[data-object]').forEach(node=>{const selected=state.mode === 'scan' && state.selected === node.dataset.object && !state.cup;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected));});
    $('task-eyebrow').textContent = state.cup ? 'Görev tamamlandı' : state.mode === 'offline' ? 'Çevrimdışı görevin' : 'Uyanma görevin';
    $('task-title').textContent = ['finale', 'won'].includes(state.phase) ? 'Harika, başardın!' : taskTitle(state);
    const scan = $('scan'), feedback = $('phone-feedback');
    feedback.className = 'phone-feedback';
    $('camera').classList.toggle('scanning', state.scanning);
    if (state.scanning) {
      scan.textContent = 'Taranıyor…'; scan.disabled = true;
      feedback.textContent = 'Nesne kontrol ediliyor…';
    } else if (state.cup) {
      scan.textContent = 'Görev tamam'; scan.disabled = true;
      feedback.classList.add('success');
      feedback.textContent = remainingSteps(state) ? `Görev tamamlandı. ${remainingSteps(state)} adım kaldı.` : 'Görev ve adımlar tamam. Balkona çık.';
    } else if (state.mode === 'offline') {
      scan.textContent = 'Mini oyuna devam et'; scan.disabled = false;
      feedback.textContent = 'İşlemi çöz, cümleyi sırala. Sonra balkona doğru devam et.';
    } else if (state.feedback?.type === 'error') {
      scan.textContent = 'Odada nesne seç'; scan.disabled = false;
      feedback.classList.add('error');
      feedback.textContent = `Bu ${OBJECT_NAMES[state.feedback.object].toLocaleLowerCase('tr')}. Aradığımız nesne kupa.`;
    } else if (state.selected) {
      scan.textContent = 'Nesneyi tara'; scan.disabled = false;
      feedback.textContent = 'Nesne hazır. Şimdi tara.';
    } else {
      scan.textContent = 'Odada nesne seç'; scan.disabled = false;
      feedback.textContent = 'Odada bir nesneye dokun, sonra tara.';
    }
    if (intro) $('game-caption').textContent = 'Süre işliyor. Hadi!';
    else if (['finale', 'won'].includes(state.phase)) $('game-caption').textContent = 'Güzel bir gün seni bekliyor.';
    else if (state.cup) $('game-caption').textContent = remainingSteps(state) ? `Her oda geçişi ${STEPS_PER_DOOR} adım. ${remainingSteps(state)} adım kaldı.` : 'Adımlar tamam. Şimdi balkona çık.';
    else $('game-caption').textContent = ROUTES[state.room].some(route => route[1] !== '↶') ? 'Kapılara dokunarak ilerle. Bir nesneye dokun, sonra tara.' : 'Bir nesneye dokun, sonra tara. Geri dönüş sol üstte.';
    if (!state.selected && !state.feedback) $('camera-caption').textContent = state.cup ? 'Kupa tamam. Güne doğru devam et.' : 'Bir nesneye dokun, sonra tara.';
    else if (state.feedback?.type === 'error') $('camera-caption').textContent = `${OBJECT_NAMES[state.feedback.object]} taramaya hazır`;
    game.classList.toggle('moving', state.moving);
    game.classList.toggle('paused', state.paused);
    game.classList.toggle('finale', ['finale', 'won'].includes(state.phase));
    game.classList.toggle('morning', ['finale', 'won'].includes(state.phase));
    root.PoncikActor?.setPaused?.(state.paused);
    paintSteps(); paintNavigation(); paintTimer();
  }
  function mountRoom() {
    const state = engine.state;
    if (root.GameScene?.mount) root.GameScene.mount(state.room);
    $('camera-object').innerHTML = '';
    $('room-name').textContent = names[state.room]; $('room-hint').textContent = subtitles[state.room];
    $('room-name').setAttribute('aria-label', `${names[state.room]}. Toplam ${state.steps} adım. ${taskTitle(state)}`);
    say(guideMessage(state), roomPose(state));
    paintMission();
  }
  function frameSelectedObject(node) {
    if (root.GameScene?.focusObject) root.GameScene.focusObject(node);
    else {
      const point = node.getAttribute('transform')?.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/);
      if (point) $('camera-live').querySelector('svg')?.setAttribute('viewBox', `${Number(point[1]) - 145} ${Number(point[2]) - 110} 290 210`);
    }
  }
  function showResult(won) {
    const state = engine.state, elapsed = Math.min(60, Math.ceil((engine.duration - state.leftMs) / 1000));
    if (dialog.open) dialog.close();
    if (won) {
      root.PhoneGames?.close(); game.classList.remove('phone-game-mode');
      game.classList.add('epilogue'); syncInert(false);
      root.PoncikActor?.setPaused?.(true);
      root.MorningEnding.show({seconds:elapsed,steps:state.steps}); chirp('success'); return;
    }
    root.PhoneGames?.close(); game.classList.remove('phone-game-mode');
    dialogKind = 'result'; dialog.dataset.kind = 'result';
    $('dialog-content').innerHTML = `<span class="dialog-icon" aria-hidden="true">◷</span><h2 id="dialog-title">Bir tur daha?<br>Ponçik hazır</h2><p>60 saniye doldu. Küçük bir hareketle yeniden başlayalım.<br>Telefondaki görevi tamamla, ${GOAL_STEPS} adım at.<br>Balkonda gün seni bekliyor.</p><button class="primary" data-action="restart">Yeniden oyna</button><button class="secondary" data-action="home">Ana sayfaya dön</button>`;
    dialog.setAttribute('aria-labelledby', 'dialog-title'); dialog.showModal();
    chirp('error');
  }
  /* A forward room change is a walk to the door that was touched: two steps (the counter ticks with each; the camera
     pushes in about the door, Ponçik walks ahead of it), one blink, the room changes while the eyes are shut and
     settles in from slightly close up. The game clock stands still for all of it (engine.freeze), and everything the
     engine reports after it (move-end, celebration, finished) waits for the walk to end, so nothing of the new room
     shows before the lids have opened. Going back is a plain change. */
  function roomChange(event) {
    const back = moveBack; moveBack = false;
    const swap = () => {
      root.UyanbiSfx?.play('kapi');
      setPhoneFocus(false); mountRoom();
      if (event.final) { pose('success'); say('İşte bu! Gün seninle başladı.'); }
    };
    if (back) { swap(); walkApi.enter?.($('guide')); chirp(); return; }
    const before = engine.state.steps - STEPS_PER_DOOR, then = epoch;
    const door = navigationEl.querySelector(`[data-room="${event.room}"]`), way = ROUTES[navRoom]?.find(route => route[0] === event.room)?.[1];
    // He walks pointing at the door when it is to his side (the clip he has for that), otherwise he keeps his pose.
    if (way === '→') pose('right'); else if (way === '←') pose('left');
    navigationEl.querySelectorAll('[data-room]').forEach(button => { button.disabled = true; });
    $('room-back').disabled = true; game.classList.add('moving');
    engine.freeze(true);
    const walk = walkApi.go(behindLids(swap), {
      stage: sceneLayers(), door, actor: $('guide'), fade: [$('guide-message'), ...navigationEl.querySelectorAll('.nav-name')],
      ready: RoomArt.load(event.room), sound: false,
      onStep: n => { paintSteps(before + n); footstep(n); }
    });
    hold(walk.catch(error => console.error(error)).then(() => { if (then === epoch) { engine.freeze(false); paintNavigation(); } }));
  }
  function hold(promise) { const mine = gate = promise; mine.then(() => { if (gate === mine) gate = null; }); }
  function handleEvent(event) {
    const state = engine.state;
    if (event.type === 'room') {
      roomChange(event);
    } else if (event.type === 'move-end') {
      paintMission(); if (engine.isPlaying()) focusRoom();
    } else if (event.type === 'wrong') {
      say(wrongMessages[event.object], 'wrong'); paintMission(); chirp('error'); if(game.classList.contains('phone-focused')) $('scan').focus({preventScroll:true});
    } else if (event.type === 'cup') {
      setPhoneFocus(false); say(guideMessage(state), 'success'); paintMission(); chirp('success'); focusRoom();
    } else if (event.type === 'celebration') {
      setPhoneFocus(false); pose('success'); paintMission();
    } else if (event.type === 'finished') {
      // Time can also run out on the alarm screen or in bed: the alarm goes quiet and the wake-up scene is torn down.
      if (!event.won) { resetWake(); syncAlarm(); }
      setPhoneFocus(false); paintMission(); showResult(event.won);
    }
  }
  function processEvents() {
    for (const event of engine.drain()) {
      if (gate && event.type !== 'room') {
        const then = epoch;
        hold(gate.then(() => { if (then === epoch) handleEvent(event); }));
      } else handleEvent(event);
    }
  }
  function stopFrame() { cancelAnimationFrame(raf); raf = 0; previousTime = null; }
  function syncTime(now = performance.now()) {
    if (previousTime !== null) engine.advance(Math.max(0, now - previousTime));
    previousTime = now;
    processEvents(); paintTimer();
  }
  function tick(now) {
    raf = 0;
    syncTime(now);
    if (clocked(engine.state) && !engine.state.paused) raf = requestAnimationFrame(tick);
    else previousTime = null;
  }
  function ensureFrame() {
    if (!raf && clocked(engine.state) && !engine.state.paused) {
      previousTime = performance.now(); raf = requestAnimationFrame(tick);
    }
  }
  function beforeAction() { if (previousTime !== null) syncTime(); }

  /* ---- start, wake, home ---- */
  function resetWake() {
    clearTimeout(startTimer); clearTimeout(wakeTimer); clearTimeout(snoozeTimer);
    startTimer = wakeTimer = snoozeTimer = 0;
    riseTimers.forEach(clearTimeout); riseTimers = []; rising = false;
    epoch++; gate = null; moveBack = false; walkApi.cancel();
    game.classList.remove('asleep', 'waking', 'snoozed', 'wake-cut', 'bed-view', 'blink-cut');
    const button = $('snooze');
    button.classList.remove('shake', 'gone'); button.hidden = false; button.disabled = false;
    $('wake-status').textContent = '';
    $('wake-bubble').hidden = true; $('wake-poncik').classList.remove('shake');
  }
  function start() {
    if (startTimer || welcomeCurtain) return;
    const fromWelcome = !$('welcome').hidden;
    stopFrame(); resetWake(); engine.restart(); navRoom = ''; bedReplies = 0;
    root.PhoneGames?.reset(); phoneEl.inert = true;
    root.MorningEnding?.hide();
    game.classList.remove('epilogue', 'relaxing', 'phone-game-mode', 'paused', 'moving', 'finale', 'morning', 'phone-focused');
    root.PoncikActor?.setPaused?.(false);
    if (dialog.open) dialog.close();
    if (!soundTouched) setSound(true);
    unlockAudio();
    if (!history.state?.uyanbiGame) history.pushState({ uyanbiGame: true }, '');
    game.classList.add('asleep', 'bed-view'); game.classList.toggle('wake-cut', fromWelcome);
    ensureFrame(); // the deadline starts the moment "Maceraya başla" is pressed
    const reveal = () => {
      startTimer = 0;
      $('welcome').hidden = true; $('welcome').classList.remove('fade-out'); game.hidden = false;
      mountRoom(); setPhoneFocus(false);
      $('wake-up').focus({ preventScroll: true });
      syncAlarm(); announce('Alarm çalıyor. Saat 07.00. Uyan ya da ertele.');
    };
    if (fromWelcome) { $('welcome').classList.add('fade-out'); startTimer = setTimeout(reveal, reducedMotion() ? 300 : 500); } else reveal();
  }
  /* The story without the game: the finished balcony, the phone already in the middle, scrolling open.
     prepStory() sets the state up (also when the curtain scene calls it at the start of its flight); enterStory() adds the instant show. */
  function prepStory() {
    stopFrame(); resetWake(); engine.restart(); engine.preview(); navRoom = ''; bedReplies = 0;
    root.PhoneGames?.reset(); phoneEl.inert = true;
    game.classList.remove('relaxing', 'phone-game-mode', 'paused', 'moving', 'phone-focused');
    if (dialog.open) dialog.close();
    document.documentElement.classList.remove('to-story');
    $('welcome').hidden = true; game.hidden = false;
    if (!soundTouched) setSound(true); // the story's stops have their own sounds (isik, sandik, kart...)
    root.GameScene?.mount?.('balcony');
    root.PoncikActor?.setPaused?.(true);
    paintMission(); setPhoneFocus(false);
    game.classList.add('epilogue');
  }
  function enterStory() {
    prepStory();
    root.MorningEnding.show({ preview: true });
    // The browser's fragment scroll would land on the story's first block: the ending scene is where this opens.
    history.scrollRestoration = 'manual';
    const top = () => scrollTo(0, 0);
    requestAnimationFrame(top);
    if (document.readyState !== 'complete') {
      // Until the page has loaded the browser may re-apply the fragment as layout settles: hold the top unless the reader scrolls.
      const release = () => { removeEventListener('scroll', top); ['wheel', 'touchstart', 'keydown'].forEach(type => removeEventListener(type, release)); };
      addEventListener('scroll', top);
      ['wheel', 'touchstart', 'keydown'].forEach(type => addEventListener(type, release, { once: true }));
      addEventListener('load', () => { top(); requestAnimationFrame(() => { top(); release(); }); }, { once: true });
    }
  }
  function openStory() { history.pushState({ uyanbiGame: true }, '', '#hikaye'); enterStory(); }
  /* "Uygulamayı dene" on the welcome screen: the welcome screen stays, its Ponçik (picture hidden at once, the curtain Ponçik takes
     his exact place) draws the curtain, then the same closing and flight as after a game; the stops layer settles from below.
     The bubble and the buttons fade (welcome.perde-out in perde.css) and the whole welcome screen is inert until the story is open. */
  let welcomeCurtain = false;
  function endWelcomeCurtain() { welcomeCurtain = false; const w = $('welcome'); w.classList.remove('perde-out'); w.inert = false; }
  function playWelcomeCurtain() {
    if (welcomeCurtain) return;
    const perde = root.UyanbiPerde, ending = root.MorningEnding;
    const image = document.querySelector('#welcome .welcome-poncik img');
    if (!perde || !ending.curtainIn || !image) { openStory(); return; }
    welcomeCurtain = true;
    history.pushState({ uyanbiGame: true }, '', '#hikaye');   // Back lands on the welcome screen, as before
    const welcome = $('welcome'), from = perde.anchor(image, 'welcome');
    welcome.inert = true;
    RoomArt.load('balcony');   // the painting is decoded while the curtain closes
    perde.ready().then(() => {
      if (!welcomeCurtain) return;   // Back was pressed meanwhile
      welcome.classList.add('perde-out');
      ending.curtainIn({
        host: $('app'), from,
        prepare() { prepStory(); endWelcomeCurtain(); }
      }).then(done => { if (!done) endWelcomeCurtain(); });
    });
  }
  function snooze() {
    if (!engine.snooze()) return;
    const button = $('snooze'), bubble = $('wake-bubble'), mascot = $('wake-poncik');
    const message = 'Erteleme yok! UyanBi’de o buton hiç olmadı.';
    game.classList.add('snoozed'); button.disabled = true; button.classList.add('shake');
    $('guide-message').textContent = message; bubble.textContent = message; bubble.hidden = false;
    mascot.classList.remove('shake'); void mascot.offsetWidth; mascot.classList.add('shake');
    announce(message); chirp('error');
    $('wake-up').focus({ preventScroll: true });
    snoozeTimer = setTimeout(() => {
      button.classList.add('gone');
      snoozeTimer = setTimeout(() => { button.hidden = true; snoozeTimer = 0; }, 500);
    }, 450);
  }
  function wakeUp() {
    if (engine.state.phase !== 'asleep') return;
    // The eyelids open onto the view from the bed: wait until that picture is decoded.
    if (!bedOk) { $('wake-up').setAttribute('aria-busy', 'true'); bedReady.then(() => { if (engine.state.phase === 'asleep') wakeUp(); }); return; }
    $('wake-up').removeAttribute('aria-busy');
    if (!engine.wake()) return;
    clearTimeout(snoozeTimer); snoozeTimer = 0;
    game.classList.remove('asleep', 'snoozed'); game.classList.add('waking');
    syncAlarm(); syncInert(false);
    say('Günaydın!', 'invite'); paintMission();
    announce('Alarm sustu.');
    wakeTimer = setTimeout(finishWake, reducedMotion() ? 600 : 2300);
  }
  function finishWake() {
    wakeTimer = 0; game.classList.remove('waking');
    setPhoneFocus(true); say(guideMessage(engine.state), roomPose(engine.state));
    $('accept-mission').focus({ preventScroll: true });
  }
  /* A change of place happens behind a blink (walk.js draws the eyelids, the same ones for every change): the
     picture, Ponçik, the phone and the HUD take their new places at once while it is dark (transitions off), and
     the lids open only once the new picture is decoded, from a slight blur to sharp. Reduced motion: a short
     fade through dark instead. */
  const navigationEl = $('navigation');
  function behindLids(change) {
    return () => {
      game.classList.add('blink-cut'); instantPhone = true;
      try { change(); } finally { instantPhone = false; }
      requestAnimationFrame(() => requestAnimationFrame(() => game.classList.remove('blink-cut')));
    };
  }
  // The world the camera pushes in while walking: picture, doors and light (Ponçik walks on his own track, the HUD and the phone stand still).
  function sceneLayers() { return [$('room-art'), navigationEl, ...game.querySelectorAll('.room-vignette, .sun-wash')]; }
  function blink(change, ready) { root.UyanbiSfx?.play('kirp'); return walkApi.blink(behindLids(change), { stage: [$('room-art'), bed, $('guide')], ready }); }
  /* "Göreve başla": a blink, and Ponçik and the player are standing in the bedroom. The clock keeps running. */
  function accept() {
    if (rising || engine.state.phase !== 'alarm' || engine.state.paused) return;
    rising = true;
    const room = RoomArt.load('bedroom'), then = epoch;
    room.then(() => {
      if (!rising || !engine.accept()) { rising = false; return; }
      blink(() => {
        game.classList.remove('bed-view'); setPhoneFocus(false); paintMission();
        say(guideMessage(engine.state), roomPose(engine.state));
        root.GameScene?.refresh?.();
      }, room).then(() => {
        if (then !== epoch) return; // torn down meanwhile (home, restart)
        riseTimers = []; rising = false; paintNavigation(); // the doors were held while the lids moved
        if (!engine.state.paused) focusRoom();
        ensureFrame();
      });
    });
  }
  function touchBed() {
    beforeAction(); const state=engine.state;
    if(rising || walkApi.busy() || !engine.isPlaying() || state.paused || state.moving || state.scanning || game.classList.contains('phone-focused')) return;
    const replies=['Yok, hayır, olmaz! Yatağa dönüş yok. Gün bizi bekliyor!', 'Yastık çok ikna edici. Ama ben daha inatçıyım. Hadi bakalım!', 'Bir beş dakika mı? Asla! Önce şu sabaha bir merhaba.', 'O yatak akşam da burada. Şimdi sıra sende!'];
    say(replies[bedReplies++ % replies.length],'wrong'); chirp('tap');
  }
  function selectObject(node) {
    if (rising || walkApi.busy()) return;
    beforeAction();
    if (!engine.select(node.dataset.object)) return;
    engine.drain();
    $('room-art').querySelectorAll('[data-object]').forEach(object => object.classList.toggle('selected', object === node));
    frameSelectedObject(node);
    say(guideMessage(engine.state), node.dataset.object === 'mug' ? 'down' : roomPose(engine.state));
    $('camera-caption').textContent = `${OBJECT_NAMES[node.dataset.object]} taramaya hazır`;
    setPhoneFocus(true); paintMission(); chirp();
    $('scan').focus({ preventScroll: true });
  }
  function scan() {
    if (rising || walkApi.busy()) return;
    beforeAction();
    const state = engine.state;
    if (!state.selected && state.mode === 'scan' && state.phase === 'seek' && !state.paused) {
      setPhoneFocus(false); focusRoom(); return;
    }
    if (state.mode === 'offline') {openOfflineGame();return;}
    if (!engine.scan()) return;
    engine.drain(); paintMission(); ensureFrame();
  }
  function move(room) {
    if (rising || walkApi.busy()) return;
    beforeAction();
    // The doors in the picture lead on; the top-left HUD button (marked ↶ in ROUTES) leads back and does not walk.
    moveBack = ROUTES[engine.state.room].find(route => route[0] === room)?.[1] === '↶';
    if (!engine.move(room)) { moveBack = false; return; }
    processEvents();
    if (!walkApi.busy()) paintMission(); // a walk repaints behind the closed eyes, step by step
    ensureFrame();
  }
  function openDialog(kind) {
    beforeAction();
    if (dialog.open || !engine.pause()) return;
    stopFrame(); returnFocus = document.activeElement;
    dialogKind = kind; dialog.dataset.kind = kind;
    $('dialog-content').innerHTML = kind === 'help'
      ? `<h2 id="dialog-title">Küçük bir sabah<br>macerası</h2><ol class="help-list"><li>Kapılara dokunarak odalarda gez; önceki odaya sol üstteki tuşla dön. Her oda geçişi ${STEPS_PER_DOOR} adım.</li><li>Bir nesneye dokun.</li><li>Telefonda “Nesneyi tara”ya bas. Aradığımız nesne bir kupa.</li><li>Kupa tarandı ve ${GOAL_STEPS} adım tamamlandıysa balkona çık.</li></ol><p>Adımların kupayı ararken de sayılır.<br>Klavye: yön tuşlarıyla ilerle, <kbd>E</kbd> ile tara, <kbd>Esc</kbd> ile telefonu kapat veya duraklat.</p><button class="primary" data-action="resume">Anladım, devam</button>`
      : `<span class="dialog-icon" aria-hidden="true">Ⅱ</span><h2 id="dialog-title">Bir nefes arası</h2><p>Süre durdu. Ponçik seni bekliyor.</p><button class="primary" data-action="resume">Devam et</button><button class="secondary" data-action="home">Ana sayfaya dön</button><button class="text-button" data-action="restart">Yeniden oyna</button>`;
    dialog.setAttribute('aria-labelledby', 'dialog-title'); paintMission(); syncAlarm(); dialog.showModal();
  }
  function resume() {
    if (!engine.resume()) return;
    if (dialog.open) dialog.close();
    paintMission(); syncAlarm();
    if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus({ preventScroll: true });
    else focusRoom();
    ensureFrame();
  }
  function home() {
    stopFrame(); resetWake(); engine.home(); root.PhoneGames?.reset(); root.MorningEnding?.hide(); game.classList.remove('epilogue','relaxing','phone-game-mode','phone-focused');
    if (dialog.open) dialog.close();
    if (location.hash === '#hikaye') history.replaceState(history.state, '', location.pathname + location.search);
    endWelcomeCurtain();
    game.hidden = true; $('welcome').hidden = false; $('welcome').classList.remove('fade-out');
    setPhoneFocus(false); stopAlarm();
    root.PoncikActor?.setPaused?.(true);
    $('begin').focus({ preventScroll: true });
  }
  // Leaving the game goes through history so the browser back button and "Ana sayfa" agree.
  let leaving = false;
  function goHome() { if (leaving) return; if (history.state?.uyanbiGame) { leaving = true; history.back(); } else home(); }
  // The house icon never leaves at once while the clock runs: it pauses, and the pause window asks.
  function homeButton() {
    const state = engine.state;
    if (!clocked(state)) goHome(); else if (!state.paused) openDialog('pause');
  }

  function closePhoneGame() {
    root.PhoneGames.close(); game.classList.remove('phone-game-mode');
    if (engine.state.phase === 'won') {
      game.classList.remove('relaxing');
      document.querySelector('[data-ending="games"]')?.focus({preventScroll:true});
    } else { setPhoneFocus(true); paintMission(); $('scan').focus({preventScroll:true}); }
  }
  function openOfflineGame() {
    beforeAction(); if (!engine.beginOffline()) return;
    say(guideMessage(engine.state),'invite'); paintMission(); game.classList.add('phone-game-mode'); setPhoneFocus(true); root.PhoneGames.open('mission');
  }
  function openArcade() {
    if(engine.state.phase !== 'won') return;
    phoneEl.inert = false;
    game.classList.add('relaxing','phone-game-mode'); root.PhoneGames.open('arcade');
  }
  root.PhoneGames.mount($('phone-games'),{
    onComplete(){beforeAction();if(engine.completeOffline()){root.PhoneGames.close();game.classList.remove('phone-game-mode');processEvents();paintMission();ensureFrame();}},
    onClose:closePhoneGame,
    onScreen(){game.classList.add('phone-game-mode');}
  });
  root.MorningEnding.mount({replay:start,games:openArcade,home:goHome});
  // mode.js asks where the visitor is before it switches between the phone and the computer layout.
  root.UyanbiGame = { enterStory, state: () => game.hidden ? 'welcome' : game.classList.contains('epilogue') ? 'story' : 'play' };
  if (history.state?.uyanbiGame) history.replaceState(null, '');
  $('offline-play').addEventListener('click',openOfflineGame);
  $('camera-return').addEventListener('click',()=>{beforeAction();if(engine.returnToCamera()){root.PhoneGames.close();game.classList.remove('phone-game-mode');paintMission();say(guideMessage(engine.state),roomPose(engine.state));}});
  const bedReady = RoomArt.load('bedPov').then(url => { bed.src = url; return bed.decode ? bed.decode().catch(() => {}) : 0; }).then(() => { bedOk = true; bed.classList.add('bed-ok'); });
  // The welcome backdrop is the bedroom painting; it joins once decoded, never as a half-loaded image.
  RoomArt.load('bedroom').then(() => { $('welcome-art').innerHTML = RoomArt.render('bedroom', false); $('welcome-art').classList.add('ready'); });
  $('begin').addEventListener('click', start);
  $('snooze').addEventListener('click', snooze);
  $('wake-up').addEventListener('click', wakeUp);
  $('home-back').addEventListener('click', homeButton);
  $('room-back').addEventListener('click', event => { const room = event.currentTarget.dataset.room; if (room) move(room); });
  $('accept-mission').addEventListener('click', accept);
  $('scan').addEventListener('click', scan);
  $('room-art').addEventListener('click', event => { if(event.target.closest('[data-scene-action="bed"]')) {touchBed();return;} const node = event.target.closest('[data-object]'); if (node) selectObject(node); });
  $('room-art').addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if(event.target.closest('[data-scene-action="bed"]')) {event.preventDefault();touchBed();return;}
    const node = event.target.closest('[data-object]');
    if (node) { event.preventDefault(); selectObject(node); }
  });
  $('navigation').addEventListener('click', event => { const button = event.target.closest('[data-room]'); if (button) move(button.dataset.room); });
  $('pause').addEventListener('click', () => openDialog('pause'));
  $('help').addEventListener('click', () => openDialog('help'));
  $('phone-open').addEventListener('click', () => {
    const phase = engine.state.phase;
    if (game.hidden || engine.state.paused || phase === 'asleep' || rising || walkApi.busy() || game.classList.contains('waking')) return;
    setPhoneFocus(true);
    if (phase === 'alarm') $('accept-mission').focus({ preventScroll: true }); else if (!$('scan').disabled) $('scan').focus({ preventScroll: true });
  });
  document.querySelector('.phone-focus-shade').addEventListener('click',()=>{if(!game.classList.contains('phone-focused')||engine.state.phase==='alarm')return;if(game.classList.contains('phone-game-mode'))closePhoneGame();else{setPhoneFocus(false);focusRoom();}});
  $('phone-close').addEventListener('click', () => { if(game.classList.contains('phone-game-mode')) closePhoneGame(); else {setPhoneFocus(false); focusRoom();} });
  $('sound').addEventListener('click', () => {
    soundTouched = true; setSound(!sound);
    if (engine.state.phase === 'asleep') syncAlarm(); else chirp('tap');
  });
  $('dialog-content').addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'resume') resume();
    else if (action === 'restart') start();
    else if (action === 'home') goHome();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (dialogKind === 'result') goHome(); else resume(); });
  window.addEventListener('popstate', () => {
    leaving = false;
    if (welcomeCurtain) { if (location.hash !== '#hikaye') home(); return; }   // Back during the curtain: the welcome screen as it was
    if (location.hash === '#hikaye' && game.hidden) enterStory();
    else if (!game.hidden || startTimer) home();
  });
  $('story-open').addEventListener('click', event => { event.preventDefault(); playWelcomeCurtain(); });
  // #hikaye opens the story directly; Back still lands on the welcome screen.
  if (location.hash === '#hikaye') {
    history.replaceState(null, '', location.pathname + location.search);
    history.pushState({ uyanbiGame: true }, '', '#hikaye');
    enterStory();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && clocked(engine.state) && !engine.state.paused) openDialog('pause');
    syncAlarm();
  });
  document.addEventListener('keydown', event => {
    if (game.hidden || dialog.open || event.target.closest('input,textarea,select') || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (engine.state.phase === 'asleep') {
      if ((key === 'enter' || key === ' ') && !event.target.closest('button')) { event.preventDefault(); wakeUp(); }
      return;
    }
    if (game.classList.contains('waking')) return;
    if(key === 'escape' && game.classList.contains('phone-game-mode')){event.preventDefault();closePhoneGame();return;}
    if(game.classList.contains('phone-game-mode')) return;
    if (key === 'escape') {
      event.preventDefault();
      if (game.classList.contains('phone-focused') && engine.state.phase !== 'alarm') { setPhoneFocus(false); focusRoom(); }
      else openDialog('pause');
      return;
    }
    if (key === 'e') { event.preventDefault(); scan(); return; }
    if (game.classList.contains('phone-focused') || !engine.isPlaying() || engine.state.paused) return;
    const state = engine.state;
    let route;
    if (key === 'arrowleft' || key === 'a') route = ROUTES[state.room].find(item => item[1] === '←');
    if (key === 'arrowright' || key === 'd') route = ROUTES[state.room].find(item => item[1] === '→');
    if (key === 'arrowup' || key === 'w') route = ROUTES[state.room].find(item => item[1] === '↑') || ROUTES[state.room][0];
    if (key === 'arrowdown' || key === 's') route = ROUTES[state.room].find(item => item[1] === '↶');
    if (route) { event.preventDefault(); move(route[0]); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
