/* Local phone games. Mission completion belongs to the host adventure; practice
   rounds never grant mission progress, and closing preserves unfinished work. */
(function (root) {
  'use strict';
  const MATH_BANK = Object.freeze([
    {question:'7 + 5',answer:12}, {question:'6 × 3',answer:18},
    {question:'24 ÷ 4',answer:6}, {question:'17 − 9',answer:8},
    {question:'8 + 9',answer:17}, {question:'5 × 4',answer:20},
    {question:'30 ÷ 5',answer:6}, {question:'21 − 8',answer:13}
  ]);
  const WORD_BANK = Object.freeze([
    ['Bugün','küçük','bir','adımla','güne','başlıyorum.'],
    ['Güzel','bir','sabah','beni','bekliyor.'],
    ['Yeni','güne','birlikte','merhaba','diyelim.'],
    ['Her','yeni','gün','bir','başlangıçtır.']
  ]);
  const MEMORY_NAMES = ['Güneş','Kupa','Bulut','Yıldız'];
  const MEMORY_SIGNS = ['☀︎','☕︎','☁︎','✦'];

  class PhoneGameSession {
    constructor(random = Math.random) { this.random = random; this.reset(); }
    pick(length) { return Math.min(length-1,Math.max(0,Math.floor(this.random()*length))); }
    shuffle(values) {
      const result=[...values];
      for(let i=result.length-1;i>0;i--){const j=this.pick(i+1);[result[i],result[j]]=[result[j],result[i]];}
      return result;
    }
    newWords(index) {
      const target=WORD_BANK[index]; let pool=this.shuffle(target.map((_,id)=>id));
      if(pool.every((id,i)=>id===i))pool=pool.slice(1).concat(pool[0]);
      return {index,pool,order:[],feedback:'',correct:false};
    }
    reset() {
      this.opened=false; this.paused=false; this.mode='mission'; this.screen='math';
      this.mission={stage:'math',mathIndex:this.pick(MATH_BANK.length),words:this.newWords(this.pick(WORD_BANK.length)),feedback:'',done:false};
      this.practice=null; this.completionPending=false; this.completionSent=false;
    }
    open(mode='mission') {
      this.mode=mode==='arcade'?'arcade':'mission'; this.opened=true;
      this.screen=this.mode==='mission'?this.mission.stage:'hub';
    }
    close() { this.opened=false; }
    setPaused(value) { this.paused=!!value; }
    canAct() { return this.opened&&!this.paused; }
    startPractice(kind) {
      if(!this.canAct()||this.mode!=='arcade'||!['math','words','memory'].includes(kind))return false;
      this.screen=kind;
      if(kind==='math')this.practice={kind,index:this.pick(MATH_BANK.length),correct:false,feedback:''};
      if(kind==='words')this.practice={kind,...this.newWords(this.pick(WORD_BANK.length))};
      if(kind==='memory')this.practice={kind,deck:this.shuffle([0,0,1,1,2,2,3,3]),flipped:[],matched:[],moves:0,mismatch:false,feedback:''};
      return true;
    }
    hub() { if(!this.canAct()||this.mode!=='arcade')return false;this.screen='hub';return true; }
    math() { return MATH_BANK[this.mode==='mission'?this.mission.mathIndex:this.practice.index]; }
    answer(value) {
      if(!this.canAct()||this.screen!=='math')return false;
      const round=this.mode==='mission'?this.mission:this.practice;
      if(round.correct)return false;
      if(!Number.isInteger(value)||value!==this.math().answer){round.feedback='Bir daha bakalım. Yapabilirsin.';return false;}
      if(this.mode==='mission'){this.mission.stage='words';this.mission.feedback='';this.screen='words';}
      else{this.practice.correct=true;this.practice.feedback='Doğru! Zihnin açılıyor.';}
      return true;
    }
    words() { return this.mode==='mission'?this.mission.words:this.practice; }
    chooseWord(id) {
      if(!this.canAct()||this.screen!=='words')return false;
      const words=this.words();
      if(words.correct||!Number.isInteger(id)||id<0||id>=WORD_BANK[words.index].length||words.order.includes(id))return false;
      words.order.push(id);words.feedback='';return true;
    }
    removeWord(position) {
      if(!this.canAct()||this.screen!=='words')return false;
      const words=this.words();
      if(words.correct||!Number.isInteger(position)||position<0||position>=words.order.length)return false;
      words.order.splice(position,1);words.feedback='';return true;
    }
    clearWords() {
      if(!this.canAct()||this.screen!=='words'||this.words().correct)return false;
      this.words().order=[];this.words().feedback='';return true;
    }
    checkWords() {
      if(!this.canAct()||this.screen!=='words')return false;
      const words=this.words(),target=WORD_BANK[words.index];
      if(words.correct)return false;
      if(words.order.length!==target.length){words.feedback='Cümle için bütün kelimeleri yerleştir.';return false;}
      const canonical=words.order.every((id,i)=>id===i);
      const naturalAlternative=words.index===0 && words.order.join(',')==='0,4,1,2,3,5';
      if(!canonical&&!naturalAlternative){words.feedback='Kelimeler tamam. Sıralarını bir daha düşün.';return false;}
      words.correct=true;words.feedback='Tam yerinde! Güzel bir cümle oldu.';
      if(this.mode==='mission'){
        this.mission.done=true;this.mission.stage='complete';this.screen='complete';
        if(!this.completionSent)this.completionPending=true;
      }
      return true;
    }
    takeCompletion() {
      if(!this.completionPending||this.completionSent)return false;
      this.completionPending=false;this.completionSent=true;return true;
    }
    flipCard(index) {
      if(!this.canAct()||this.mode!=='arcade'||this.screen!=='memory')return false;
      const memory=this.practice;
      if(!Number.isInteger(index)||index<0||index>=memory.deck.length||memory.mismatch||memory.flipped.includes(index)||memory.matched.includes(index))return false;
      memory.flipped.push(index);
      if(memory.flipped.length===2){
        memory.moves++;
        const [a,b]=memory.flipped;
        if(memory.deck[a]===memory.deck[b]){
          memory.matched.push(a,b);memory.flipped=[];
          memory.feedback=memory.matched.length===8?'Dört çift de tamam. İyi eşleştirme!':'Bir çift tamam!';
        }else{memory.mismatch=true;memory.feedback='Bu ikisi farklı. Yerlerini aklında tut.';}
      }
      return true;
    }
    coverCards() {
      if(!this.canAct()||this.screen!=='memory'||!this.practice.mismatch)return false;
      this.practice.flipped=[];this.practice.mismatch=false;this.practice.feedback='';return true;
    }
  }

  if(typeof module!=='undefined'&&module.exports)module.exports={PhoneGameSession,MATH_BANK,WORD_BANK};
  if(typeof document==='undefined')return;
  let host=null,callbacks={},session=new PhoneGameSession(),lastScreen='';
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(action,label,extra='')=>`<button type="button" data-game-action="${action}" ${extra}>${label}</button>`;
  function header() {
    const hub=session.mode==='arcade'&&session.screen!=='hub';
    return `<header class="games-header">${button(hub?'hub':'close',`<span aria-hidden="true">‹</span> ${hub?'Oyunlar':session.mode==='arcade'?'Balkona dön':'Telefona dön'}`,'class="games-back"')}<span class="games-progress">${session.mode==='mission'?(session.screen==='math'?'1 / 2 · Hesap':session.screen==='words'?'2 / 2 · Cümle':'Tamam'):'Küçük bir mola'}</span></header>`;
  }
  function feedback(text,success=false) {return `<p class="games-feedback${success?' is-success':''}" role="status">${escape(text||'\u00a0')}</p>`;}
  function mathView() {
    const task=session.math(),round=session.mode==='mission'?session.mission:session.practice;
    const choices=session.shuffle([task.answer,task.answer+2,task.answer-1]);
    // Keep answer locations stable while retrying this question.
    const key=`${session.mode}:${session.mode==='mission'?session.mission.mathIndex:session.practice.index}`;
    if(round.choiceKey!==key){round.choiceKey=key;round.choices=choices;}
    return `<div class="games-intro"><h2>Küçük bir hesap.</h2><p>Doğru cevaba dokun.</p></div><p class="games-equation" aria-label="${escape(task.question)} eşittir kaç">${escape(task.question)} <span>= ?</span></p><div class="games-answers">${round.choices.map(n=>button('answer',String(n),`data-value="${n}"${round.correct?' disabled':''}`)).join('')}</div>${feedback(round.feedback,round.correct)}${round.correct?button('next','Yeni işlem','class="games-primary"'):''}`;
  }
  function wordsView() {
    const words=session.words(),target=WORD_BANK[words.index];
    return `<div class="games-intro"><h2>${session.mode==='mission'?'Cümleyi tamamla.':'Cümleyi kur.'}</h2><p>${session.mode==='mission'?'İşlem tamam. ':''}Kelimeleri sırayla seç. Geri almak için seçtiğin kelimeye dokun.</p></div><div class="games-sentence" aria-label="Kurduğun cümle">${words.order.length?words.order.map((id,position)=>button('remove',escape(target[id]),`data-value="${position}" aria-label="${escape(target[id])} kelimesini kaldır"${words.correct?' disabled':''}`)).join(''):'<span>Cümlen burada oluşacak.</span>'}</div><div class="games-word-pool" aria-label="Karışık kelimeler">${words.pool.map(id=>button('word',escape(target[id]),`data-value="${id}"${words.order.includes(id)||words.correct?' disabled':''}`)).join('')}</div>${feedback(words.feedback,words.correct)}<div class="games-actions">${words.correct?button('next','Yeni cümle','class="games-primary"'):button('check','Cümleyi kontrol et',`class="games-primary"${words.order.length!==target.length?' disabled':''}`)+button('clear','Baştan sırala','class="games-quiet"')}</div>`;
  }
  function memoryView() {
    const memory=session.practice,done=memory.matched.length===8;
    return `<div class="games-intro"><h2>Eşini bul.</h2><p>Dört küçük çift. Kartların yerini aklında tut.</p></div><div class="games-memory" aria-label="Eşleştirme kartları">${memory.deck.map((pair,index)=>{const matched=memory.matched.includes(index),open=matched||memory.flipped.includes(index);return button('card',`<span aria-hidden="true">${open?MEMORY_SIGNS[pair]:'?'}</span>`,`data-value="${index}" class="${open?'is-open':''} ${matched?'is-matched':''}" aria-label="${index+1}. kart${open?': '+MEMORY_NAMES[pair]:', kapalı'}"${matched||memory.flipped.includes(index)||memory.mismatch?' disabled':''}`);}).join('')}</div><p class="games-count">${memory.matched.length/2} / 4 çift <span>${memory.moves} deneme</span></p>${feedback(memory.feedback,done)}${memory.mismatch?button('cover','Bir daha dene','class="games-primary"'):done?button('next','Bir tur daha','class="games-primary"'):''}`;
  }
  function hubView() {
    return `<div class="games-intro"><h2>Bir oyun daha?</h2><p>Bir oyun seç, keyfine bak. Burada süre yok.</p></div><div class="games-menu">${button('practice','<span class="games-menu-sign" aria-hidden="true">＋</span><span><strong>Kısa hesap</strong><small>Bir işlem, küçük bir zihin açılışı.</small></span>','data-kind="math"')}${button('practice','<span class="games-menu-sign" aria-hidden="true">Aa</span><span><strong>Cümleyi kur</strong><small>Karışan kelimeleri yerine koy.</small></span>','data-kind="words"')}${button('practice','<span class="games-menu-sign" aria-hidden="true">☀︎</span><span><strong>Eşini bul</strong><small>Dört çift, bir parça dikkat.</small></span>','data-kind="memory"')}</div>`;
  }
  function completeView() {
    return '<div class="games-complete"><span class="games-complete-sign" aria-hidden="true">✓</span><h2>Zihnin hazır.<br>Gün seni bekliyor.</h2><p>İşlem ve cümle tamamlandı. Şimdi adımlarını tamamlayıp balkona çıkabilirsin.</p>'+button('close','<span aria-hidden="true">‹</span> Telefona dön','class="games-primary"')+'</div>';
  }
  function render(focus=false) {
    if(!host)return;
    host.hidden=!session.opened;host.inert=session.paused;host.dataset.paused=String(session.paused);
    if(!session.opened)return;
    host.innerHTML=header()+`<main class="games-content">${session.screen==='hub'?hubView():session.screen==='math'?mathView():session.screen==='words'?wordsView():session.screen==='memory'?memoryView():completeView()}</main>`;
    if(focus){host.scrollTop=0;const heading=host.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
    if(lastScreen!==`${session.mode}:${session.screen}`){lastScreen=`${session.mode}:${session.screen}`;callbacks.onScreen?.(session.mode,session.screen);}
  }
  function handle(event) {
    const control=event.target.closest('[data-game-action]');
    if(!control||!host.contains(control)||!session.canAct())return;
    const action=control.dataset.gameAction,value=Number(control.dataset.value),screen=session.screen;
    if(action==='close'){
      const detail={mode:session.mode,completed:session.mission.done};session.close();render();callbacks.onClose?.(detail);return;
    }
    if(action==='hub')session.hub();
    else if(action==='practice')session.startPractice(control.dataset.kind);
    else if(action==='answer')session.answer(value);
    else if(action==='word')session.chooseWord(value);
    else if(action==='remove')session.removeWord(value);
    else if(action==='clear')session.clearWords();
    else if(action==='check')session.checkWords();
    else if(action==='card')session.flipCard(value);
    else if(action==='cover')session.coverCards();
    else if(action==='next')session.startPractice(session.screen);
    const changed=screen!==session.screen||['next','hub','practice'].includes(action);
    render(changed);
    if(!changed&&event.detail===0){
      const selector=action==='answer'?`[data-game-action="answer"][data-value="${value}"]:not(:disabled)`
        :action==='check'?'[data-game-action="remove"]:not(:disabled)'
        :['card','cover'].includes(action)?'[data-game-action="card"]:not(:disabled)'
        :'[data-game-action="word"]:not(:disabled)';
      const target=host.querySelector(selector)||host.querySelector('[data-game-action="cover"], [data-game-action="next"], [data-game-action="check"]:not(:disabled)');
      target?.focus({preventScroll:true});
    }
    if(session.takeCompletion())callbacks.onComplete?.();
  }
  root.PhoneGames={
    mount(element,options={}) {
      if(host)host.removeEventListener('click',handle);
      host=element;callbacks=options;host.classList.add('games-panel');host.setAttribute('aria-label','Ponçik’in mini oyunları');host.hidden=true;host.addEventListener('click',handle);lastScreen='';return this;
    },
    open(mode='mission'){session.open(mode);render(true);},
    close(){session.close();render();},
    reset(){session.reset();lastScreen='';render();},
    setPaused(value){session.setPaused(value);if(host){host.inert=session.paused;host.dataset.paused=String(session.paused);}}
  };
})(typeof window!=='undefined'?window:globalThis);
