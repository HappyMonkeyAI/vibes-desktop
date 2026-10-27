/** Click Skip step (or API resolve) on the live CDP session. */
const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 1;
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
await send('Runtime.enable');
const result = await send('Runtime.evaluate', {
  expression: `(async () => {
    const region = document.querySelector('[aria-label="Needs you"]');
    const btns = [...(region || document).querySelectorAll('button')];
    const skip = btns.find((b) => /Skip step/i.test(b.textContent || ''));
    if (skip) {
      skip.click();
      return { via: 'ui', label: (skip.textContent || '').trim() };
    }
    return { via: 'api', ...(await window.vibesDesktop.mission.resolveIntervention({ action: 'skip' })) };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
