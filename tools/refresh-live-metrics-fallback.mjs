import { readFile, writeFile } from 'node:fs/promises';
import { fetchLivePageMetrics } from '../src/eulerLive.js';
import { PAGES } from '../src/config/pages.js';

const outputPath = new URL('../public/data/live-metrics-fallback.json', import.meta.url);
const pageTypes = new Set(['market', 'earn', 'ipor-vault']);
const pages = PAGES.filter((page) => pageTypes.has(page.type));
const fallback = JSON.parse(await readFile(outputPath, 'utf8'));
const concurrency = 4;
let cursor = 0;

async function refreshPage(page) {
  const metrics = await fetchLivePageMetrics(page);
  fallback[page.id] = {
    ...(fallback[page.id] || {}),
    ...(metrics || {}),
    updatedAt: Date.now(),
  };
}

await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < pages.length) {
    const page = pages[cursor];
    cursor += 1;
    await refreshPage(page);
  }
}));

await writeFile(outputPath, `${JSON.stringify(fallback, null, 2)}\n`);
