// Talks to the Pyodide worker. Each run has a timeout; if it expires the worker is
// terminated and restarted, so an endless loop never freezes the page.
const PythonRunner = (() => {
  let worker, ready, current = null, chain = Promise.resolve();
  const listeners = [];
  let status = { state: 'loading' };
  const setStatus = (s) => { status = s; listeners.forEach((f) => f(s)); };

  function boot() {
    setStatus({ state: 'loading' });
    worker = new Worker('js/pyodide-worker.js');
    ready = new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') { setStatus({ state: 'ready' }); resolve(); }
        else if (m.type === 'fatal') { setStatus({ state: 'failed', message: m.message }); reject(new Error(m.message)); }
        else if (m.type === 'out' && current) current.onOut(m.text);
        else if (m.type === 'done' && current) current.finish({ error: m.error });
      };
      worker.onerror = (ev) => { setStatus({ state: 'failed', message: ev.message }); reject(new Error(ev.message)); };
    });
    ready.catch(() => {});
  }

  function exec(code, o) {
    return ready.then(() => new Promise((resolve) => {
      let output = '';
      const finish = (extra) => { clearTimeout(timer); current = null; resolve({ output, error: null, timedOut: false, ...extra }); };
      const timer = setTimeout(() => { worker.terminate(); boot(); finish({ timedOut: true }); }, o.timeoutMs);
      current = { onOut: (t) => { output += t; o.onOut(t); }, finish };
      worker.postMessage({ code, inputs: o.inputs, echo: o.echo });
    }));
  }

  // run(code, {inputs: [lines], echo, timeoutMs, onOut}) -> {output, error, timedOut}
  function run(code, opts = {}) {
    const o = { inputs: [], echo: true, timeoutMs: 5000, onOut() {}, ...opts };
    const p = chain.then(() => exec(code, o));
    chain = p.catch(() => {});
    return p;
  }

  boot();
  return { run, onStatus: (f) => { listeners.push(f); f(status); } };
})();
