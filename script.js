// ── SOCKET.IO ────────────────────────────────────────────────────────────────
// En desarrollo: conecta al mismo servidor. En producción: usa la URL de Render (config.js)
const socket = io(window.SOCKET_SERVER || undefined);

// ── ESTADO ───────────────────────────────────────────────────────────────────
let isHost = false;
let myName = '';
let roomCode = '';
let myScore = 0;
let timerInterval = null;
let timerSeconds = 20;
let totalTimerSeconds = 20;
let hasAnswered = false;
let currentShuffledOptions = [];
let autoAdvanceInterval = null;
let autoAdvanceSeconds = 8;
let correctAnswerIndex = -1;
let globalUsedLifelines = { '5050': false, 'call': false, 'ask': false };
let eliminatedOptions = new Set();

const LETTERS = ['A', 'B', 'C', 'D'];
const DIFF_LABEL = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' };
const DIFF_CLASS = { easy: 'diff-easy', medium: 'diff-medium', hard: 'diff-hard' };

// ── AUDIO ────────────────────────────────────────────────────────────────────
let audioCtx = null;
function getAC() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTones(notes, type = 'sine', vol = 0.35) {
  const ctx = getAC();
  notes.forEach(([freq, t, dur]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.value = freq;
    const s = ctx.currentTime + t;
    g.gain.setValueAtTime(vol, s);
    g.gain.exponentialRampToValueAtTime(0.001, s + dur);
    o.start(s); o.stop(s + dur + 0.05);
  });
}
const playCorrect   = () => playTones([[523,0,.25],[659,.12,.25],[784,.24,.25],[1047,.36,.45]]);
const playWrong     = () => playTones([[440,0,.25],[330,.15,.25],[220,.3,.45]], 'sawtooth', 0.25);
const playCountdown = () => playTones([[1100,0,.1],[1100,.25,.1],[1100,.5,.1]], 'sine', 0.18);
const playFanfare   = () => playTones([[523,0,.2],[659,.2,.2],[784,.4,.2],[1047,.6,.4],[784,1,.15],[1047,1.15,.6]]);
const playTick      = () => playTones([[900,0,.06]], 'square', 0.06);
const play5050      = () => playTones([[784,0,.2],[659,.2,.2],[523,.4,.3]], 'sine', 0.3);
const playCall      = () => playTones([[440,0,.15],[440,.2,.15],[880,.4,.2]], 'sine', 0.4);
const playAsk       = () => playTones([[659,0,.1],[784,.15,.1],[659,.3,.1],[784,.45,.15]], 'sine', 0.3);

