const http = require('http');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const path = require('path');

const [baseUrl = 'http://127.0.0.1:5173/', portArg = '9231', widthArg = '1440', heightArg = '1600'] = process.argv.slice(2);
const port = Number(portArg);
const width = Number(widthArg);
const height = Number(heightArg);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = `${process.env.TEMP || '.'}\\cy-route-audit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const wallet = process.env.AUDIT_WALLET || '0x0000000000000000000000000000000000005825';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: pathname, timeout: 2000 }, (response) => {
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
      await sleep(250);
    }
  }
  throw new Error('Chrome DevTools endpoint did not become ready.');
}

async function loadRoutes() {
  const modulePath = pathToFileURL(path.resolve(__dirname, '..', 'src', 'config', 'pages.js')).href;
  const { PAGES } = await import(modulePath);
  const routes = new Set(['home', 'fusion-vaults', 'explore', 'portfolio', 'dev/diagnostics']);
  for (const page of PAGES) {
    routes.add(page.id);
    if (page.type === 'market') {
      routes.add(`${page.id}/collateral`);
      routes.add(`${page.id}/debt`);
      routes.add(`portfolio-position-${page.id}-0`);
      for (const action of ['borrow', 'repay', 'supply', 'withdraw']) routes.add(`portfolio-${action}-${page.id}-0`);
    }
  }
  return [...routes];
}

async function main() {
  const routes = await loadRoutes();
  const child = spawn(chrome, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { detached: false, stdio: 'ignore' });

  let ws;
  const consoleErrors = [];
  const requestFailures = [];
  const requestUrls = new Map();
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
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(message.params?.exceptionDetails?.text || 'Runtime exception');
      }
      if (message.method === 'Network.requestWillBeSent') {
        requestUrls.set(message.params?.requestId, message.params?.request?.url || '');
      }
      if (message.method === 'Network.loadingFailed') {
        requestFailures.push({
          errorText: message.params?.errorText || 'Network request failed',
          url: requestUrls.get(message.params?.requestId) || '',
        });
      }
    });

    function send(method, params = {}) {
      const callId = ++id;
      ws.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => callbacks.set(callId, { resolve, reject }));
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        (() => {
          const wallet = '${wallet}';
          const provider = {
            chainId: '0x1',
            selectedAddress: wallet,
            _listeners: {},
            on(event, cb) { this._listeners[event] = cb; },
            removeListener() {},
            async request(args = {}) {
              const method = args.method || '';
              if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [wallet];
              if (method === 'eth_chainId') return this.chainId;
              if (method === 'wallet_switchEthereumChain') {
                this.chainId = args.params?.[0]?.chainId || this.chainId;
                this._listeners.chainChanged?.(this.chainId);
                return null;
              }
              if (method === 'wallet_addEthereumChain') return null;
              if (method === 'personal_sign' || method === 'eth_sendTransaction') throw new Error('Audit provider does not sign transactions.');
              throw new Error('Audit provider unsupported method: ' + method);
            },
          };
          Object.defineProperty(window, 'ethereum', { value: provider, configurable: true });
        })();
      `,
    });

    await send('Page.navigate', { url: baseUrl });
    await sleep(18000);

    const extraRoutesResult = await send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('a[href^="#/portfolio-position-"],a[href^="#/portfolio-borrow-"],a[href^="#/portfolio-repay-"],a[href^="#/portfolio-supply-"],a[href^="#/portfolio-withdraw-"]')].map(a => a.getAttribute('href').replace(/^#\\//,''))`,
      returnByValue: true,
    }).catch(() => ({ result: { value: [] } }));
    for (const route of extraRoutesResult.result?.value || []) routes.push(route);

    const uniqueRoutes = [...new Set(routes)];
    const results = [];
    for (const route of uniqueRoutes) {
      await send('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(`/${route}`)}`, returnByValue: true });
      await sleep(450);
      const audit = await send('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `
          (() => {
            const badTerms = ['N/A', 'Unknown', 'Pending', 'Loading...', 'undefined', 'NaN'];
            const text = document.body ? document.body.innerText : '';
            const visibleBadTerms = badTerms.filter((term) => text.includes(term));
            const overflow = [...document.querySelectorAll('body *')].filter((el) => {
              const style = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 2 || rect.height < 2) return false;
              return el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
            }).slice(0, 8).map((el) => ({
              tag: el.tagName.toLowerCase(),
              className: String(el.className || '').slice(0, 80),
              text: (el.innerText || el.textContent || '').trim().slice(0, 120),
            }));
            return {
              route: location.hash.replace(/^#\\//, ''),
              title: document.querySelector('h1')?.innerText || document.title,
              textLength: text.length,
              loadFailed: text.includes('This site can\\u2019t be reached') || text.includes('refused to connect') || text.includes('ERR_CONNECTION_REFUSED'),
              visibleBadTerms,
              overflow,
            };
          })()
        `,
      });
      results.push(audit.result.value);
    }

    const findings = results.filter((result) => result.loadFailed || result.visibleBadTerms.length || result.overflow.length);
    console.log(JSON.stringify({
      wallet,
      routeCount: uniqueRoutes.length,
      findings,
      consoleErrors,
      requestFailures: requestFailures.slice(0, 20),
    }, null, 2));
    if (findings.length || consoleErrors.length) process.exitCode = 2;
  } finally {
    if (ws) ws.close();
    child.kill();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
