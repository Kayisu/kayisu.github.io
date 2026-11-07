/* The game clock owns all gameplay work. Pausing freezes both the deadline and
   pending scans/transitions; no delayed callback can outlive a session. */
(function (root) {
  'use strict';

  const ROUTES = {
    bedroom: [['hallway', '↑', 'Kapıdan çık', 'Koridora geç']],
    hallway: [['bathroom', '←', 'Sola git', 'Banyo'], ['kitchen', '→', 'Sağa git', 'Mutfak'], ['balcony', '↑', 'İleri git', 'Balkon'], ['bedroom', '↶', 'Geri dön', 'Yatak odası']],
    kitchen: [['hallway', '↶', 'Koridora dön', 'Diğer odalara geç']],
    bathroom: [['hallway', '↶', 'Koridora dön', 'Diğer odalara geç']],
    balcony: [['hallway', '↶', 'İçeri dön', 'Koridora geç']]
  };
  const OBJECT_NAMES = { mug: 'Kupa', book: 'Kitap', bottle: 'Su şişesi', shoe: 'Terlik', apple: 'Elma', toothbrush: 'Diş fırçası' };

  class GameEngine {
    constructor(options = {}) {
      this.duration = options.durationMs ?? 60000;
      this.scanDuration = options.scanMs ?? 850;
      this.moveDuration = options.moveMs ?? 480;
      this.celebrationDuration = options.celebrationMs ?? 2800;
      this.restart();
    }
    restart() {
      this.current = { room: 'bedroom', phase: 'alarm', steps: 0, leftMs: this.duration, selected: null, cup: false, mode:'scan', paused: false, scanning: false, moving: false, feedback: null };
      this.pending = null;
      this.events = [];
    }
    get state() { return { ...this.current, feedback: this.current.feedback && { ...this.current.feedback }, pending: this.pending && { ...this.pending } }; }
    drain() { const events = this.events; this.events = []; return events; }
    emit(type, detail = {}) { this.events.push({ type, ...detail }); }
    isPlaying() { return this.current.phase === 'seek' || this.current.phase === 'walk'; }
    canAct() { return this.isPlaying() && !this.current.paused && !this.pending && this.current.leftMs > 0; }
    accept() {
      if (this.current.phase !== 'alarm' || this.current.paused) return false;
      this.current.phase = 'seek';
      this.emit('accepted');
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
      Object.assign(this.current, { room, steps: this.current.steps + 1, selected: null, feedback: null, moving: true });
      // A valid final arrival is accepted only while time remains. Its scene
      // transition and celebration then run with the deadline frozen.
      if (this.current.cup && this.current.steps >= 6 && room === 'balcony') this.current.phase = 'finale';
      this.pending = { type: 'move', remaining: this.moveDuration };
      this.emit('room', { room, final: this.current.phase === 'finale' });
      return true;
    }
    pause() {
      if (!['alarm', 'seek', 'walk', 'finale'].includes(this.current.phase) || this.current.paused) return false;
      this.current.paused = true;
      return true;
    }
    resume() {
      if (!this.current.paused) return false;
      this.current.paused = false;
      return true;
    }
    home() {
      this.current.phase = 'home';
      this.current.paused = false;
      this.current.scanning = false;
      this.current.moving = false;
      this.pending = null;
      this.events = [];
    }
    finish(won) {
      this.current.phase = won ? 'won' : 'timeout';
      this.current.paused = false;
      this.current.scanning = false;
      this.current.moving = false;
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
      while (remaining > 0 && ['seek', 'walk', 'finale'].includes(this.current.phase)) {
        const clockRuns = this.isPlaying();
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { GameEngine, ROUTES };
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  const game = $('game');
  const dialog = $('game-dialog');
  if (!game || !dialog) return;
  const engine = new GameEngine();
  const names = { bedroom: 'Yatak odası', hallway: 'Koridor', kitchen: 'Mutfak', bathroom: 'Banyo', balcony: 'Balkon' };
  const subtitles = { bedroom: 'Gün burada başlıyor.', hallway: 'Her oda geçişi bir adım.', kitchen: 'Kupa masada seni bekliyor.', bathroom: 'Biraz su, biraz ferahlık.', balcony: 'Yeni güne bir adım daha.' };
  const wrongMessages = {
    book: 'Güzel kitap, sonra okuruz. Bizim görevimiz bir kupa bulmak!',
    shoe: 'Terlik tamam. Şimdi mutfaktaki kupayı bulalım.',
    bottle: 'Su iyi fikir! Ama telefonunda bir kupa istiyorum.',
    apple: 'Kahvaltı birazdan. Önce masadaki kupa!',
    toothbrush: 'Diş fırçası burada. Kupamız mutfakta bekliyor.'
  };
  let raf = 0;
  let previousTime = null;
  let dialogKind = '';
  let sound = false;
  let audio = null;
  let returnFocus = null;
  let navRoom = '', bedReplies = 0;

  const active = state => ['seek', 'walk', 'finale'].includes(state.phase);
  const remainingSteps = state => Math.max(0, 6 - state.steps);
  const taskTitle = state => !state.cup ? (state.mode === 'offline' ? 'Zihnini aç.' : 'Bir kupa bul.') : remainingSteps(state) ? `${remainingSteps(state)} adım daha at.` : 'Şimdi balkona çık.';
  function pose(name) { root.PoncikActor?.setPose?.(name); }
  function roomPose(state) {
    if (state.phase === 'finale' || state.phase === 'won') return 'success';
    if (state.phase === 'alarm') return 'awake';
    if (state.mode === 'offline' && !state.cup) return 'invite';
    if (state.room === 'kitchen' && !state.cup) return 'down';
    if (state.room === 'hallway') return state.cup && state.steps >= 5 ? 'invite' : 'right';
    return 'invite';
  }
  function say(message, actorPose) {
    $('guide-message').textContent = message;
    if (actorPose) pose(actorPose);
  }
  function guideMessage(state) {
    if (state.phase === 'alarm') return 'Günaydın! Telefonundaki göreve bakalım.';
    if (state.phase === 'finale' || state.phase === 'won') return 'İşte bu! Gün seninle başladı. Günaydın!';
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
      kitchen: 'İşte orada! Masadaki kupayı telefonuna göster.',
      bathroom: 'Diş fırçası burada. Bizim kupamız mutfakta!',
      balcony: 'Manzara güzel! Önce mutfaktaki kupayı bulalım.'
    }[state.room];
  }
  function chirp(kind = 'tap') {
    if (!sound) return;
    try {
      audio ??= new (root.AudioContext || root.webkitAudioContext)();
      audio.resume().catch(() => {});
      const start = audio.currentTime;
      const notes = kind === 'success' ? [523, 659, 784] : kind === 'error' ? [220, 174] : kind === 'alarm' ? [740, 554, 740] : [440];
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start + index * .13);
        gain.gain.linearRampToValueAtTime(.055, start + index * .13 + .02);
        gain.gain.exponentialRampToValueAtTime(.001, start + index * .13 + .16);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(start + index * .13); oscillator.stop(start + index * .13 + .2);
      });
    } catch {}
  }
  function paintTimer() {
    const state = engine.state, seconds = Math.max(0, Math.ceil(state.leftMs / 1000));
    $('time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    if ($('time-arc')) $('time-arc').style.strokeDashoffset = String(132 * (1 - state.leftMs / engine.duration));
    $('timer-box').classList.toggle('urgent', state.leftMs <= 15000 && engine.isPlaying());
  }
  function paintSteps() {
    const state = engine.state;
    $('steps').textContent = Math.min(6, state.steps);
    $('steps').parentElement?.setAttribute('aria-label', `Hedef: ${Math.min(6, state.steps)} / 6 adım. Toplam ${state.steps} adım.`);
    [...($('step-dots')?.children || [])].forEach((dot, index) => dot.classList.toggle('done', state.steps > index));
    $('step-dots')?.setAttribute('aria-hidden', 'true');
  }
  function recommendation(state) {
    if (state.room !== 'hallway') return 'hallway';
    if (!state.cup) return 'kitchen';
    if (state.steps >= 5) return 'balcony';
    return 'bathroom';
  }
  function paintNavigation() {
    const state = engine.state, navigation = $('navigation');
    if (navRoom !== state.room || !navigation.children.length) {
      navigation.innerHTML = ROUTES[state.room].map(([room, arrow, label, hint]) => `<button class="nav-button" data-room="${room}" aria-label="${label} ${hint}"><span class="nav-name">${hint}</span></button>`).join('');
      navRoom = state.room;
    }
    const blocked = !engine.isPlaying() || state.paused || state.scanning || state.moving;
    navigation.querySelectorAll('[data-room]').forEach(button => {
      button.disabled = blocked;
      button.classList.toggle('recommended', button.dataset.room === recommendation(state));
    });
    root.GameScene?.positionNavigation?.();
  }
  function setPhoneFocus(focused) {
    const state = engine.state;
    focused = !!focused && !['finale','timeout','home'].includes(state.phase) && (state.phase !== 'won' || game.classList.contains('relaxing'));
    game.classList.toggle('phone-focused', focused);
    $('phone-rig').inert = !focused;
    $('phone-open')?.setAttribute('aria-expanded', String(focused));
    if ($('phone-close')) { $('phone-close').hidden = !focused; $('phone-close').innerHTML = '<span aria-hidden="true">‹</span> Odaya dön'; $('phone-close').setAttribute('aria-label','Odaya dön');
      $('room-art').inert = focused || ['finale','won','timeout'].includes(state.phase); $('navigation').inert = focused || ['finale','won','timeout'].includes(state.phase); }
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
    $('room-name').setAttribute('aria-label', `${names[state.room]}. Toplam ${state.steps} adım. ${taskTitle(state)}`);
    $('phone-alarm').hidden = state.phase !== 'alarm';
    $('offline-entry').hidden = state.cup || state.phase === 'alarm'; $('camera-return').hidden = state.mode !== 'offline';
    $('camera').hidden = state.mode === 'offline';
    $('offline-play').hidden = state.mode === 'offline';
    $('offline-entry').querySelector('p').innerHTML = state.mode === 'offline' ? 'Kamerayı kullanmak ister misin?' : 'İnternetin yok mu?<br><b>Dert değil.</b>';
    root.PhoneGames?.setPaused(state.paused);
    $('phone-mission').hidden = state.phase === 'alarm';
    $('room-art').querySelectorAll('[data-object]').forEach(node=>{const selected=state.mode === 'scan' && state.selected === node.dataset.object && !state.cup;node.classList.toggle('selected',selected);node.setAttribute('aria-pressed',String(selected));});
    $('task-eyebrow').textContent = state.cup ? 'Görev tamamlandı' : state.mode === 'offline' ? 'Çevrimdışı görevin' : 'Uyanma görevin';
    $('task-title').textContent = ['finale', 'won'].includes(state.phase) ? 'Günaydın, başardın!' : taskTitle(state);
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
      scan.textContent = 'Başka nesne seç'; scan.disabled = false;
      feedback.classList.add('error');
      feedback.textContent = `Bu ${OBJECT_NAMES[state.feedback.object].toLocaleLowerCase('tr')}. Aradığımız nesne kupa.`;
    } else if (state.selected) {
      scan.textContent = 'Nesneyi tara'; scan.disabled = false;
      feedback.textContent = 'Nesne hazır. Taramayı başlatabilirsin.';
    } else {
      scan.textContent = 'Nesne seç'; scan.disabled = false;
      feedback.textContent = 'Odaya dönüp bir nesneye dokun.';
    }
    if (state.phase === 'alarm') $('game-caption').textContent = 'Telefonundaki görevi aç. Süre hazır olduğunda başlayacak.';
    else if (['finale', 'won'].includes(state.phase)) $('game-caption').textContent = 'Günaydın. Güzel bir gün seni bekliyor.';
    else if (state.cup) $('game-caption').textContent = remainingSteps(state) ? `Her oda geçişi 1 adım. ${remainingSteps(state)} adım kaldı.` : 'Adımlar tamam. Şimdi balkona çık.';
    else $('game-caption').textContent = 'Kapılara dokunarak ilerle. Bir nesneyi seçip telefonunda tara.';
    if (!state.selected && !state.feedback) $('camera-caption').textContent = state.cup ? 'Kupa tamam. Güne doğru devam et.' : 'Nesneye dokun, kadraja al.';
    else if (state.feedback?.type === 'error') $('camera-caption').textContent = `${OBJECT_NAMES[state.feedback.object]} kadrajda`;
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
      game.classList.add('epilogue'); $('room-art').inert = true; $('navigation').inert = true;
      $('phone-rig').inert = true;
      root.MorningEnding.show({seconds:elapsed,steps:state.steps}); chirp('success'); return;
    }
    root.PhoneGames?.close(); game.classList.remove('phone-game-mode');
    dialogKind = 'result'; dialog.dataset.kind = 'result';
    $('dialog-content').innerHTML = `<span class="dialog-icon" aria-hidden="true">◷</span><h2 id="dialog-title">Bir tur daha?<br>Ponçik hazır.</h2><p>60 saniye doldu. Küçük bir hareketle yeniden başlayalım.<br>Telefonundaki görevi tamamla, 6 adım at.<br>Balkonda gün seni bekliyor.</p><button class="primary" data-action="restart">Yeniden başla</button><button class="secondary" data-action="home">Ana sayfaya dön</button>`;
    dialog.setAttribute('aria-labelledby', 'dialog-title'); dialog.showModal();
    chirp(won ? 'success' : 'error');
  }
  function processEvents() {
    for (const event of engine.drain()) {
      const state = engine.state;
      if (event.type === 'room') {
        setPhoneFocus(false); mountRoom(); chirp();
        if (event.final) { pose('success'); say('İşte bu! Gün seninle başladı. Günaydın!'); }
      } else if (event.type === 'move-end') {
        paintMission(); if (engine.isPlaying()) focusRoom();
      } else if (event.type === 'wrong') {
        say(wrongMessages[event.object], 'wrong'); paintMission(); chirp('error'); if(game.classList.contains('phone-focused')) $('scan').focus({preventScroll:true});
      } else if (event.type === 'cup') {
        setPhoneFocus(false); say(guideMessage(state), 'success'); paintMission(); chirp('success'); focusRoom();
      } else if (event.type === 'celebration') {
        setPhoneFocus(false); pose('success'); paintMission();
      } else if (event.type === 'finished') {
        setPhoneFocus(false); paintMission(); showResult(event.won);
      }
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
    if (active(engine.state) && !engine.state.paused) raf = requestAnimationFrame(tick);
    else previousTime = null;
  }
  function ensureFrame() {
    if (!raf && active(engine.state) && !engine.state.paused) {
      previousTime = performance.now(); raf = requestAnimationFrame(tick);
    }
  }
  function beforeAction() { if (previousTime !== null) syncTime(); }
  function start() {
    stopFrame(); engine.restart(); navRoom = ''; bedReplies = 0;
    root.PhoneGames?.reset(); $('phone-rig').inert = false;
    root.MorningEnding?.hide(); game.classList.remove('epilogue','relaxing','phone-game-mode');
    $('room-art').inert = false; $('navigation').inert = false;
    if (dialog.open) dialog.close();
    $('welcome').hidden = true; game.hidden = false;
    game.classList.remove('paused', 'moving', 'finale', 'morning');
    $('mission-toast')?.classList.remove('show');
    mountRoom(); setPhoneFocus(true); $('accept-mission').focus({ preventScroll: true }); chirp('alarm');
  }
  function accept() {
    if (!engine.accept()) return;
    setPhoneFocus(false); say(guideMessage(engine.state), roomPose(engine.state)); paintMission(); focusRoom(); ensureFrame();
  }
  function touchBed() {
    beforeAction(); const state=engine.state;
    if(!engine.isPlaying() || state.paused || state.moving || state.scanning || game.classList.contains('phone-focused')) return;
    const replies=['Yok, hayır, olmaz! Yatağa dönüş yok. Gün bizi bekliyor!', 'Yastık çok ikna edici. Ama ben daha inatçıyım. Hadi bakalım!', 'Bir beş dakika mı? Asla! Önce şu sabaha bir merhaba.', 'O yatak akşam da burada. Şimdi sıra sende!'];
    say(replies[bedReplies++ % replies.length],'wrong'); chirp('tap');
  }
  function selectObject(node) {
    beforeAction();
    if (!engine.select(node.dataset.object)) return;
    engine.drain();
    $('room-art').querySelectorAll('[data-object]').forEach(object => object.classList.toggle('selected', object === node));
    frameSelectedObject(node);
    say(guideMessage(engine.state), node.dataset.object === 'mug' ? 'down' : roomPose(engine.state));
    $('camera-caption').textContent = `${OBJECT_NAMES[node.dataset.object]} kadrajda`;
    setPhoneFocus(true); paintMission(); chirp();
    $('scan').focus({ preventScroll: true });
  }
  function scan() {
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
    beforeAction();
    if (!engine.move(room)) return;
    processEvents(); paintMission(); ensureFrame();
  }
  function openDialog(kind) {
    beforeAction();
    if (dialog.open || !engine.pause()) return;
    stopFrame(); returnFocus = document.activeElement;
    dialogKind = kind; dialog.dataset.kind = kind;
    $('dialog-content').innerHTML = kind === 'help'
      ? `<h2 id="dialog-title">Küçük bir sabah<br>macerası.</h2><ol class="help-list"><li>Kapıların kendisine dokunarak odalarda gez. Her oda geçişi 1 adım.</li><li>Bir nesneye dokun, telefonunda incele.</li><li>“Nesneyi tara”ya bas. Aradığımız nesne bir kupa.</li><li>Kupa ve 6 adım tamamlanınca balkona çık.</li></ol><p>Adımların kupayı ararken de sayılır.<br>Klavye: yön tuşlarıyla ilerle, <kbd>E</kbd> ile tara, <kbd>Esc</kbd> ile telefonu indir veya duraklat.</p><button class="primary" data-action="resume">Anladım, devam</button>`
      : `<span class="dialog-icon" aria-hidden="true">Ⅱ</span><h2 id="dialog-title">Bir nefes arası.</h2><p>Süre ve devam eden işlemler durdu.<br>Ponçik seni bekliyor.</p><button class="primary" data-action="resume">Maceraya devam</button><button class="secondary" data-action="restart">Baştan başla</button><button class="text-button" data-action="home">Ana sayfaya dön</button>`;
    dialog.setAttribute('aria-labelledby', 'dialog-title'); paintMission(); dialog.showModal();
  }
  function resume() {
    if (!engine.resume()) return;
    if (dialog.open) dialog.close();
    paintMission();
    if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus({ preventScroll: true });
    else focusRoom();
    ensureFrame();
  }
  function home() {
    stopFrame(); engine.home(); root.PhoneGames?.reset(); root.MorningEnding?.hide(); game.classList.remove('epilogue','relaxing','phone-game-mode');
    if (dialog.open) dialog.close();
    setPhoneFocus(false); game.hidden = true; $('welcome').hidden = false;
    root.PoncikActor?.setPaused?.(true);
    $('begin').focus({ preventScroll: true });
  }

  function closePhoneGame() {
    root.PhoneGames.close(); game.classList.remove('phone-game-mode');
    if (engine.state.phase === 'won') {
      game.classList.remove('relaxing'); setPhoneFocus(false); $('phone-rig').inert = true;
      root.MorningEnding.show({seconds:Math.ceil((engine.duration-engine.state.leftMs)/1000),steps:engine.state.steps});
      document.querySelector('[data-ending="games"]').focus({preventScroll:true});
    } else { setPhoneFocus(true); paintMission(); $('scan').focus({preventScroll:true}); }
  }
  function openOfflineGame() {
    beforeAction(); if (!engine.beginOffline()) return;
    say(guideMessage(engine.state),'invite'); paintMission(); game.classList.add('phone-game-mode'); setPhoneFocus(true); root.PhoneGames.open('mission');
  }
  function openArcade() {
    if(engine.state.phase !== 'won') return;
    root.MorningEnding.hide(); $('phone-rig').inert = false;
    game.classList.add('relaxing','phone-game-mode'); setPhoneFocus(true); root.PhoneGames.open('arcade');
  }
  root.PhoneGames.mount($('phone-games'),{
    onComplete(){beforeAction();if(engine.completeOffline()){root.PhoneGames.close();game.classList.remove('phone-game-mode');processEvents();paintMission();ensureFrame();}},
    onClose:closePhoneGame,
    onScreen(){game.classList.add('phone-game-mode');}
  });
  root.MorningEnding.mount({replay:start,games:openArcade});
  $('offline-play').addEventListener('click',openOfflineGame);
  $('camera-return').addEventListener('click',()=>{beforeAction();if(engine.returnToCamera()){root.PhoneGames.close();game.classList.remove('phone-game-mode');paintMission();say(guideMessage(engine.state),roomPose(engine.state));}});
  $('welcome-art').innerHTML = root.RoomArt.render('bedroom', false);
  $('begin').addEventListener('click', start);
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
  $('phone-open')?.addEventListener('click', () => { if (!game.hidden && !engine.state.paused) { setPhoneFocus(true); if (engine.state.phase === 'alarm') $('accept-mission').focus({ preventScroll: true }); else if (!$('scan').disabled) $('scan').focus({ preventScroll: true }); } });
  document.querySelector('.phone-focus-shade').addEventListener('click',()=>{if(!game.classList.contains('phone-focused'))return;if(game.classList.contains('phone-game-mode'))closePhoneGame();else{setPhoneFocus(false);focusRoom();}});
  $('phone-close')?.addEventListener('click', () => { if(game.classList.contains('phone-game-mode')) closePhoneGame(); else {setPhoneFocus(false); focusRoom();} });
  $('sound').addEventListener('click', () => {
    sound = !sound; $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', sound ? 'Sesi kapat' : 'Sesi aç');
    const slash = $('sound').querySelector('.sound-slash'); if (slash) slash.hidden = sound;
    chirp(engine.state.phase === 'alarm' ? 'alarm' : 'tap');
  });
  $('dialog-content').addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'resume') resume();
    else if (action === 'restart') start();
    else if (action === 'home') home();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (dialogKind === 'result') home(); else resume(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active(engine.state) && !engine.state.paused) openDialog('pause'); });
  document.addEventListener('keydown', event => {
    if (game.hidden || dialog.open || event.target.closest('input,textarea,select') || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
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