// ── MÚSICA DE FONDO ──────────────────────────────────────────────────────────
const BgMusic = (() => {
  let masterGain = null;
  let loopTimer  = null;
  let muted      = false;
  let current    = null; // 'lobby' | 'thinking' | null

  function ctx() { return getAC(); }

  function getMaster() {
    if (!masterGain) {
      masterGain = ctx().createGain();
      masterGain.gain.value = 0.22;
      masterGain.connect(ctx().destination);
    }
    return masterGain;
  }

  // Emite una nota a través del masterGain
  function n(freq, start, dur, type = 'sine', vol = 1) {
    const c = ctx(), now = c.currentTime;
    const osc = c.createOscillator(), g = c.createGain();
    osc.connect(g); g.connect(getMaster());
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, now + start);
    g.gain.linearRampToValueAtTime(vol, now + start + 0.06);
    g.gain.setValueAtTime(vol, now + start + dur * 0.75);
    g.gain.linearRampToValueAtTime(0.001, now + start + dur);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  }

  function stop() {
    clearTimeout(loopTimer);
    loopTimer = null;
    current = null;
  }

  // ── Música del lobby: dramática y misteriosa ──────────────────────────────
  // Progresión Am → F → G → Am con pulsos de bajo, tempo ~60 BPM, loop 8s
  function lobbyBar() {
    if (muted || current !== 'lobby') return;
    // Bajo (pulso por tiempo)
    [[110,0],[110,.5],[98,.5],[110,1],[110,1.5],[87.3,2],[98,2.5],[110,3]].forEach(([f,t]) => n(f,t,.45,'sine',.55));
    // Acordes medios (Am, F, G)
    [[220,0,1.8,'sine',.18],[261.6,0,1.8,'sine',.15],[329.6,0,1.8,'sine',.12],   // Am
     [174.6,2,1.8,'sine',.18],[220,2,1.8,'sine',.15],[261.6,2,1.8,'sine',.12],  // F
     [196,4,1.8,'sine',.18],[246.9,4,1.8,'sine',.15],[293.7,4,1.8,'sine',.12],  // G
     [220,6,1.8,'sine',.18],[261.6,6,1.8,'sine',.15],[329.6,6,1.8,'sine',.12]   // Am
    ].forEach(([f,t,d,tp,v]) => n(f,t,d,tp,v));
    // Melodía alta (línea dramática)
    [[440,0,.35],[392,0.4,.3],[440,.8,.4],[523.3,1.2,.5],[493.9,1.8,.35],
     [440,2.2,.3],[392,2.6,.4],[349.2,3.1,.5],[392,3.6,.35],[440,4.1,.3],
     [493.9,4.6,.4],[523.3,5.0,.5],[493.9,5.5,.3],[440,6.0,.4],[392,6.5,.35],[440,7.0,.6]
    ].forEach(([f,t,d]) => n(f,t,d,'sine',.22));
    loopTimer = setTimeout(lobbyBar, 8000);
  }

  // ── Música de tensión: estilo ¿Quién Quiere Ser Millonario? ─────────────
  // Ritmo pulsante en Do menor con melodía ascendente/descendente, loop 4s
  function thinkingBar() {
    if (muted || current !== 'thinking') return;
    // Bajo pulsante (C2) — cada corchea
    [0,.25,.5,.75,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,3.75].forEach(t =>
      n(65.4, t, .18, 'sine', t % .5 === 0 ? .55 : .35)
    );
    // Quinta + octava en el bajo (G2)
    [.5,1.5,2.5,3.5].forEach(t => n(98, t, .15, 'sine', .3));
    // Melodía de tensión (escala C menor: C4,D4,Eb4,F4,G4,Ab4,Bb4,C5)
    const mel = [
      [261.6,0,.22],[293.7,.25,.2],[311.1,.5,.22],[349.2,.75,.2],
      [392,.95,.25],[415.3,1.2,.22],[466.2,1.45,.22],[523.3,1.7,.3],
      [493.9,2.0,.22],[466.2,2.22,.2],[415.3,2.45,.22],[392,2.68,.2],
      [349.2,2.9,.22],[311.1,3.1,.2],[293.7,3.3,.22],[261.6,3.5,.4]
    ];
    mel.forEach(([f,t,d]) => n(f, t, d, 'sine', .28));
    // Armónico de tensión (quinta sobre la melodía)
    [[392,0,.18],[440,.25,.15],[466.2,.5,.18],[523.3,.75,.15],
     [587.3,1,.2],[622.3,1.25,.18],[698.5,1.5,.18],[784,1.75,.25]
    ].forEach(([f,t,d]) => n(f, t, d, 'triangle', .1));
    // Pulso de redoblante sintético (ruido blanco simulado con sawtooth)
    [0, 1, 2, 3].forEach(t => n(200+Math.random()*100, t, .08, 'sawtooth', .06));
    loopTimer = setTimeout(thinkingBar, 4000);
  }

  function toggleMute() {
    muted = !muted;
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(ctx().currentTime);
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.22, ctx().currentTime, 0.15);
    }
    const btn = document.getElementById('mute-btn');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
    return muted;
  }

  return {
    stop,
    playLobby() {
      stop();
      current = 'lobby';
      lobbyBar();
    },
    playThinking() {
      stop();
      current = 'thinking';
      thinkingBar();
    },
    toggleMute,
    isMuted() { return muted; }
  };
})();

