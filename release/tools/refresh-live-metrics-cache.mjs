import { readFile, writeFile } from 'node:fs/promises';
import { fetchLivePageMetrics } from '../src/eulerLive.js';
import { PAGES } from '../src/config/pages.js';
import { sanitizeLiveMetrics } from '../src/liveMetricsStore.js';

const outputPath = new URL('../public/data/live-metrics-cache.json', import.meta.url);
const pageTypes = new Set(['market', 'earn', 'ipor-vault']);
const pages = PAGES.filter((page) => pageTypes.has(page.type));
const concurrency = 4;

async function readExistingCache() {
  try {
    const parsed = JSON.parse(await readFile(outputPath, 'utf8'));
    return {
      updatedAt: Number(parsed?.updatedAt || 0),
      pages: parsed?.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages) ? parsed.pages : {},
    };
  } catch {
    return { updatedAt: 0, pages: {} };
  }
}

async function refreshPage(page) {
  const metrics = await fetchLivePageMetrics(page);
  return {
    pageId: page.id,
    metrics: {
      ...(metrics || {}),
      updatedAt: Date.now(),
    },
  };
}

const next = await readExistingCache();
const failures = [];
let successCount = 0;
let cursor = 0;

await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < pages.length) {
    const page = pages[cursor];
    cursor += 1;
    try {
      const refreshed = await refreshPage(page);
      const sanitized = sanitizeLiveMetrics({ [refreshed.pageId]: refreshed.metrics });
      if (sanitized[refreshed.pageId]) {
        next.pages[refreshed.pageId] = sanitized[refreshed.pageId];
        successCount += 1;
      }
    } catch (error) {
      failures.push({ id: page.id, message: error?.message || String(error) });
    }
  }
}));

if (!successCount) {
  console.error(JSON.stringify({ error: 'No live metrics pages refreshed.', failures }, null, 2));
  process.exit(1);
}

next.updatedAt = Date.now();
await writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`);

if (failures.length) {
  console.warn(JSON.stringify({ warning: 'Some live metrics pages failed and were preserved from the previous cache.', failures }, null, 2));
}
