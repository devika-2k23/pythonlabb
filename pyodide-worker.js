// Runs Python in a Web Worker so an endless loop can be stopped by terminating the worker.
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

// Python calls this to send printed text to the page.
self.emit = (text) => postMessage({ type: 'out', text });

// Browsers can't pause for typing inside a worker, so input() reads from lines
// the student writes in the Input box before running.
const PRELUDE = `
import sys, traceback, js

class _Out:
    def __init__(self, limit):
        self.n = 0
        self.limit = limit
    def write(self, s):
        self.n += len(s)
        if self.n > self.limit:
            raise RuntimeError("Too much output! Is your loop ever going to stop?")
        js.emit(s)
        return len(s)
    def flush(self):
        pass

def run_user(code, inputs, echo):
    queue = list(inputs.to_py())
    sys.stdout = sys.stderr = _Out(8000)
    def fake_input(prompt=""):
        if echo:
            print(prompt, end="")
        if not queue:
            raise EOFError("input() needs a value, but the Input box has no lines left. Add one line per input() call.")
        value = str(queue.pop(0))
        if echo:
            print(value)
        return value
    ns = {"__name__": "__main__", "input": fake_input}
    try:
        exec(compile(code, "<your code>", "exec"), ns)
        return None
    except SystemExit:
        return None
    except BaseException as e:
        line = getattr(e, "lineno", None) if isinstance(e, SyntaxError) else None
        for frame in traceback.extract_tb(e.__traceback__):
            if frame.filename == "<your code>":
                line = frame.lineno
        where = "line " + str(line) + ": " if line else ""
        return where + type(e).__name__ + ": " + str(e)
`;

let runUser;
(async () => {
  try {
    const pyodide = await loadPyodide();
    pyodide.runPython(PRELUDE);
    runUser = pyodide.globals.get('run_user');
    postMessage({ type: 'ready' });
  } catch (err) {
    postMessage({ type: 'fatal', message: String(err) });
  }
})();

self.onmessage = (e) => {
  const { code, inputs, echo } = e.data;
  let error = null;
  try { error = runUser(code, inputs, echo); } catch (err) { error = String(err); }
  postMessage({ type: 'done', error: error ?? null });
};
