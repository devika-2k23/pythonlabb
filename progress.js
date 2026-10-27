// Saves progress in this browser only (localStorage). It does not sync across devices.
const Progress = (() => {
  const KEY = 'pythonlab.v1';
  const blank = () => ({ done: {}, quiz: {}, badges: {} });
  let s = blank();
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } };
  return {
    isDone: (t, id) => !!(s.done[t] && s.done[t][id]),
    complete(t, id) { (s.done[t] = s.done[t] || {})[id] = true; save(); },
    quiz: (t) => s.quiz[t] || 0,
    setQuiz(t, n) { if (n > (s.quiz[t] || 0)) { s.quiz[t] = n; save(); } },
    hasBadge: (id) => !!s.badges[id],
    addBadge(id) { s.badges[id] = true; save(); },
    reset() { s = blank(); save(); },
  };
})();