// ── NAVEGACIÓN ────────────────────────────────────────────────────────────────
function goTo(id) {
  document.querySelectorAll('.mp-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ── ACCIONES HOST ─────────────────────────────────────────────────────────────
function createRoom() {
  const nameEl  = document.getElementById('host-name-input');
  const numQEl  = document.getElementById('host-num-q');
  const timerEl = document.getElementById('host-timer');
  const errEl   = document.getElementById('host-setup-error');
  const name    = nameEl.value.trim();
  if (!name) { showError(errEl, 'Ingresa tu nombre para continuar.'); nameEl.focus(); return; }
  errEl.style.display = 'none';
  isHost = true;
  myName = name;
  socket.emit('create-room', {
    hostName: name,
    numQuestions: parseInt(numQEl.value),
    timerPerQuestion: parseInt(timerEl.value)
  });
}

function startGame()  { socket.emit('start-game'); }
function skipReveal() { socket.emit('skip-reveal'); }

// ── ACCIONES JUGADOR ──────────────────────────────────────────────────────────
function joinRoom() {
  const codeEl = document.getElementById('join-code-input');
  const nameEl = document.getElementById('join-name-input');
  const errEl  = document.getElementById('join-error');
  const code   = codeEl.value.trim().toUpperCase();
  const name   = nameEl.value.trim();
  if (!code || code.length !== 6) { showError(errEl, 'Ingresa un código de sala válido (6 caracteres).'); codeEl.focus(); return; }
  if (!name)                       { showError(errEl, 'Ingresa tu apodo para continuar.'); nameEl.focus(); return; }
  errEl.style.display = 'none';
  isHost = false;
  myName = name;
  socket.emit('join-room', { code, playerName: name });
}

function submitAnswer(answerIndex, btn) {
  if (hasAnswered) return;
  hasAnswered = true;
  btn.classList.add('mm-selected');
  document.querySelectorAll('.mm-opt-btn').forEach(b => b.disabled = true);
  socket.emit('submit-answer', { answerIndex });
  document.getElementById('player-answered-msg').style.display = 'flex';
}

function useLifeline(type) {
  if (isHost || hasAnswered || globalUsedLifelines[type]) return;

  const btn = document.getElementById(`btn-${type.replace('5050', '50-50')}`);
  if (!btn || btn.disabled) return;

  globalUsedLifelines[type] = true;
  btn.disabled = true;

  if (type === '5050') {
    use5050();
  } else if (type === 'call') {
    useCall();
  } else if (type === 'ask') {
    useAsk();
  }
}

function use5050() {
  play5050();
  const incorrectIndices = [];
  for (let i = 0; i < 4; i++) {
    if (i !== correctAnswerIndex) {
      incorrectIndices.push(i);
    }
  }

  const toEliminate = incorrectIndices.slice(0, 2);
  toEliminate.forEach(idx => {
    eliminatedOptions.add(idx);
    const btn = document.querySelector(`.mm-opt-${['a','b','c','d'][idx]}`);
    if (btn) btn.style.opacity = '0.3';
  });
}

function useCall() {
  playCall();
  const correctBtn = document.querySelector(`.mm-opt-${['a','b','c','d'][correctAnswerIndex]}`);
  if (correctBtn) {
    correctBtn.style.boxShadow = '0 0 20px rgba(0, 200, 83, 0.8), inset 0 0 10px rgba(0, 200, 83, 0.3)';
    correctBtn.classList.add('mm-lifeline-hint');
  }
}

function useAsk() {
  playAsk();
  const correctBtn = document.querySelector(`.mm-opt-${['a','b','c','d'][correctAnswerIndex]}`);
  if (correctBtn) {
    correctBtn.style.boxShadow = '0 0 20px rgba(100, 200, 255, 0.8), inset 0 0 10px rgba(100, 200, 255, 0.3)';
    correctBtn.classList.add('mm-lifeline-hint');
  }
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderPlayerList(listId, countId, players) {
  const el = document.getElementById(listId);
  if (!el) return;
  el.innerHTML = '';
  players.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'mm-player-chip';
    chip.innerHTML = `<span class="mm-chip-av">${p.name[0].toUpperCase()}</span><span>${escHtml(p.name)}</span>`;
    el.appendChild(chip);
  });
  if (countId) document.getElementById(countId).textContent = players.length;
}

function renderLeaderboard(containerId, lb) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  lb.forEach(e => {
    const mine = e.id === socket.id;
    const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`;
    const delta = e.lastPoints !== undefined
      ? `<span class="mm-lb-delta ${e.lastPoints > 0 ? 'pos' : 'zero'}">+${e.lastPoints.toLocaleString()}</span>`
      : '';
    const row = document.createElement('div');
    row.className = 'mm-lb-row' + (mine ? ' mm-lb-mine' : '');
    row.innerHTML = `
      <span class="mm-lb-rank">${medal}</span>
      <span class="mm-lb-name">${escHtml(e.name)}${mine ? ' <em>(tú)</em>' : ''}</span>
      <span class="mm-lb-score">${e.score.toLocaleString()} pts</span>${delta}`;
    el.appendChild(row);
  });
}

// ── TIMER (circular SVG) ──────────────────────────────────────────────────────
const ARC_LEN = 163.4; // 2π × 26

function startTimer(seconds) {
  stopTimer();
  timerSeconds    = seconds;
  totalTimerSeconds = seconds;
  const arc = document.getElementById('timer-arc');
  const num = document.getElementById('timer-num');

  function tick() {
    const pct = timerSeconds / totalTimerSeconds;
    if (arc) arc.style.strokeDashoffset = ARC_LEN * (1 - pct);
    if (num) num.textContent = timerSeconds;

    // Color transitions
    if (arc) {
      arc.style.stroke = timerSeconds <= 5 ? '#e53935'
                       : timerSeconds <= Math.ceil(totalTimerSeconds * 0.4) ? '#f59e0b'
                       : '#FFD700';
    }
    if (timerSeconds <= 5 && timerSeconds > 0) playCountdown();
    if (timerSeconds <= 0) { stopTimer(); return; }
    timerSeconds--;
  }

  tick();
  timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

// ── AUTO-ADVANCE BAR ──────────────────────────────────────────────────────────
function startAutoBar(seconds) {
  clearInterval(autoAdvanceInterval);
  autoAdvanceSeconds = seconds;
  const bar   = document.getElementById('auto-bar');
  const label = document.getElementById('auto-bar-label');
  const wrap  = document.getElementById('auto-bar-wrap');
  if (wrap) wrap.style.display = 'block';

  function tick() {
    const pct = autoAdvanceSeconds / seconds;
    if (bar)   bar.style.width = (pct * 100) + '%';
    if (label) label.textContent = `Próxima pregunta en ${autoAdvanceSeconds}s…`;
    if (autoAdvanceSeconds <= 0) { clearInterval(autoAdvanceInterval); return; }
    autoAdvanceSeconds--;
  }
  tick();
  autoAdvanceInterval = setInterval(tick, 1000);
}

function stopAutoBar() {
  clearInterval(autoAdvanceInterval);
  const wrap = document.getElementById('auto-bar-wrap');
  if (wrap) wrap.style.display = 'none';
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
function spawnConfetti() {
  const wrap = document.getElementById('final-confetti');
  if (!wrap) return;
  wrap.innerHTML = '';
  const colors = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD'];
  for (let i = 0; i < 90; i++) {
    const c = document.createElement('div');
    c.className = 'mm-confetti-piece';
    c.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-delay:${Math.random()*2}s;animation-duration:${2+Math.random()*2}s;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;border-radius:${Math.random()>.5?'50%':'2px'};`;
    wrap.appendChild(c);
  }
}

// ── SOCKET EVENTS ─────────────────────────────────────────────────────────────

socket.on('room-created', ({ code, timerPerQuestion }) => {
  roomCode = code;
  document.getElementById('host-room-code').textContent = code;
  document.getElementById('host-config-info').textContent =
    `⏱ ${timerPerQuestion}s por pregunta`;
  renderPlayerList('host-player-list', 'host-player-count', []);
  document.getElementById('host-start-btn').disabled = true;
  BgMusic.playLobby();
  goTo('screen-host-lobby');
});

socket.on('player-joined', ({ playerList }) => {
  renderPlayerList('host-player-list', 'host-player-count', playerList);
  const btn  = document.getElementById('host-start-btn');
  const hint = document.getElementById('host-start-hint');
  btn.disabled = playerList.length < 1;
  hint.textContent = playerList.length >= 1
    ? `✅ ${playerList.length} jugador(es) listo(s) — puedes iniciar`
    : 'Conecta al menos 1 jugador para iniciar';
  // Animate last chip
  const chips = document.querySelectorAll('#host-player-list .mm-player-chip');
  if (chips.length) chips[chips.length - 1].classList.add('bounce-in');
});

socket.on('player-list-update', (playerList) => {
  renderPlayerList('player-lobby-list', 'player-count-badge', playerList);
  renderPlayerList('host-player-list', 'host-player-count', playerList);
});

socket.on('room-joined', ({ code, playerList }) => {
  roomCode = code;
  document.getElementById('player-room-code-display').textContent = code;
  document.getElementById('player-name-display').textContent = myName;
  renderPlayerList('player-lobby-list', 'player-count-badge', playerList);
  BgMusic.playLobby();
  goTo('screen-player-lobby');
});

socket.on('join-error',  (msg) => showError(document.getElementById('join-error'), msg));
socket.on('start-error', (msg) => alert(msg));

socket.on('game-started', () => {
  myScore = 0;
  globalUsedLifelines = { '5050': false, 'call': false, 'ask': false };
  BgMusic.playThinking();
  goTo('screen-question');
});

socket.on('show-question', ({ questionNum, totalQuestions, text, options, difficulty, timeLimit, correctIndex }) => {
  hasAnswered = false;
  BgMusic.playThinking();
  currentShuffledOptions = options;
  correctAnswerIndex = correctIndex || 0;
  eliminatedOptions.clear();

  // Update header
  document.getElementById('q-counter').textContent = `${questionNum} / ${totalQuestions}`;
  const diff = document.getElementById('q-difficulty');
  diff.textContent = DIFF_LABEL[difficulty] || 'Media';
  diff.className = 'mm-diff-badge ' + (DIFF_CLASS[difficulty] || 'diff-medium');

  // Question text
  document.getElementById('q-text').textContent = text;

  // Score ticker
  const ticker = document.getElementById('score-ticker');
  const scoreVal = document.getElementById('my-score-val');
  if (!isHost) {
    ticker.style.display = 'flex';
    scoreVal.textContent = myScore.toLocaleString();
  }

  // Update lifeline buttons based on global usage
  if (!isHost) {
    ['50-50', 'call', 'ask'].forEach(name => {
      const type = name === '50-50' ? '5050' : name;
      const btn = document.getElementById(`btn-${name}`);
      if (btn) {
        btn.disabled = globalUsedLifelines[type];
        btn.style.opacity = globalUsedLifelines[type] ? '0.3' : '1';
      }
    });
  }

  // Build options (Millonario style: A top-left, B top-right, C bottom-left, D bottom-right)
  const grid = document.getElementById('opts-grid');
  grid.innerHTML = '';
  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = `mm-opt-btn mm-opt-${['a','b','c','d'][i]}`;
    btn.innerHTML = `<span class="mm-opt-letter">${LETTERS[i]}</span><span class="mm-opt-text">${escHtml(opt)}</span>`;
    if (isHost) {
      btn.disabled = true;
      btn.classList.add('mm-host-view');
    } else {
      btn.onclick = () => submitAnswer(i, btn);
      btn.style.opacity = '1';
      btn.style.boxShadow = 'none';
    }
    grid.appendChild(btn);
  });

  // Reset player msg
  document.getElementById('player-answered-msg').style.display = 'none';

  // Host progress bar
  const pb = document.getElementById('host-progress-bar');
  pb.style.display = isHost ? 'flex' : 'none';
  if (isHost) document.getElementById('host-progress-text').textContent = '0 / ? respondieron';

  // Hide lifelines for host
  const lifelinesContainer = document.getElementById('lifelines-container');
  if (lifelinesContainer) {
    lifelinesContainer.style.display = isHost ? 'none' : 'flex';
  }

  startTimer(timeLimit);
  stopAutoBar();
  goTo('screen-question');
});

