# Python Lab — Learn, Code, Build

A static site where students learn Python in the browser. Current topic: **Python Loops**.
Python runs with Pyodide in a Web Worker; there is no backend, database, or account.

## Run locally
Web Workers need a server (opening index.html directly will not work):

    cd python-lab
    python3 -m http.server 8000

Open http://localhost:8000. Internet access is needed for the CDN libraries (Pyodide, CodeMirror).

## Try it
1. Dashboard shows progress, XP, and badges.
2. Learn and Explore: run examples and use the loop visualizer.
3. Practice and Build: press **Run tests**. Tests run your real program with fixed input lines and compare its output. Some tests are hidden.
4. Code: free editor. Finish: quiz and completion summary.

`input()` reads one line per call from the **Input** box, because browsers can't pause a worker for typing.
Runs stop after 5 seconds (3 seconds per test), and output is capped, so endless loops can't freeze the page.
Progress is saved in this browser only (localStorage) and does not sync across devices.

## Add a new topic
1. Add another object to `TOPICS` in `data/lessons.js` (same shape as Loops: sections, exercises, project, quiz, badges).
2. Set its `demo` key to a function in `DEMOS` in `js/app.js` (write a new visualizer, or reuse one).
3. Reload. The topic appears in the header dropdown.

## Publish on GitHub Pages
    git init && git add . && git commit -m "Add Python Lab"
    git branch -M main
    git remote add origin https://github.com/<you>/python-lab.git
    git push -u origin main

Then: repository Settings, Pages, deploy from branch `main`, folder `/ (root)`.
