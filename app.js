/**
 * app.js
 * Kanji Flashcard & Quiz - Application Logic
 * Wrapped in IIFE module pattern to avoid global scope pollution
 * 
 * Features:
 * - Flashcard with flip animation
 * - Quiz with multiple choice (2 modes)
 * - SRS (Spaced Repetition System) based on SM-2 algorithm
 * - Progress tracking via localStorage
 * - List view with filtering
 */
"use strict";

const App = (function() {
  // ── DOM CACHE ──────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const DOM = {};

  /** Cache all frequently used DOM elements */
  function cacheDom() {
    DOM.fcCurrent = $('fc-current');
    DOM.fcTotal = $('fc-total');
    DOM.cardInner = $('card-inner');
    DOM.kanjiFront = $('kanji-front');
    DOM.cardNumFront = $('card-num-front');
    DOM.kanjiBackChar = $('kanji-back-char');
    DOM.kanjiBackMeaning = $('kanji-back-meaning');
    DOM.kanjiBackId = $('kanji-back-id');
    DOM.kanjiBackOn = $('kanji-back-on');
    DOM.kanjiBackKun = $('kanji-back-kun');
    DOM.kanjiBackEx = $('kanji-back-ex');
    DOM.prevBtn = $('prev-btn');
    DOM.nextBtn = $('next-btn');
    DOM.miniGridWrap = $('mini-grid-wrap');
    DOM.miniGridBtn = $('mini-grid-btn');
    DOM.kanjiGrid = $('kanji-grid');
    DOM.quizSetup = $('quiz-setup');
    DOM.quizActive = $('quiz-active');
    DOM.quizResult = $('quiz-result');
    DOM.quizProgress = $('quiz-progress');
    DOM.quizQNum = $('quiz-q-num');
    DOM.quizQuestion = $('quiz-question');
    DOM.answerArea = $('answer-area');
    DOM.feedbackPanel = $('feedback-panel');
    DOM.feedbackHeader = $('feedback-header');
    DOM.fbKanji = $('fb-kanji');
    DOM.fbInfo = $('fb-info');
    DOM.nextQBtn = $('next-q-btn');
    DOM.pillCorrect = $('pill-correct');
    DOM.pillWrong = $('pill-wrong');
    DOM.pillSrs = $('pill-srs');
    DOM.ringFill = $('ring-fill');
    DOM.ringPct = $('ring-pct');
    DOM.resultGrade = $('result-grade');
    DOM.rsCorrect = $('rs-correct');
    DOM.rsWrong = $('rs-wrong');
    DOM.rsTotal = $('rs-total');
    DOM.wrongList = $('wrong-list');
    DOM.listGrid = $('list-grid');
    DOM.progSummary = $('prog-summary');
    DOM.progTable = $('prog-table');
    DOM.storageStatus = $('storage-status');
    DOM.kanjiSelector = $('kanji-selector');
    DOM.groupBtns = $('group-btns');
    DOM.selCountLabel = $('sel-count-label');
    DOM.srsToggle = $('srs-toggle');
    DOM.srsBanner = $('srs-due-banner');
    DOM.srsDueCount = $('srs-due-count');
    DOM.filterAll = $('filter-all');
  }


  // ── STATE ──────────────────────────────────────────────────────────────────
  let progressData = {};
  let fcOrder = [];
  let fcIndex = 0;
  let isFlipped = false;

  // Quiz state
  let qMode = 'kanji-to-reading';
  let selectedIdxs = new Set();
  let quizQueue = [];
  let srsQueue = [];
  let quizIdx = 0;
  let quizScore = 0;
  let quizWrongLog = [];
  let quizTotalAsked = 0;
  let srsEnabled = true;
  let answered = false;
  let quizView = 'setup';

  // ── PROGRESS / STORAGE ─────────────────────────────────────────────────────

  /** Load progress data from localStorage */
  function loadProgress() {
    try {
      const saved = localStorage.getItem('kanjiProgress');
      if (saved) progressData = JSON.parse(saved);
    } catch (e) {
      progressData = {};
    }
  }

  /** Save progress data to localStorage */
  function saveProgress() {
    try {
      localStorage.setItem('kanjiProgress', JSON.stringify(progressData));
    } catch (e) {
      // localStorage unavailable, keep in memory
    }
  }

  /** Initialize or get card progress entry */
  function initCard(kanjiN) {
    if (!progressData[kanjiN]) {
      progressData[kanjiN] = {
        correct: 0,
        wrong: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReview: 0,
        lastReview: 0,
        streak: 0
      };
    }
    return progressData[kanjiN];
  }

  /**
   * Record quiz answer and update SRS using SM-2 algorithm
   * @param {number} kanjiN - Kanji number
   * @param {boolean} isCorrect - Whether answer was correct
   */
  function recordProgress(kanjiN, isCorrect) {
    const p = initCard(kanjiN);
    const now = Date.now();
    p.lastReview = now;

    if (isCorrect) {
      p.correct++;
      p.streak++;
      if (p.streak === 1) p.interval = 1;
      else if (p.streak === 2) p.interval = 6;
      else p.interval = Math.round(p.interval * p.easeFactor);
      p.easeFactor = Math.min(2.5, p.easeFactor + 0.1);
    } else {
      p.wrong++;
      p.streak = 0;
      p.interval = 1;
      p.easeFactor = Math.max(1.3, p.easeFactor - 0.2);
    }

    p.nextReview = now + p.interval * 24 * 60 * 60 * 1000;
    saveProgress();
  }

  /** Get kanji cards that are due for SRS review */
  function getDueCards() {
    const now = Date.now();
    return KANJI.filter(k => {
      const p = progressData[k.n];
      if (!p) return false;
      return now >= p.nextReview && p.interval > 0;
    });
  }

  /** Clear all progress data */
  function clearProgress() {
    if (!confirm('Hapus semua progress? Data tidak bisa dikembalikan.')) return;
    progressData = {};
    localStorage.removeItem('kanjiProgress');
    renderProgress();
  }


  // ── FLASHCARD ──────────────────────────────────────────────────────────────

  /** Build the mini grid navigator */
  function buildGrid() {
    const grid = DOM.kanjiGrid;
    grid.innerHTML = '';
    fcOrder.forEach((dataIdx, pos) => {
      const k = KANJI[dataIdx];
      const el = document.createElement('div');
      el.className = 'kanji-thumb' + (pos === fcIndex ? ' current-thumb' : '');
      el.id = 'thumb-' + pos;
      el.innerHTML = `<span class="char">${k.char}</span><span class="num">${k.n}</span>`;
      el.addEventListener('click', () => jumpCard(pos));
      grid.appendChild(el);
    });
  }

  /** Update flashcard display with current kanji */
  function updateCard() {
    const k = KANJI[fcOrder[fcIndex]];
    DOM.kanjiFront.textContent = k.char;
    DOM.cardNumFront.textContent = `No. ${k.n}`;
    DOM.kanjiBackChar.textContent = k.char;
    DOM.kanjiBackMeaning.textContent = k.meaning;
    DOM.kanjiBackId.textContent = `\u{1F1EE}\u{1F1E9} ${k.id}`;
    DOM.kanjiBackOn.textContent = k.on || '\u2014';
    DOM.kanjiBackKun.textContent = k.kun || '\u2014';

    // Example block
    let exHtml = `<span class="ex-on">\u97F3: ${k.on_ex || '\u2014'}</span><br>` +
                 `<span class="ex-kun">\u8A13: ${k.kun_ex || '\u2014'}</span>`;
    if (k.sentence) {
      exHtml += `<div class="sentence-block">
        <div class="sentence-label">\u2015 CONTOH KALIMAT</div>
        <div class="sentence-jp">${k.sentence}</div>
        <div class="sentence-id">${k.sentence_id}</div>
      </div>`;
    }
    DOM.kanjiBackEx.innerHTML = exHtml;

    // Update counter
    DOM.fcCurrent.textContent = fcIndex + 1;
    DOM.fcTotal.textContent = fcOrder.length;

    // Show progress status on card number
    const prog = progressData[k.n] || { correct: 0, wrong: 0 };
    const tot = prog.correct + prog.wrong;
    if (tot > 0) {
      const a = Math.round(prog.correct / tot * 100);
      DOM.cardNumFront.style.color = a >= 70 ? '#2e7d32' : a >= 40 ? '#e65100' : '#c62828';
      DOM.cardNumFront.title = `Akurasi: ${a}% (${prog.correct}\u2713 ${prog.wrong}\u2717)`;
    } else {
      DOM.cardNumFront.style.color = '';
      DOM.cardNumFront.title = 'Belum dilatih';
    }

    // Update filter count
    if (DOM.filterAll) {
      DOM.filterAll.textContent = `Semua (${KANJI.length})`;
    }

    // Navigation state
    DOM.prevBtn.disabled = fcIndex === 0;
    DOM.nextBtn.disabled = fcIndex === fcOrder.length - 1;

    // Update grid highlights
    $$('.kanji-thumb').forEach((el, i) => {
      el.classList.toggle('current-thumb', i === fcIndex);
    });

    // Reset flip state
    isFlipped = false;
    DOM.cardInner.classList.remove('flipped');
  }

  /** Flip the flashcard */
  function flipCard() {
    isFlipped = !isFlipped;
    DOM.cardInner.classList.toggle('flipped', isFlipped);
  }

  function prevCard() { if (fcIndex > 0) { fcIndex--; updateCard(); } }
  function nextCard() { if (fcIndex < fcOrder.length - 1) { fcIndex++; updateCard(); } }
  function jumpCard(pos) { fcIndex = pos; updateCard(); }

  /** Shuffle cards using Fisher-Yates algorithm */
  function shuffleCards() {
    for (let i = fcOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fcOrder[i], fcOrder[j]] = [fcOrder[j], fcOrder[i]];
    }
    fcIndex = 0;
    buildGrid();
    updateCard();
  }

  /** Reset cards to original order */
  function resetCards() {
    fcOrder = [...Array(KANJI.length).keys()];
    fcIndex = 0;
    buildGrid();
    updateCard();
  }

  /** Toggle mini grid visibility */
  function toggleMiniGrid() {
    const visible = DOM.miniGridWrap.style.display !== 'none';
    DOM.miniGridWrap.style.display = visible ? 'none' : 'block';
    DOM.miniGridBtn.textContent = visible
      ? '\u25A6 Tampilkan Navigator Kanji'
      : '\u25A6 Sembunyikan Navigator';
  }


  // ── QUIZ SETUP ─────────────────────────────────────────────────────────────

  /** Build group selection buttons for quick kanji selection */
  function buildGroupButtons() {
    if (!DOM.groupBtns) return;
    const groups = [];
    for (let i = 0; i < KANJI.length; i += 20) {
      const end = Math.min(i + 20, KANJI.length);
      groups.push({ start: i, end: end, label: `${i + 1}\u2013${end}` });
    }

    DOM.groupBtns.innerHTML = groups.map((g, gi) =>
      `<button class="group-btn" id="grp-btn-${gi}" data-start="${g.start}" data-end="${g.end}">${g.label}</button>`
    ).join('') +
    `<button class="group-btn" id="grp-btn-recent" data-recent="40">40 Terakhir</button>`;

    // Attach events
    DOM.groupBtns.querySelectorAll('.group-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        resetGroupBtnStyles();
        this.classList.add('active');
        if (this.dataset.recent) {
          selectRecent(parseInt(this.dataset.recent));
        } else {
          selectGroup(parseInt(this.dataset.start), parseInt(this.dataset.end));
        }
      });
    });
  }

  function resetGroupBtnStyles() {
    DOM.groupBtns.querySelectorAll('.group-btn').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  function selectGroup(start, end) {
    selectedIdxs.clear();
    KANJI.forEach((k, i) => {
      const tile = $('kst-' + i);
      if (i >= start && i < end) {
        selectedIdxs.add(i);
        if (tile) tile.classList.add('selected');
      } else {
        if (tile) tile.classList.remove('selected');
      }
    });
    updateSelCount();
  }

  function selectRecent(n) {
    const start = Math.max(0, KANJI.length - n);
    selectGroup(start, KANJI.length);
  }

  /** Build the kanji selector grid for quiz setup */
  function buildKanjiSelector() {
    loadProgress();
    buildGroupButtons();

    // Default: select all kanji
    selectedIdxs.clear();
    KANJI.forEach((_, i) => selectedIdxs.add(i));

    if (!DOM.kanjiSelector) return;
    DOM.kanjiSelector.innerHTML = KANJI.map((k, i) => `
      <div class="ks-tile selected" id="kst-${i}" data-idx="${i}" title="${k.meaning}">
        <span class="ks-tile-char">${k.char}</span>
        <span class="ks-tile-num">${k.n}</span>
      </div>`).join('');

    // Attach click events
    DOM.kanjiSelector.querySelectorAll('.ks-tile').forEach(tile => {
      tile.addEventListener('click', function() {
        const i = parseInt(this.dataset.idx);
        toggleKanji(i);
      });
    });

    updateSelCount();
  }

  function toggleKanji(i) {
    const tile = $('kst-' + i);
    if (selectedIdxs.has(i)) {
      selectedIdxs.delete(i);
      if (tile) tile.classList.remove('selected');
    } else {
      selectedIdxs.add(i);
      if (tile) tile.classList.add('selected');
    }
    updateSelCount();
  }

  function selectAllKanji() {
    KANJI.forEach((_, i) => {
      selectedIdxs.add(i);
      const el = $('kst-' + i);
      if (el) el.classList.add('selected');
    });
    updateSelCount();
  }

  function clearAllKanji() {
    selectedIdxs.clear();
    KANJI.forEach((_, i) => {
      const el = $('kst-' + i);
      if (el) el.classList.remove('selected');
    });
    updateSelCount();
  }

  function updateSelCount() {
    if (DOM.selCountLabel) {
      DOM.selCountLabel.textContent = `${selectedIdxs.size} dipilih`;
    }
  }

  /** Select quiz mode */
  function selectMode(el) {
    $$('[data-mode]').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    qMode = el.dataset.mode;
  }

  /**
   * Determine mastery level of a kanji using hybrid SRS + accuracy logic.
   * Uses streak & interval (recent performance) as primary indicator,
   * with lifetime accuracy as secondary factor.
   * 
   * Levels:
   * - null    : Belum pernah dilatih
   * - 'lemah' : Baru mulai / sering salah / streak rendah
   * - 'sedang': Sudah pernah benar tapi belum konsisten
   * - 'kuasai': Streak tinggi dan interval panjang (benar konsisten)
   * 
   * @param {object} p - Progress entry {correct, wrong, streak, interval, ...}
   * @returns {string|null} 'kuasai' | 'sedang' | 'lemah' | null
   */
  function getMasteryLevel(p) {
    if (!p) return null;
    const total = p.correct + p.wrong;
    if (total === 0) return null;

    // Primary: SRS-based (reflects RECENT performance)
    // streak ≥ 3 AND interval ≥ 6 days = truly mastered (consistent correct answers)
    // streak ≥ 2 OR interval ≥ 3 = progressing well
    // streak 0 = just got it wrong recently

    if (p.streak >= 3 && p.interval >= 6) return 'kuasai';
    if (p.streak >= 2 || p.interval >= 3) return 'sedang';

    // Secondary: if streak is low, check lifetime accuracy as fallback
    const acc = Math.round(p.correct / total * 100);
    if (acc >= 80 && total >= 3) return 'sedang'; // high accuracy but lost streak
    
    return 'lemah';
  }

  /** Filter kanji selector by progress */
  function selectByProgress(type) {
    $$('.qfilter-btn').forEach(b => b.classList.remove('active-qfilter'));
    const btn = $('qf-' + type);
    if (btn) btn.classList.add('active-qfilter');

    KANJI.forEach((k, i) => {
      const tile = $('kst-' + i);
      if (!tile) return;
      const p = progressData[k.n];
      const level = getMasteryLevel(p);

      let include = false;
      if (type === 'all') include = true;
      else if (type === 'belum') include = (level === null);
      else if (type === 'lemah') include = (level === 'lemah');
      else if (type === 'sedang') include = (level === 'sedang');
      else if (type === 'kuasai') include = (level === 'kuasai');

      if (include) {
        selectedIdxs.add(i);
        tile.classList.add('selected');
      } else {
        selectedIdxs.delete(i);
        tile.classList.remove('selected');
      }
    });
    updateSelCount();
  }


  // ── QUIZ FLOW ──────────────────────────────────────────────────────────────

  /** Manage quiz view state: setup | active | result */
  function showQuizView(view) {
    quizView = view;
    if (DOM.quizSetup) DOM.quizSetup.style.display = (view === 'setup') ? '' : 'none';
    if (DOM.quizActive) {
      DOM.quizActive.classList.toggle('show', view === 'active');
      DOM.quizActive.style.display = (view === 'active') ? '' : 'none';
    }
    if (DOM.quizResult) {
      DOM.quizResult.classList.toggle('show', view === 'result');
      DOM.quizResult.style.display = (view === 'result') ? '' : 'none';
    }
  }

  /** Start the quiz */
  function startQuiz() {
    if (selectedIdxs.size === 0) {
      alert('Pilih minimal 1 kanji dulu!');
      return;
    }
    srsEnabled = DOM.srsToggle ? DOM.srsToggle.checked : true;

    const pool = [...selectedIdxs].map(i => KANJI[i]).sort(() => Math.random() - 0.5);
    quizQueue = pool;
    srsQueue = [];
    quizIdx = 0;
    quizScore = 0;
    quizTotalAsked = 0;
    quizWrongLog = [];
    answered = false;

    showQuizView('active');
    if (DOM.pillSrs) {
      DOM.pillSrs.style.display = srsEnabled ? 'inline-block' : 'none';
    }
    showQuestion();
  }

  /** Start SRS review session */
  function startSRSReview() {
    const due = getDueCards();
    if (due.length === 0) {
      alert('Tidak ada kanji yang perlu direview sekarang!');
      return;
    }

    // Select due kanji indices
    selectedIdxs.clear();
    due.forEach(k => {
      const idx = KANJI.findIndex(x => x.n === k.n);
      if (idx >= 0) selectedIdxs.add(idx);
    });

    startQuiz();
  }

  function currentQuestion() {
    if (quizIdx < quizQueue.length) return quizQueue[quizIdx];
    return srsQueue[quizIdx - quizQueue.length] || null;
  }

  function totalQuestions() {
    return quizQueue.length + srsQueue.length;
  }

  /** Build 4 choices from the FULL KANJI pool */
  function getChoicesFor(q) {
    const others = KANJI.filter(k => k.char !== q.char)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [...others, q].sort(() => Math.random() - 0.5);
  }

  /** Escape HTML special characters */
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Display the current quiz question */
  function showQuestion() {
    answered = false;
    DOM.nextQBtn.style.display = 'none';
    DOM.feedbackPanel.classList.remove('show');
    DOM.feedbackPanel.style.display = 'none';

    const q = currentQuestion();
    if (!q) { showResult(); return; }

    quizTotalAsked++;
    const total = totalQuestions();
    const isSRS = quizIdx >= quizQueue.length;

    DOM.quizQNum.textContent = `Soal ${quizIdx + 1} dari ${total}${isSRS ? ' \u00b7 \u{1F501}' : ''}`;
    DOM.quizProgress.style.width = (quizIdx / total * 100) + '%';
    updatePills();

    const choices = getChoicesFor(q);

    if (qMode === 'kanji-to-reading') {
      DOM.quizQuestion.innerHTML = `
        <div class="quiz-prompt">Apa <span class="color-on">On'yomi</span> dan <span class="color-kun">Kun'yomi</span> kanji ini?</div>
        <div class="quiz-kanji-big">${q.char}</div>
        <div class="quiz-meaning-hint">${q.meaning}</div>`;

      DOM.answerArea.innerHTML = '<div class="choices">' + choices.map(c =>
        `<button class="choice-btn" data-val="${escHtml(c.on + '|' + c.kun)}" data-correct="${escHtml(q.on + '|' + q.kun)}">
          <span class="choice-on">${c.on}</span>
          <span class="choice-on-romaji">${c.on_id}</span>
          <span class="choice-kun">${c.kun}</span>
          <span class="choice-kun-romaji">${c.id}</span>
        </button>`
      ).join('') + '</div>';

    } else {
      DOM.quizQuestion.innerHTML = `
        <div class="quiz-prompt">Kanji mana yang memiliki bacaan ini?</div>
        <div class="quiz-reading-display">
          <div class="quiz-on-big">${q.on}</div>
          <div class="quiz-on-romaji">${q.on_id}</div>
          <div class="quiz-kun-big">${q.kun}</div>
          <div class="quiz-kun-romaji">${q.id}</div>
        </div>`;

      DOM.answerArea.innerHTML = '<div class="choices">' + choices.map(c =>
        `<button class="choice-btn" data-val="${escHtml(c.char)}" data-correct="${escHtml(q.char)}">
          <span class="choice-kanji">${c.char}</span>
          <span class="choice-meaning">${c.meaning}</span>
        </button>`
      ).join('') + '</div>';
    }

    // Attach click events to choices
    DOM.answerArea.querySelectorAll('.choice-btn').forEach(btn => {
      btn.addEventListener('click', function() { checkMC(this); });
    });
  }


  /** Check multiple choice answer */
  function checkMC(btn) {
    if (answered) return;
    answered = true;

    const chosen = btn.dataset.val;
    const correct = btn.dataset.correct;
    const isRight = chosen === correct;

    DOM.answerArea.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.val === correct) b.classList.add('correct');
    });
    if (!isRight) btn.classList.add('wrong');

    const q = currentQuestion();
    recordAnswer(q, isRight, isRight ? null : chosen);
  }

  /** Update score pills display */
  function updatePills() {
    if (DOM.pillCorrect) DOM.pillCorrect.textContent = '\u2713 ' + quizScore;
    if (DOM.pillWrong) DOM.pillWrong.textContent = '\u2717 ' + quizWrongLog.length;
    if (DOM.pillSrs) {
      DOM.pillSrs.textContent = '\u{1F501} ' + srsQueue.length;
      DOM.pillSrs.style.display = (srsEnabled && srsQueue.length > 0) ? 'inline-block' : 'none';
    }
  }

  /** Record answer, update progress, show feedback */
  function recordAnswer(q, isCorrect, wrongAnswer) {
    recordProgress(q.n, isCorrect);
    if (isCorrect) {
      quizScore++;
    } else {
      quizWrongLog.push({ k: q, wrong: wrongAnswer });
      if (srsEnabled) srsQueue.push(q);
    }
    updatePills();
    showFeedback(q, isCorrect);
    DOM.nextQBtn.style.display = 'block';
  }

  /** Show feedback panel after answering */
  function showFeedback(q, isCorrect) {
    DOM.feedbackPanel.style.display = 'block';
    DOM.feedbackPanel.classList.add('show');

    if (isCorrect) {
      DOM.feedbackHeader.className = 'feedback-header correct-hdr';
      DOM.feedbackHeader.innerHTML = '\u2713 \u6B63\u89E3\uFF01 &nbsp;&nbsp; Benar!';
    } else {
      DOM.feedbackHeader.className = 'feedback-header wrong-hdr';
      DOM.feedbackHeader.innerHTML = '\u2717 \u4E0D\u6B63\u89E3 &nbsp;&nbsp; Salah';
    }

    DOM.fbKanji.textContent = q.char;
    DOM.fbInfo.innerHTML = `
      <div class="fb-meaning">${q.meaning} <span style="color:var(--muted);font-size:0.75rem;font-weight:400;">\u00b7 ${q.id}</span></div>
      <div style="margin-top:4px;">
        <span class="fb-label">\u97F3\u8AAD\u307F</span>
        <span class="fb-pill-on">${q.on}</span>
      </div>
      <div style="margin-top:4px;">
        <span class="fb-label">\u8A13\u8AAD\u307F</span>
        <span class="fb-pill-kun">${q.kun}</span>
      </div>
      ${(q.on_ex || q.kun_ex) ? '<div class="fb-ex">' +
        (q.on_ex ? '<div style="margin-bottom:4px;"><span class="fb-on">\u97F3\u306E\u4F8B</span>&nbsp;' + q.on_ex + '</div>' : '') +
        (q.kun_ex ? '<div><span class="fb-kun">\u8A13\u306E\u4F8B</span>&nbsp;' + q.kun_ex + '</div>' : '') +
        '</div>' : ''}`;
  }

  /** Move to next question */
  function nextQuestion() {
    DOM.feedbackPanel.style.display = 'none';
    DOM.feedbackPanel.classList.remove('show');
    DOM.nextQBtn.style.display = 'none';
    quizIdx++;
    if (quizIdx >= totalQuestions()) showResult();
    else showQuestion();
  }

  /** Show quiz results */
  function showResult() {
    showQuizView('result');
    const pct = Math.round((quizScore / quizTotalAsked) * 100) || 0;

    setTimeout(() => {
      DOM.ringFill.style.strokeDashoffset = 377 - (377 * pct / 100);
      DOM.ringPct.textContent = pct + '%';
    }, 100);

    const grade =
      pct === 100 ? '\u25C6 Sempurna! \u6E80\u70B9\uFF01' :
      pct >= 80 ? '\u25C6 Sangat Bagus!' :
      pct >= 60 ? '\u25C7 Lumayan Bagus!' : '\u25C7 Terus Semangat!';

    DOM.resultGrade.textContent = grade;
    DOM.rsCorrect.textContent = quizScore;
    DOM.rsWrong.textContent = quizWrongLog.length;
    DOM.rsTotal.textContent = quizTotalAsked;

    // Show wrong answers
    const uniqueWrong = [...new Map(quizWrongLog.map(x => [x.k.char, x])).values()];
    if (uniqueWrong.length > 0) {
      DOM.wrongList.innerHTML = `<h3>Perlu Dipelajari Lagi (${uniqueWrong.length})</h3>` +
        uniqueWrong.map(({ k, wrong }) => `
          <div class="wrong-item">
            <div class="w-kanji">${k.char}</div>
            <div class="w-info">
              <div class="w-meaning">${k.meaning} \u00b7 ${k.id}</div>
              <div class="w-reading"><span class="color-on">\u97F3:</span> ${k.on} &nbsp;<span class="color-kun">\u8A13:</span> ${k.kun}</div>
              ${wrong ? `<div class="w-wrong-ans">Jawabanmu: "${wrong}"</div>` : ''}
            </div>
          </div>`).join('');
    } else {
      DOM.wrongList.innerHTML = '<p class="text-center" style="color:var(--green);font-size:1.1rem;padding:16px 0;">\u25C6 Tidak ada kesalahan!</p>';
    }
  }

  /** End quiz and return to setup */
  function endQuiz() {
    showQuizView('setup');
  }

  /** Update SRS review banner */
  function updateSRSBanner() {
    loadProgress();
    const due = getDueCards();
    if (!DOM.srsBanner || !DOM.srsDueCount) return;
    if (due.length > 0) {
      DOM.srsBanner.style.display = 'block';
      DOM.srsDueCount.textContent = due.length + ' kanji jatuh tempo untuk direview';
    } else {
      DOM.srsBanner.style.display = 'none';
    }
  }


  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  /** Render a single kanji card for the list view */
  function renderKanjiCard(k) {
    const p = progressData[k.n] || { correct: 0, wrong: 0 };
    const total = p.correct + p.wrong;
    const level = getMasteryLevel(progressData[k.n]);
    
    const levelColors = { kuasai: '#4caf50', sedang: '#c8960a', lemah: '#d94f3d' };
    const levelLabels = { kuasai: 'Dikuasai', sedang: 'Sedang', lemah: 'Lemah' };
    const dotColor = level ? levelColors[level] : '';
    const dot = level ? `<span class="progress-dot" style="background:${dotColor};"></span>` : '';
    
    let progText;
    if (total > 0) {
      const acc = Math.round(p.correct / total * 100);
      const color = level ? levelColors[level] : 'var(--muted)';
      progText = `<div class="list-progress" style="color:${color};">${levelLabels[level] || ''} ${acc}% (${p.correct}\u2713 ${p.wrong}\u2717)</div>`;
    } else {
      progText = '<div class="list-progress" style="color:var(--muted);">Belum dilatih</div>';
    }

    return `<div class="list-card" data-n="${k.n}">
      ${dot}
      <div class="list-num">No. ${k.n}</div>
      <span class="list-kanji">${k.char}</span>
      <div class="list-meaning">${k.meaning}</div>
      <div class="list-reading">
        <span class="list-on">\u97F3 ${k.on}</span><br>
        <span class="list-kun">\u8A13 ${k.kun}</span>
      </div>
      ${progText}
    </div>`;
  }

  /** Attach click events to list cards (navigate to flashcard) */
  function attachListCardClicks() {
    $$('.list-card[data-n]').forEach(el => {
      el.addEventListener('click', function() {
        const n = parseInt(this.getAttribute('data-n'));
        switchTab('flashcard');
        setTimeout(() => {
          fcIndex = KANJI.findIndex(x => x.n === n);
          fcOrder = [...Array(KANJI.length).keys()];
          updateCard();
        }, 50);
      });
    });
  }

  /** Build the list view */
  function buildList() {
    DOM.listGrid.innerHTML = KANJI.map(k => renderKanjiCard(k)).join('');
    attachListCardClicks();
  }

  /** Filter list by progress category */
  function filterList(type) {
    $$('.filter-btn').forEach(b => b.classList.remove('active-filter'));
    const btn = $('filter-' + type);
    if (btn) btn.classList.add('active-filter');

    let filtered;
    if (type === 'all') filtered = KANJI;
    else if (type === 'belum') filtered = KANJI.filter(k => getMasteryLevel(progressData[k.n]) === null);
    else if (type === 'lemah') filtered = KANJI.filter(k => getMasteryLevel(progressData[k.n]) === 'lemah');
    else if (type === 'kuasai') filtered = KANJI.filter(k => getMasteryLevel(progressData[k.n]) === 'kuasai');

    DOM.listGrid.innerHTML = filtered.map(k => renderKanjiCard(k)).join('');
    attachListCardClicks();

    if (DOM.filterAll && type === 'all') {
      DOM.filterAll.textContent = `Semua (${KANJI.length})`;
    }
  }


  // ── PROGRESS VIEW ──────────────────────────────────────────────────────────

  /** Render progress statistics */
  function renderProgress() {
    if (!DOM.progSummary || !DOM.progTable) return;

    if (DOM.storageStatus) {
      DOM.storageStatus.textContent = '\u25C8 Data tersimpan di browser';
      DOM.storageStatus.style.background = 'var(--green-bg)';
      DOM.storageStatus.style.color = 'var(--green)';
    }

    let practiced = 0, mastered = 0, totalCorrect = 0, totalWrong = 0;
    const dueNow = getDueCards().length;

    KANJI.forEach(k => {
      const p = progressData[k.n];
      if (p && (p.correct + p.wrong) > 0) {
        practiced++;
        totalCorrect += p.correct;
        totalWrong += p.wrong;
        if (getMasteryLevel(p) === 'kuasai') mastered++;
      }
    });

    const accuracy = totalCorrect + totalWrong > 0
      ? Math.round(totalCorrect / (totalCorrect + totalWrong) * 100) : 0;

    // Summary cards
    DOM.progSummary.innerHTML = `
      <div class="prog-card">
        <div class="prog-card-num">${practiced}</div>
        <div class="prog-card-label">Kanji Dilatih</div>
      </div>
      <div class="prog-card">
        <div class="prog-card-num" style="color:#4caf50;">${mastered}</div>
        <div class="prog-card-label">Dikuasai</div>
      </div>
      <div class="prog-card">
        <div class="prog-card-num" style="color:${dueNow > 0 ? '#c8960a' : '#4caf50'};">${dueNow}</div>
        <div class="prog-card-label">Perlu Review</div>
      </div>
      <div class="prog-card">
        <div class="prog-card-num" style="color:${accuracy >= 70 ? '#4caf50' : accuracy >= 40 ? '#c8960a' : '#d94f3d'};">${accuracy}%</div>
        <div class="prog-card-label">Akurasi</div>
      </div>`;

    // Per-kanji table
    DOM.progTable.innerHTML = KANJI.map(k => {
      const p = progressData[k.n] || { correct: 0, wrong: 0 };
      const total = p.correct + p.wrong;
      const acc = total > 0 ? Math.round(p.correct / total * 100) : null;
      const barHtml = total > 0
        ? `<div class="prog-bar"><div class="prog-bar-fill" style="width:${acc}%;background:${acc >= 70 ? '#4caf50' : acc >= 40 ? '#ff9800' : '#f44336'};"></div></div>`
        : '<div style="font-size:0.68rem;color:var(--muted);">Belum dilatih</div>';

      return `<div class="prog-row">
        <div>
          <div class="prog-row-kanji">${k.char}</div>
          <div class="prog-row-num">No.${k.n}</div>
        </div>
        <div>
          <div class="prog-row-meaning">${k.meaning}</div>
          <div class="prog-row-reading">${k.on} \u00b7 ${k.kun}</div>
          ${barHtml}
        </div>
        <div class="prog-row-stats">
          ${total > 0 ? `
            <div class="prog-correct">\u2713 ${p.correct}</div>
            <div class="prog-wrong">\u2717 ${p.wrong}</div>
            <div class="prog-acc">${acc}%</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }


  // ── TAB NAVIGATION ─────────────────────────────────────────────────────────

  /**
   * Switch between tabs (FIXED: no longer uses event.target)
   * @param {string} tab - Tab name: flashcard, quiz, list, progress
   */
  function switchTab(tab) {
    $$('.section').forEach(s => s.classList.remove('active'));
    $$('.tab-btn').forEach(b => b.classList.remove('active'));

    const section = $(tab);
    if (section) section.classList.add('active');

    // Find and activate corresponding tab button
    $$('.tab-btn').forEach(b => {
      if (b.dataset.tab === tab) b.classList.add('active');
    });

    // Tab-specific initialization
    if (tab === 'progress') { loadProgress(); renderProgress(); }
    if (tab === 'list') { loadProgress(); buildList(); filterList('all'); }
    if (tab === 'quiz') { showQuizView(quizView); updateSRSBanner(); }
  }

  // ── KEYBOARD NAVIGATION ────────────────────────────────────────────────────

  function handleKeydown(e) {
    const fc = $('flashcard');
    if (!fc || !fc.classList.contains('active')) return;
    if (e.key === 'ArrowLeft') prevCard();
    if (e.key === 'ArrowRight') nextCard();
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flipCard();
    }
  }

  // ── EVENT BINDING ──────────────────────────────────────────────────────────

  /** Bind all events using addEventListener (no inline onclick) */
  function bindEvents() {
    // Tab buttons
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        switchTab(this.dataset.tab);
      });
    });

    // Flashcard controls
    $('card-scene')?.addEventListener('click', flipCard);
    DOM.prevBtn?.addEventListener('click', prevCard);
    DOM.nextBtn?.addEventListener('click', nextCard);
    $('btn-shuffle')?.addEventListener('click', shuffleCards);
    $('btn-reset')?.addEventListener('click', resetCards);
    $('btn-flip')?.addEventListener('click', flipCard);
    DOM.miniGridBtn?.addEventListener('click', toggleMiniGrid);

    // Quiz setup
    $$('[data-mode]').forEach(el => {
      el.addEventListener('click', function() { selectMode(this); });
    });
    $('btn-select-all')?.addEventListener('click', selectAllKanji);
    $('btn-clear-all')?.addEventListener('click', clearAllKanji);
    $('btn-start-quiz')?.addEventListener('click', startQuiz);
    $('btn-start-srs')?.addEventListener('click', startSRSReview);

    // Quiz filter buttons
    $$('.qfilter-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        selectByProgress(this.dataset.filter);
      });
    });

    // Quiz active
    $('btn-end-quiz')?.addEventListener('click', endQuiz);
    $('btn-next-q')?.addEventListener('click', nextQuestion);

    // Quiz result
    $('btn-retry')?.addEventListener('click', startQuiz);
    $('btn-back-setup')?.addEventListener('click', endQuiz);

    // List filter
    $$('.filter-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        filterList(this.dataset.filter);
      });
    });

    // Progress
    $('btn-reset-progress')?.addEventListener('click', clearProgress);

    // Keyboard
    document.addEventListener('keydown', handleKeydown);
  }


  // ── INITIALIZATION ─────────────────────────────────────────────────────────

  /** Initialize the application */
  function init() {
    try {
      cacheDom();
      loadProgress();
      fcOrder = [...Array(KANJI.length).keys()];
      bindEvents();
      buildGrid();
      updateCard();
      buildList();
      buildKanjiSelector();
      showQuizView('setup');
      updateSRSBanner();
      console.log(`Kanji App initialized: ${KANJI.length} kanji loaded`);
    } catch (e) {
      console.error('Init error:', e);
    }
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  // Expose methods that may be needed externally (for debugging)
  return {
    init,
    switchTab,
    flipCard,
    prevCard,
    nextCard,
    shuffleCards,
    resetCards,
    startQuiz,
    endQuiz,
    nextQuestion,
    selectMode,
    selectAllKanji,
    clearAllKanji,
    selectByProgress,
    filterList,
    clearProgress,
    startSRSReview,
    toggleMiniGrid
  };

})();

// ── GLOBAL ERROR HANDLER ───────────────────────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  console.error('Global error:', msg, 'at line', line, col, err);
  return false;
};

// ── START APP WHEN DOM IS READY ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