socket.on('answer-received', ({ correct, points }) => {
  // Highlight selected button
  const sel = document.querySelector('.mm-opt-btn.mm-selected');
  if (sel) {
    sel.classList.remove('mm-selected');
    sel.classList.add(correct ? 'mm-correct' : 'mm-wrong');
  }
  if (correct) { myScore += points; playCorrect(); }
  else playWrong();
});

socket.on('answer-progress', ({ answered, total }) => {
  const el = document.getElementById('host-progress-text');
  if (el) el.textContent = `${answered} / ${total} respondieron`;
});

socket.on('question-ended', ({ correctIndex, justification, leaderboard, revealTime, isLast }) => {
  stopTimer();
  BgMusic.stop();

  // Highlight correct option in question screen briefly
  document.querySelectorAll('.mm-opt-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIndex) btn.classList.add('mm-correct');
  });

  const correctText = currentShuffledOptions[correctIndex] || '—';

  // Find my result
  const me = leaderboard.find(e => e.id === socket.id);
  const myPts = me ? me.lastPoints : 0;
  const correct = myPts > 0;

  // Build reveal
  const revResult  = document.getElementById('reveal-result');
  const revIcon    = document.getElementById('reveal-icon');
  const revVerdict = document.getElementById('reveal-verdict');
  const revPts     = document.getElementById('reveal-points');

  if (isHost) {
    revResult.style.display = 'none';
  } else {
    revResult.style.display = '';
    if (!me) {
      revIcon.textContent    = '⏱';
      revVerdict.textContent = 'Sin respuesta';
      revPts.textContent     = '+0 pts';
      revResult.className    = 'mm-reveal-result mm-reveal-miss';
    } else if (correct) {
      revIcon.textContent    = '✓';
      revVerdict.textContent = '¡Correcto!';
      revPts.textContent     = `+${myPts.toLocaleString()} pts`;
      revResult.className    = 'mm-reveal-result mm-reveal-ok';
    } else {
      revIcon.textContent    = '✗';
      revVerdict.textContent = 'Incorrecto';
      revPts.textContent     = '+0 pts';
      revResult.className    = 'mm-reveal-result mm-reveal-bad';
    }
  }

  document.getElementById('reveal-correct-text').textContent =
    `${LETTERS[correctIndex]}) ${correctText}`;
  document.getElementById('reveal-justification').textContent = justification;
  renderLeaderboard('reveal-leaderboard', leaderboard);

  // Host: show skip button; auto-bar for everyone
  document.getElementById('reveal-skip-btn').style.display = isHost ? 'block' : 'none';

  if (!isLast) {
    startAutoBar(revealTime);
  } else {
    stopAutoBar();
    const wrap = document.getElementById('auto-bar-wrap');
    if (wrap) wrap.style.display = 'none';
  }

  goTo('screen-reveal');
});

