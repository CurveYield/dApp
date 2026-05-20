const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const [url, outPath, portArg = '9223', widthArg = '1440', heightArg = '1600'] = process.argv.slice(2);

if (!url || !outPath) {
  console.error('Usage: node tools/capture-cdp.cjs <url> <out.png> [port] [width] [height]');
  process.exit(1);
}

const port = Number(portArg);
const width = Number(widthArg);
const height = Number(heightArg);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = `${process.env.TEMP || '.'}\\cy-cdp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path, timeout: 2000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('Timed out waiting for Chrome DevTools')));
  });
}

async function waitForDebuggerUrl() {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    try {
      const pages = await getJson('/json');
      const page = pages.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      await sleep(300);
    }
  }
  throw new Error('Chrome DevTools endpoint did not become ready.');
}

async function main() {
  fs.mkdirSync(profile, { recursive: true });
  const child = spawn(chrome, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-default-browser-check',
    url,
  ], { detached: false, stdio: 'ignore' });

  let ws;
  try {
    const wsUrl = await waitForDebuggerUrl();
    ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    let id = 0;
    const callbacks = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && callbacks.has(message.id)) {
        const { resolve, reject } = callbacks.get(message.id);
        callbacks.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });

    function send(method, params = {}) {
      const callId = ++id;
      ws.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => callbacks.set(callId, { resolve, reject }));
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(18000);
    const clicks = String(process.env.CDP_CLICKS || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [x, y, wait = '900'] = item.split(',').map((part) => Number(part.trim()));
        return { x, y, wait };
      })
      .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));

    for (const click of clicks) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: click.x, y: click.y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: click.x, y: click.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: click.x, y: click.y, button: 'left', clickCount: 1 });
      await sleep(Number.isFinite(click.wait) ? click.wait : 900);
    }

    const evals = String(process.env.CDP_EVALS || '')
      .split('\n---\n')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const expression of evals) {
      await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      await sleep(900);
    }

    const title = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
    const text = await send('Runtime.evaluate', {
      expression: 'document.body ? document.body.innerText.slice(0, 5000) : ""',
      returnByValue: true,
    });
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log(JSON.stringify({
      path: outPath,
      bytes: fs.statSync(outPath).size,
      title: title.result.value,
      text: text.result.value,
    }));
  } finally {
    if (ws) ws.close();
    child.kill();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
