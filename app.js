// Python Lab app: renders whichever topic is selected from data/lessons.js.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  const STAGES = [['dashboard', 'Dashboard'], ['learn', '1 Learn'], ['explore', '2 Explore'], ['practice', '3 Practice'], ['build', '4 Build'], ['code', '5 Code'], ['finish', '6 Finish']];
  let topic = TOPICS[0], stage = 'dashboard', demoTimer = null;
  const drafts = {}, live = {};   // drafts keep code when you switch stages

  // ---------- progress helpers ----------
  const challenges = (t) => [...t.exercises, t.project];
  const done = (c) => Progress.isDone(topic.id, c.id);
  const quizDone = () => Progress.quiz(topic.id) >= topic.quizPass;
  const xpOf = (t) => challenges(t).filter((c) => Progress.isDone(t.id, c.id)).reduce((a, c) => a + c.xp, 0) + 10 * Progress.quiz(t.id);
  const totalXp = () => TOPICS.reduce((a, t) => a + xpOf(t), 0);
  const allDone = () => challenges(topic).every(done) && quizDone();

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.id); toast.id = setTimeout(() => { t.hidden = true; }, 4000);
  }
  function checkBadges() {
    TOPICS.forEach((t) => t.badges.forEach((b) => {
      if (!Progress.hasBadge(b.id) && b.needs.every((id) => Progress.isDone(t.id, id)) && Progress.quiz(t.id) >= (b.quizMin || 0)) {
        Progress.addBadge(b.id); toast('Badge unlocked: ' + b.name);
      }
    }));
  }
  function header() {
    const x = totalXp();
    $('#level').textContent = 'Level ' + (Math.floor(x / 100) + 1);
    $('#xpfill').style.width = (x % 100) + '%';
    $('#xptext').textContent = x + ' XP';
  }

  // ---------- editor + terminal ----------
  function makeEditor(host, id, value) {
    let ed;
    if (window.CodeMirror) {
      const cm = CodeMirror(host, { value, mode: 'python', theme: 'material-darker', lineNumbers: true, indentUnit: 4, extraKeys: { Tab: (c) => c.replaceSelection('    ') } });
      ed = { get: () => cm.getValue(), set: (v) => cm.setValue(v) };
    } else {
      const ta = document.createElement('textarea');
      ta.value = value; ta.spellcheck = false; ta.className = 'plain'; host.appendChild(ta);
      ed = { get: () => ta.value, set: (v) => { ta.value = v; } };
    }
    live[id] = ed; return ed;
  }
  const lines = (txt) => (txt.trim() === '' ? [] : txt.replace(/\n+$/, '').split('\n'));

  async function runInto(term, code, inputText) {
    term.textContent = '';
    try {
      const r = await PythonRunner.run(code, { inputs: lines(inputText), onOut: (t) => { term.textContent += t; } });
      if (r.timedOut) term.insertAdjacentHTML('beforeend', '<span class="err">\nStopped after 5 seconds. Does your loop ever end?</span>');
      else if (r.error) term.insertAdjacentHTML('beforeend', '<span class="err">\nError, ' + esc(r.error) + '</span>');
    } catch (e) { term.textContent = 'Python is not available yet. Check your connection and reload the page.'; }
  }

  // ---------- automatic tests (run the real program) ----------
  const norm = (s) => s.replace(/[ \t]+$/gm, '').trim();
  async function runTests(code, tests) {
    const out = [];
    for (const t of tests) {
      const r = await PythonRunner.run(code, { inputs: t.inputs, echo: false, timeoutMs: 3000 });
      let pass = false, why = '';
      if (r.timedOut) why = 'Your program ran too long. Does every loop eventually stop?';
      else if (r.error) why = /input\(\) needs a value/.test(r.error) ? 'Your program asked for more input than this test gives it. Does your loop stop at the right moment?' : 'Python error: ' + r.error;
      else if (norm(r.output) === norm(t.expected)) pass = true;
      else why = t.hint;
      out.push({ t, pass, why, got: r.output });
    }
    return out;
  }
  function showResults(results) {
    const n = results.filter((r) => r.pass).length;
    return `<p><b>${n} of ${results.length} tests passed</b></p><ul class="tests">` + results.map((r) => `<li class="${r.pass ? 'pass' : 'fail'}"><b>${r.pass ? '✔' : '✘'} ${esc(r.t.name)}</b>` +
      (r.pass ? '' : `<div>${esc(r.why)}</div>` + (r.t.hidden ? '' : `<pre class="mini">Input: ${esc(r.t.inputs.join(', '))}\nExpected:\n${esc(r.t.expected)}\nYours:\n${esc(r.got)}</pre>`)) + '</li>').join('') + '</ul>';
  }

  // ---------- challenge card (used by Practice and Build) ----------
  function challengeCard(c) {
    const card = h(`<section class="card"><h3>${esc(c.title)} <small>${c.level}, ${c.xp} XP ${done(c) ? '<span class="ok">completed</span>' : ''}</small></h3><p>${c.prompt}</p><div class="ed"></div>
      <label class="lab">Input <small>(one line per input() call)</small><textarea class="inp" rows="2">${esc(c.inputs || '')}</textarea></label>
      <div class="btns"><button class="run">Run</button><button class="test pri">Run tests</button><button class="hint">Show hint</button><button class="reset">Reset code</button></div>
      <ol class="hints"></ol><pre class="term" aria-live="polite"></pre><div class="res" aria-live="polite"></div></section>`);
    const ed = makeEditor($('.ed', card), c.id, drafts[c.id] ?? c.starter);
    const term = $('.term', card), res = $('.res', card); let shown = 0;
    $('.run', card).onclick = () => runInto(term, ed.get(), $('.inp', card).value);
    $('.reset', card).onclick = () => { ed.set(c.starter); term.textContent = ''; };
    $('.hint', card).onclick = () => {
      if (shown < c.hints.length) $('.hints', card).appendChild(h(`<li>${esc(c.hints[shown++])}</li>`));
      if (shown >= c.hints.length) $('.hint', card).disabled = true;
    };
    $('.test', card).onclick = async (e) => {
      e.target.disabled = true; res.innerHTML = '<p>Running tests…</p>';
      try {
        const results = await runTests(ed.get(), c.tests);
        res.innerHTML = showResults(results);
        if (results.every((r) => r.pass)) {
          const first = !done(c);
          if (first) { Progress.complete(topic.id, c.id); checkBadges(); header(); }
          res.insertAdjacentHTML('afterbegin', `<p class="win">All tests passed! ${first ? '+' + c.xp + ' XP earned.' : 'XP for this challenge was already earned.'}</p>`);
        }
      } catch (err) { res.innerHTML = '<p class="err">Python is not available yet. Check your connection and reload.</p>'; }
      e.target.disabled = false;
    };
    return card;
  }

  // ---------- Explore demo (one per topic key) ----------
  const DEMOS = {
    loops(host) {
      host.innerHTML = `<div class="btns"><button data-m="for" class="pri">for loop</button><button data-m="while">while loop</button></div><div class="ctl"></div>
        <pre class="code gen"></pre><div class="chips"></div><p class="say"></p>
        <div class="btns"><button class="step">Step</button><button class="play pri">Play</button><button class="rst">Reset</button><button class="py">Run in Python</button></div><pre class="term"></pre>`;
      let mode = 'for', vals = [], idx = -1, endless = false, code = '';
      const ctl = $('.ctl', host), gen = $('.gen', host), chips = $('.chips', host), say = $('.say', host), term = $('.term', host);
      const num = (id, label, v) => `<label>${label} <input type="number" id="${id}" value="${v}"></label>`;
      const stop = () => clearInterval(demoTimer);
      function paint() { chips.querySelectorAll('.chip').forEach((c, i) => { c.className = 'chip' + (i < idx ? ' past' : i === idx ? ' now' : ''); }); }
      function reset() {
        stop(); idx = -1; endless = false; vals = []; term.textContent = ''; say.textContent = '';
        const a = +$('#a', host).value, b = +$('#b', host).value;
        if (mode === 'for') {
          const s = +$('#s', host).value;
          code = `for i in range(${a}, ${b}${s === 1 ? '' : ', ' + s}):\n    print(i)`;
          if (![a, b, s].every(Number.isInteger)) say.textContent = 'range() needs whole numbers.';
          else if (s === 0) say.textContent = 'A step of 0 would never move, so range() refuses it.';
          else for (let i = a; (s > 0 ? i < b : i > b) && vals.length < 30; i += s) vals.push(i);
        } else {
          const inc = $('#inc', host).checked;
          code = `x = ${a}\nwhile x < ${b}:\n    print(x)` + (inc ? '\n    x = x + 1' : '');
          if (inc) for (let x = a; x < b && vals.length < 30; x++) vals.push(x);
          else if (a < b) { endless = true; for (let k = 0; k < 8; k++) vals.push(a); }
        }
        gen.textContent = code;
        chips.innerHTML = vals.map((v) => `<span class="chip">${v}</span>`).join('') + (endless ? '<span class="chip">…</span>' : '');
        if (!say.textContent) say.textContent = vals.length ? 'Press Step to run one pass of the loop.' : 'The condition is False straight away, so the loop runs 0 times.';
      }
      function step() {
        if (idx + 1 >= vals.length) {
          say.textContent = endless ? 'The condition never becomes False, so this loop never stops.' : `The loop is finished after ${vals.length} pass(es).`;
          stop(); return;
        }
        idx++; paint();
        say.textContent = `Pass ${idx + 1}: ${mode === 'for' ? 'i' : 'x'} is ${vals[idx]}, so print shows ${vals[idx]}.`;
      }
      function controls() {
        ctl.innerHTML = mode === 'for' ? num('a', 'start', 1) + num('b', 'stop', 6) + num('s', 'step', 1)
          : num('a', 'x starts at', 0) + num('b', 'limit', 4) + '<label><input type="checkbox" id="inc" checked> change x inside the loop</label>';
        ctl.querySelectorAll('input').forEach((i) => { i.oninput = reset; });
        reset();
      }
      host.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { mode = b.dataset.m; host.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('pri', x === b)); controls(); }; });
      $('.step', host).onclick = step;
      $('.play', host).onclick = () => { stop(); demoTimer = setInterval(step, 500); };
      $('.rst', host).onclick = reset;
      $('.py', host).onclick = () => runInto(term, code, '');
      controls();
    },
  };

  // ---------- stage views ----------
  const badgeList = () => `<ul class="badges">${topic.badges.map((b) => `<li class="${Progress.hasBadge(b.id) ? 'got' : ''}"><b>${esc(b.name)}</b> ${esc(b.desc)}</li>`).join('')}</ul>`;

  const VIEWS = {
    dashboard() {
      const cs = challenges(topic), n = cs.filter(done).length + (quizDone() ? 1 : 0), total = cs.length + 1;
      const reset = h('<button>Erase my progress</button>');
      reset.onclick = () => { if (confirm('Erase all progress saved in this browser?')) { Progress.reset(); go('dashboard'); } };
      const store = h('<section class="card"><h3>Saved on this device</h3><p>Progress is stored in this browser only. It does not sync to other devices, and clearing browser data erases it.</p></section>');
      store.appendChild(reset);
      return [
        h(`<section class="card"><h2>${esc(topic.title)}</h2><p>${topic.intro}</p><h3>You will learn to</h3><ul>${topic.objectives.map((o) => `<li>${o}</li>`).join('')}</ul>
          <p><b>${n} of ${total}</b> challenges complete</p><div class="bar big"><i style="width:${(n / total) * 100}%"></i></div></section>`),
        h(`<section class="card"><h3>Challenges</h3><ul class="list">${cs.map((c) => `<li>${done(c) ? '✔' : '○'} ${esc(c.title)} <small>${c.xp} XP</small></li>`).join('')}<li>${quizDone() ? '✔' : '○'} Final quiz <small>up to ${topic.quiz.length * 10} XP</small></li></ul></section>`),
        h(`<section class="card"><h3>Badges</h3>${badgeList()}</section>`),
        store,
      ];
    },
    learn() {
      return topic.sections.map((sec, i) => {
        const card = h(`<section class="card"><h3>${esc(sec.title)}</h3><p>${sec.text}</p><pre class="code">${esc(sec.code)}</pre><p class="why">${sec.why}</p>
          <div class="btns"><button class="run pri">Run this code</button><button class="open">Edit in Code stage</button></div><pre class="term"></pre></section>`);
        $('.run', card).onclick = () => runInto($('.term', card), sec.code, sec.inputs || '');
        $('.open', card).onclick = () => { drafts.free = sec.code; drafts.freeInput = sec.inputs || ''; go('code'); };
        return card;
      });
    },
    explore() {
      const card = h('<section class="card"><h3>Loop visualizer</h3><p>Change the numbers, press Step, and watch each pass of the loop. Then run the same code in real Python.</p><div class="demo"></div></section>');
      DEMOS[topic.demo]($('.demo', card));
      return [card];
    },
    practice: () => [h('<section class="card"><p>Three exercises, from easy to hard. Run tests to check your work. Hints appear one at a time.</p></section>'), ...topic.exercises.map(challengeCard)],
    build: () => [h('<section class="card"><p>Put it together in one small project.</p></section>'), challengeCard(topic.project)],
    code() {
      const card = h(`<section class="card"><h3>Free coding</h3><p>Write anything you like. No tests, no pressure.</p><div class="ed"></div>
        <label class="lab">Input <small>(one line per input() call)</small><textarea class="inp" rows="2">${esc(drafts.freeInput || '')}</textarea></label>
        <div class="btns"><button class="run pri">Run</button><button class="clr">Clear output</button><button class="reset">Reset code</button></div><pre class="term" aria-live="polite"></pre></section>`);
      const start = '# Write any Python here\nfor i in range(3):\n    print("Hello, Python Lab!", i)\n';
      const ed = makeEditor($('.ed', card), 'free', drafts.free ?? start), term = $('.term', card);
      $('.run', card).onclick = () => runInto(term, ed.get(), $('.inp', card).value);
      $('.clr', card).onclick = () => { term.textContent = ''; };
      $('.reset', card).onclick = () => ed.set(start);
      return [card];
    },
    finish() {
      const q = topic.quiz;
      const quiz = h(`<section class="card"><h3>Final quiz</h3><p>Score ${topic.quizPass} or more to pass. Each correct answer is worth 10 XP.</p>${q.map((x, i) => `<fieldset><legend>${i + 1}. ${esc(x.q)}</legend>${x.code ? `<pre class="code">${esc(x.code)}</pre>` : ''}${x.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"> ${esc(o)}</label>`).join('')}<p class="why" hidden></p></fieldset>`).join('')}
        <div class="btns"><button class="chk pri">Check answers</button></div><p class="score" aria-live="polite"></p></section>`);
      const fin = h('<section class="card"></section>');
      const fill = () => {
        fin.innerHTML = allDone()
          ? `<h3>${esc(topic.title)} complete!</h3><p class="win">Nice work. You finished every challenge and passed the quiz.</p><h3>Skills you learned</h3><ul>${topic.skills.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><h3>Badges</h3>${badgeList()}<p>${esc(topic.next)}</p>`
          : `<h3>Still to do</h3><ul class="list">${challenges(topic).filter((c) => !done(c)).map((c) => `<li>○ ${esc(c.title)}</li>`).join('')}${quizDone() ? '' : '<li>○ Pass the quiz</li>'}</ul>`;
      };
      $('.chk', quiz).onclick = () => {
        let s = 0; const before = Progress.quiz(topic.id);
        q.forEach((x, i) => {
          const v = quiz.querySelector(`input[name=q${i}]:checked`), ok = !!v && +v.value === x.answer, p = quiz.querySelectorAll('.why')[i];
          if (ok) s++;
          p.hidden = false; p.className = 'why ' + (ok ? 'ok' : 'err'); p.textContent = (ok ? 'Correct. ' : 'Not quite. ') + x.why;
        });
        Progress.setQuiz(topic.id, s); checkBadges(); header(); fill();
        $('.score', quiz).textContent = `You scored ${s} of ${q.length}.` + (s >= topic.quizPass ? '' : ` Get ${topic.quizPass} to pass.`) + (s > before ? ` +${(s - before) * 10} XP` : '');
      };
      fill();
      return [quiz, fin];
    },
  };

  // ---------- navigation ----------
  const stageDone = (id) => ({ practice: topic.exercises.every(done), build: done(topic.project), finish: allDone() }[id]);
  function draw() {
    header();
    $('#nav').replaceChildren(...STAGES.map(([id, label]) => {
      const b = h(`<button${id === stage ? ' aria-current="page"' : ''}>${label}${stageDone(id) ? ' ✔' : ''}</button>`);
      b.onclick = () => go(id); return b;
    }));
    $('#main').replaceChildren(...VIEWS[stage]());
  }
  function go(s) {
    for (const id in live) { drafts[id] = live[id].get(); delete live[id]; }
    clearInterval(demoTimer); stage = s; draw(); window.scrollTo(0, 0);
  }

  $('#topic').innerHTML = TOPICS.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('');
  $('#topic').onchange = (e) => { topic = TOPICS.find((t) => t.id === e.target.value); go('dashboard'); };
  PythonRunner.onStatus((s) => {
    const b = $('#py-status'); b.hidden = s.state === 'ready';
    b.className = 'status ' + s.state;
    b.textContent = s.state === 'loading' ? 'Loading Python… the first visit downloads about 10 MB.' : 'Python could not load (' + s.message + '). Check your connection and reload.';
  });
  draw();
})();