socket.on('game-over', ({ leaderboard }) => {
  stopTimer();
  stopAutoBar();
  BgMusic.stop();

  // Podium
  const podium = document.getElementById('final-podium');
  podium.innerHTML = '';
  const top = leaderboard.slice(0, 3);
  // Visual order: 2nd | 1st | 3rd
  const displayOrder = top.length >= 3 ? [top[1], top[0], top[2]]
                     : top.length === 2 ? [null, top[0], top[1]]
                     : [null, top[0] || null, null];
  const posClass  = ['mm-p-second', 'mm-p-first', 'mm-p-third'];
  const medals    = ['🥈', '🥇', '🥉'];
  const heights   = ['80px', '115px', '60px'];

  displayOrder.forEach((entry, i) => {
    if (!entry) { const sp = document.createElement('div'); sp.className = `mm-podium-col ${posClass[i]} mm-p-empty`; podium.appendChild(sp); return; }
    const mine = entry.id === socket.id;
    const col  = document.createElement('div');
    col.className = `mm-podium-col ${posClass[i]}${mine ? ' mm-p-mine' : ''}`;
    col.innerHTML = `
      <div class="mm-p-medal">${medals[i]}</div>
      <div class="mm-p-name">${escHtml(entry.name)}${mine ? '<br><small>(tú)</small>' : ''}</div>
      <div class="mm-p-score">${entry.score.toLocaleString()} pts</div>
      <div class="mm-p-block" style="height:${heights[i]}"></div>`;
    podium.appendChild(col);
  });

  renderLeaderboard('final-leaderboard', leaderboard);
  playFanfare();
  spawnConfetti();
  goTo('screen-final');
});

socket.on('host-disconnected', () => {
  stopTimer();
  stopAutoBar();
  BgMusic.stop();
  alert('El anfitrión se desconectó. El juego ha terminado.');
  location.reload();
});

// ── ENTER KEY ─────────────────────────────────────────────────────────────────
document.getElementById('host-name-input').addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(); });
document.getElementById('join-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('join-name-input').focus(); });
document.getElementById('join-name-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
