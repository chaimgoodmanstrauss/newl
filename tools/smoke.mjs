// Headless Chrome smoke test: loads the app, reports console errors, simulates strokes, saves screenshots.
// Usage: node tools/smoke.mjs <url> <outdir>
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [url, out] = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + out + '/prof', '--window-size=1400,900',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) console.log('console.' + d.params.type, d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION', d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(2500);
await evalJS(`localStorage.clear(); location.reload()`); await sleep(2500);
console.log('loaded:', await evalJS('!!window.ltile'), await evalJS(`document.getElementById('stats').textContent`));
await shot('1-tile');
// sculpt: grab drag from the middle of the canvas
const cx = 290 + (1400 - 290) / 2, cy = 450;
const before = await evalJS('Array.from(ltile.state.a.pos).reduce((s,v)=>s+Math.abs(v),0)');
await mouse('mousePressed', cx, cy);
for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', cx + i * 4, cy - i * 6); await sleep(16); }
await mouse('mouseReleased', cx + 40, cy - 60);
const after = await evalJS('Array.from(ltile.state.a.pos).reduce((s,v)=>s+Math.abs(v),0)+Array.from(ltile.state.c.pos).reduce((s,v)=>s+Math.abs(v),0)');
console.log('grab changed state:', before, '->', after);
await shot('2-after-grab');
// pull airbrush
await evalJS(`document.querySelector('[data-tool=pull]').click()`);
await mouse('mousePressed', cx - 60, cy + 30);
for (let i = 0; i < 20; i++) { await mouse('mouseMoved', cx - 60 + i, cy + 30); await sleep(30); }
await mouse('mouseReleased', cx - 40, cy + 30);
console.log('undo stack buttons enabled:', await evalJS(`!document.getElementById('undo').disabled`));
await shot('3-after-pull');
await evalJS(`ltile.setView('tiling')`); await sleep(800);
console.log('tiling:', await evalJS(`document.getElementById('stats').textContent`));
await shot('4-tiling');
await evalJS(`document.getElementById('explode').value=0.6; document.getElementById('explode').dispatchEvent(new Event('input'))`); await sleep(500);
await shot('5-tiling-explode');
await evalJS(`ltile.setView('deco')`); await sleep(800);
await shot('6-deco');
ws.close(); chrome.kill();
