const http = require('http');
const { spawn } = require('child_process');

const [url, expression, portArg = '9225', widthArg = '1440', heightArg = '1600'] = process.argv.slice(2);

if (!url || !expression) {
  console.error('Usage: node tools/probe-cdp.cjs <url> <expression> [port] [width] [height]');
  process.exit(1);
}

const port = Number(portArg);
const width = Number(widthArg);
const height = Number(heightArg);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = `${process.env.TEMP || '.'}\\cy-probe-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(18000);
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log(JSON.stringify(result.result.value, null, 2));
  } finally {
    if (ws) ws.close();
    child.kill();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
