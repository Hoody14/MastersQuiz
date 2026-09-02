/* ქვიზის ძრავა — სამაგისტრო ტესტი (ინფორმატიკა და კომპიუტერული სისტემები) */

(function () {
  'use strict';

  const SECTIONS = window.QUIZ_SECTIONS || [];
  const LS_BEST = 'quiz.best';
  const LS_STATE = 'quiz.state';
  const LS_PREFS = 'quiz.prefs';
  const KEYS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ'];

  const $ = (id) => document.getElementById(id);

  /* ---------------- state ---------------- */
  let selected = new Set(SECTIONS.map((s) => s.id));
  let mode = 'study';
  let quiz = null; // { items, idx, answers, revealed }

  /* ---------------- helpers ---------------- */
  function esc(str) {
    return String(str).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  // `code` -> <code>, ```block``` -> <pre>
  function fmt(str) {
    let out = esc(str);
    out = out.replace(/```([\s\S]*?)```/g, (_, code) => '<pre>' + code.replace(/^\n/, '') + '</pre>');
    out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return out;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function show(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(screenId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------------- prefs ---------------- */
  function savePrefs() {
    try {
      localStorage.setItem(
        LS_PREFS,
        JSON.stringify({
          selected: [...selected],
          mode,
          shuffleQ: $('opt-shuffle-q').checked,
          shuffleA: $('opt-shuffle-a').checked,
          limit: $('opt-limit').value,
        })
      );
    } catch (e) {}
  }

  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(LS_PREFS) || 'null');
      if (!p) return;
      if (Array.isArray(p.selected) && p.selected.length) selected = new Set(p.selected);
      if (p.mode) mode = p.mode;
      $('opt-shuffle-q').checked = !!p.shuffleQ;
      $('opt-shuffle-a').checked = !!p.shuffleA;
      if (p.limit) $('opt-limit').value = p.limit;
    } catch (e) {}
  }

  /* ---------------- home ---------------- */
  function renderSections() {
    const box = $('section-list');
    box.innerHTML = '';
    SECTIONS.forEach((sec) => {
      const el = document.createElement('div');
      el.className = 'sec-item' + (selected.has(sec.id) ? ' on' : '');
      el.innerHTML =
        '<div class="sec-check"></div>' +
        '<div class="sec-name">' + esc(sec.title) + '</div>' +
        '<div class="sec-count">' + sec.questions.length + '</div>';
      el.addEventListener('click', () => {
        if (selected.has(sec.id)) selected.delete(sec.id);
        else selected.add(sec.id);
        el.classList.toggle('on');
        updateCounts();
        savePrefs();
      });
      box.appendChild(el);
    });
  }

  function pickedQuestions() {
    const out = [];
    SECTIONS.forEach((sec) => {
      if (!selected.has(sec.id)) return;
      sec.questions.forEach((q, i) => out.push({ q, sec, num: i + 1 }));
    });
    return out;
  }

  function updateCounts() {
    const total = SECTIONS.reduce((n, s) => n + s.questions.length, 0);
    $('stat-total').textContent = total;
    $('stat-sections').textContent = SECTIONS.length;

    const n = pickedQuestions().length;
    const limit = parseInt($('opt-limit').value, 10) || 0;
    const used = limit ? Math.min(limit, n) : n;
    $('selected-count').textContent = used;
    $('btn-start').disabled = used === 0;
    $('limit-hint').textContent = limit
      ? 'შემთხვევით შეირჩევა ' + used + ' კითხვა'
      : 'ყველა შერჩეული კითხვა';

    const best = localStorage.getItem(LS_BEST);
    $('stat-best').textContent = best ? best + '%' : '—';
  }

  /* ---------------- quiz ---------------- */
  function buildQuiz() {
    let items = pickedQuestions();
    if ($('opt-shuffle-q').checked) items = shuffle(items);
    const limit = parseInt($('opt-limit').value, 10) || 0;
    if (limit) items = items.slice(0, limit);

    items = items.map((it) => {
      let order = it.q.options.map((_, i) => i);
      if ($('opt-shuffle-a').checked) order = shuffle(order);
      return Object.assign({}, it, { order });
    });

    quiz = { items, idx: 0, answers: new Array(items.length).fill(null), revealed: new Array(items.length).fill(false) };
  }

  function saveState() {
    if (!quiz) return;
    try {
      localStorage.setItem(
        LS_STATE,
        JSON.stringify({
          mode,
          idx: quiz.idx,
          answers: quiz.answers,
          revealed: quiz.revealed,
          items: quiz.items.map((it) => ({ sec: it.sec.id, num: it.num, order: it.order })),
        })
      );
    } catch (e) {}
  }

  function restoreState() {
    try {
      const st = JSON.parse(localStorage.getItem(LS_STATE) || 'null');
      if (!st || !st.items || !st.items.length) return false;
      const items = [];
      for (const ref of st.items) {
        const sec = SECTIONS.find((s) => s.id === ref.sec);
        if (!sec) return false;
        const q = sec.questions[ref.num - 1];
        if (!q) return false;
        items.push({ q, sec, num: ref.num, order: ref.order });
      }
      mode = st.mode || 'study';
      quiz = { items, idx: st.idx || 0, answers: st.answers, revealed: st.revealed };
      return true;
    } catch (e) {
      return false;
    }
  }

  function current() {
    return quiz.items[quiz.idx];
  }

  function renderQuestion() {
    const it = current();
    const q = it.q;
    const i = quiz.idx;

    $('q-counter').textContent = i + 1 + ' / ' + quiz.items.length;
    $('q-section').textContent = it.sec.short;
    $('progress-bar').style.width = ((i + 1) / quiz.items.length) * 100 + '%';
    $('q-origin').textContent = it.sec.title + ' · კითხვა #' + it.num;
    $('q-text').innerHTML = fmt(q.q);

    const answered = quiz.answers[i] !== null || quiz.revealed[i];
    const box = $('options');
    box.innerHTML = '';

    it.order.forEach((origIdx, pos) => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.type = 'button';
      btn.innerHTML =
        '<span class="opt-key">' + (KEYS[pos] || pos + 1) + '</span>' +
        '<span class="opt-body">' + fmt(q.options[origIdx]) + '</span>';

      if (answered) {
        btn.classList.add('locked');
        const isCorrect = origIdx === q.correct;
        const isChosen = quiz.answers[i] === origIdx;
        if (isCorrect) btn.classList.add('correct');
        else if (isChosen) btn.classList.add('wrong');
        else btn.classList.add('dimmed');

        if (q.explanations && q.explanations[origIdx]) {
          const ex = document.createElement('div');
          ex.className = 'explain ' + (isCorrect ? 'good' : 'bad');
          ex.innerHTML =
            '<b>' + (isCorrect ? '✓ სწორი პასუხი. ' : '✕ არასწორია. ') + '</b>' +
            fmt(q.explanations[origIdx]);
          btn.querySelector('.opt-body').appendChild(ex);
        }
      } else {
        btn.addEventListener('click', () => answer(origIdx));
      }
      box.appendChild(btn);
    });

    if (answered && !q.explanations && q.ex) {
      const ex = document.createElement('div');
      ex.className = 'explain good';
      ex.innerHTML = '<b>✓ სწორი პასუხი — ' + (KEYS[it.order.indexOf(q.correct)] || '') + '. </b>' + fmt(q.ex);
      box.appendChild(ex);
    }

    const note = $('q-note');
    if (answered && q.note) {
      note.hidden = false;
      note.innerHTML = fmt(q.note);
    } else {
      note.hidden = true;
    }

    $('btn-prev').disabled = i === 0;
    $('btn-reveal').hidden = answered || mode === 'exam';
    $('btn-next').textContent = i === quiz.items.length - 1 ? 'დასრულება ✓' : 'შემდეგი →';
    updateScore();
  }

  function answer(origIdx) {
    const i = quiz.idx;
    if (quiz.answers[i] !== null) return;
    quiz.answers[i] = origIdx;
    if (mode === 'study') {
      renderQuestion();
    } else {
      // გამოცდის რეჟიმი: მხოლოდ მონიშვნა, შემდეგზე ავტომატური გადასვლა
      document.querySelectorAll('#options .option').forEach((el, pos) => {
        el.classList.toggle('chosen', current().order[pos] === origIdx);
      });
      setTimeout(() => {
        if (quiz.idx < quiz.items.length - 1) { quiz.idx++; renderQuestion(); }
        else finish();
        saveState();
      }, 180);
    }
    updateScore();
    saveState();
  }

  function updateScore() {
    let ok = 0, bad = 0;
    quiz.items.forEach((it, i) => {
      const a = quiz.answers[i];
      if (a === null) return;
      if (a === it.q.correct) ok++;
      else bad++;
    });
    if (mode === 'exam') {
      $('score-ok').textContent = ok + bad;
      $('score-bad').textContent = quiz.items.length;
    } else {
      $('score-ok').textContent = ok;
      $('score-bad').textContent = bad;
    }
  }

  function finish() {
    let ok = 0, bad = 0, skip = 0;
    const bySec = {};
    quiz.items.forEach((it, i) => {
      const id = it.sec.id;
      if (!bySec[id]) bySec[id] = { title: it.sec.title, ok: 0, total: 0 };
      bySec[id].total++;
      const a = quiz.answers[i];
      if (a === null) skip++;
      else if (a === it.q.correct) { ok++; bySec[id].ok++; }
      else bad++;
    });

    const total = quiz.items.length;
    const pct = total ? Math.round((ok / total) * 100) : 0;

    $('res-ok').textContent = ok;
    $('res-bad').textContent = bad;
    $('res-skip').textContent = skip;
    $('result-pct').textContent = pct + '%';
    $('result-frac').textContent = ok + ' / ' + total;

    const color = pct >= 80 ? 'var(--ok)' : pct >= 55 ? 'var(--warn)' : 'var(--bad)';
    $('result-ring').style.background =
      'conic-gradient(' + color + ' ' + pct * 3.6 + 'deg, var(--bg-2) 0deg)';
    $('result-pct').style.color = color;

    let title, msg;
    if (pct >= 90) { title = 'შესანიშნავია!'; msg = 'მასალას თითქმის სრულყოფილად ფლობ.'; }
    else if (pct >= 75) { title = 'კარგი შედეგია'; msg = 'ცოტაღა დარჩა — გაარჩიე შეცდომები.'; }
    else if (pct >= 50) { title = 'საშუალო შედეგი'; msg = 'გაიმეორე სუსტი სექციები და სცადე ხელახლა.'; }
    else { title = 'გასამეორებელია'; msg = 'გაიარე დათვალიერების რეჟიმი და ისევ სცადე.'; }
    $('result-title').textContent = title;
    $('result-msg').textContent = msg;

    const box = $('result-by-section');
    box.innerHTML = '';
    Object.values(bySec).forEach((s) => {
      const p = Math.round((s.ok / s.total) * 100);
      const row = document.createElement('div');
      row.className = 'bs-row';
      row.innerHTML =
        '<div class="bs-head"><b>' + esc(s.title) + '</b><span>' + s.ok + '/' + s.total + ' · ' + p + '%</span></div>' +
        '<div class="bs-bar"><div class="bs-fill" style="width:' + p + '%;background:' +
        (p >= 80 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--bad)') + '"></div></div>';
      box.appendChild(row);
    });

    const best = parseInt(localStorage.getItem(LS_BEST) || '0', 10);
    if (pct > best) { try { localStorage.setItem(LS_BEST, String(pct)); } catch (e) {} }
    try { localStorage.removeItem(LS_STATE); } catch (e) {}

    show('screen-result');
  }

  /* ---------------- browse ---------------- */
  function renderBrowse() {
    const secSel = $('browse-section');
    if (!secSel.options.length) {
      secSel.innerHTML = '<option value="all">ყველა სექცია</option>' +
        SECTIONS.map((s) => '<option value="' + s.id + '">' + esc(s.short) + '</option>').join('');
    }
    const term = $('browse-search').value.trim().toLowerCase();
    const secId = secSel.value;
    const list = $('browse-list');
    list.innerHTML = '';

    let shown = 0;
    SECTIONS.forEach((sec) => {
      if (secId !== 'all' && sec.id !== secId) return;
      sec.questions.forEach((q, i) => {
        if (term) {
          const hay = (q.q + ' ' + q.options.join(' ')).toLowerCase();
          if (!hay.includes(term)) return;
        }
        shown++;
        const el = document.createElement('div');
        el.className = 'browse-item';
        let html =
          '<div class="q-origin">' + esc(sec.title) + ' · #' + (i + 1) + '</div>' +
          '<div class="q-text">' + fmt(q.q) + '</div><div class="options">';
        q.options.forEach((opt, oi) => {
          const isC = oi === q.correct;
          const perOpt = q.explanations && q.explanations[oi]
            ? '<div class="explain ' + (isC ? 'good' : 'bad') + '"><b>' +
              (isC ? '✓ სწორი პასუხი. ' : '✕ არასწორია. ') + '</b>' + fmt(q.explanations[oi]) + '</div>'
            : '';
          html +=
            '<div class="option locked ' + (isC ? 'correct' : 'dimmed') + '">' +
            '<span class="opt-key">' + (KEYS[oi] || oi + 1) + '</span>' +
            '<span class="opt-body">' + fmt(opt) + perOpt + '</span></div>';
        });
        html += '</div>';
        if (!q.explanations && q.ex) {
          html += '<div class="explain good"><b>✓ სწორი პასუხი — ' +
            (KEYS[q.correct] || '') + '. </b>' + fmt(q.ex) + '</div>';
        }
        if (q.note) html += '<div class="q-note">' + fmt(q.note) + '</div>';
        el.innerHTML = html;
        list.appendChild(el);
      });
    });

    const c = document.createElement('div');
    c.className = 'bi-count';
    c.textContent = 'ნაპოვნია ' + shown + ' კითხვა';
    list.insertBefore(c, list.firstChild);
  }

  /* ---------------- review ---------------- */
  function startReview(onlyWrong) {
    const items = [], answers = [], revealed = [];
    quiz.items.forEach((it, i) => {
      const a = quiz.answers[i];
      if (onlyWrong && a === it.q.correct) return;
      items.push(it);
      answers.push(a);
      revealed.push(true);
    });
    if (!items.length) {
      alert('შეცდომები არ გაქვს — ყველა პასუხი სწორია!');
      return;
    }
    quiz = { items, idx: 0, answers, revealed, review: true };
    mode = 'study';
    show('screen-quiz');
    renderQuestion();
  }

  /* ---------------- events ---------------- */
  function bind() {
    $('btn-select-all').addEventListener('click', () => {
      selected = new Set(SECTIONS.map((s) => s.id));
      renderSections(); updateCounts(); savePrefs();
    });
    $('btn-select-none').addEventListener('click', () => {
      selected = new Set();
      renderSections(); updateCounts(); savePrefs();
    });

    document.querySelectorAll('#mode-switch .seg').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#mode-switch .seg').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        mode = b.dataset.mode;
        savePrefs();
      });
    });

    ['opt-shuffle-q', 'opt-shuffle-a', 'opt-limit'].forEach((id) =>
      $(id).addEventListener('change', () => { updateCounts(); savePrefs(); })
    );

    $('btn-start').addEventListener('click', () => {
      buildQuiz(); saveState(); show('screen-quiz'); renderQuestion();
    });

    $('btn-resume').addEventListener('click', () => {
      if (restoreState()) { show('screen-quiz'); renderQuestion(); }
    });

    $('btn-exit').addEventListener('click', () => {
      if (quiz && !quiz.review && quiz.answers.some((a) => a !== null)) {
        if (!confirm('ქვიზიდან გასვლა? მიმდინარე პროგრესი შენახული იქნება.')) return;
      }
      show('screen-home'); updateCounts();
    });

    $('btn-prev').addEventListener('click', () => {
      if (quiz.idx > 0) { quiz.idx--; renderQuestion(); saveState(); }
    });

    $('btn-next').addEventListener('click', () => {
      if (quiz.idx < quiz.items.length - 1) { quiz.idx++; renderQuestion(); saveState(); }
      else if (quiz.review) { show('screen-result'); }
      else finish();
    });

    $('btn-reveal').addEventListener('click', () => {
      quiz.revealed[quiz.idx] = true;
      renderQuestion(); saveState();
    });

    $('btn-review-wrong').addEventListener('click', () => startReview(true));
    $('btn-review-all').addEventListener('click', () => startReview(false));
    $('btn-retry').addEventListener('click', () => {
      buildQuiz(); saveState(); show('screen-quiz'); renderQuestion();
    });
    $('btn-home').addEventListener('click', () => { show('screen-home'); updateCounts(); });

    $('btn-browse').addEventListener('click', () => { show('screen-browse'); renderBrowse(); });
    $('btn-browse-exit').addEventListener('click', () => show('screen-home'));
    $('browse-search').addEventListener('input', debounce(renderBrowse, 200));
    $('browse-section').addEventListener('change', renderBrowse);

    document.addEventListener('keydown', (e) => {
      if (!$('screen-quiz').classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); $('btn-next').click(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!$('btn-prev').disabled) $('btn-prev').click(); }
      else if (/^[1-6]$/.test(e.key)) {
        const opts = document.querySelectorAll('#options .option:not(.locked)');
        const el = opts[parseInt(e.key, 10) - 1];
        if (el) el.click();
      }
    });
  }

  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ---------------- init ---------------- */
  function init() {
    if (!SECTIONS.length) {
      document.body.innerHTML = '<p style="padding:40px;text-align:center">კითხვების ფაილები ვერ ჩაიტვირთა.</p>';
      return;
    }
    loadPrefs();
    document.querySelectorAll('#mode-switch .seg').forEach((b) =>
      b.classList.toggle('active', b.dataset.mode === mode)
    );
    renderSections();
    updateCounts();
    bind();
    try {
      if (localStorage.getItem(LS_STATE)) $('btn-resume').hidden = false;
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', init);
})();
