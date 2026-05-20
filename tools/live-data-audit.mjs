import { fetchLivePageMetrics } from '../src/eulerLive.js';
import { PAGES } from '../src/config/pages.js';

const unresolved = ['N/A', 'Unknown', 'Pending', 'Loading...', 'undefined', 'NaN'];
const pageTypes = new Set(['market', 'earn', 'ipor-vault']);
const pages = PAGES.filter((page) => pageTypes.has(page.type));
const findings = [];
const summaries = [];
const concurrency = 4;

function inspectValue(page, path, value) {
  if (typeof value === 'string' && unresolved.some((term) => value.includes(term))) {
    findings.push({ id: page.id, type: page.type, path, value });
  }
  if (Array.isArray(value)) {
    value.forEach((row, index) => {
      if (!row || typeof row !== 'object') return;
      Object.entries(row).forEach(([key, nested]) => inspectValue(page, `${path}[${index}].${key}`, nested));
    });
  }
}

async function auditPage(page) {
  try {
    const metrics = await fetchLivePageMetrics(page);
    summaries.push({
      id: page.id,
      type: page.type,
      supplyApy: metrics?.supplyApy ?? null,
      borrowApy: metrics?.borrowApy ?? null,
      totalSupply: metrics?.totalSupply ?? null,
      availableLiquidity: metrics?.availableLiquidity ?? null,
    });
    Object.entries(metrics || {}).forEach(([key, value]) => inspectValue(page, key, value));
  } catch (error) {
    findings.push({ id: page.id, type: page.type, path: 'fetchLivePageMetrics', value: error.message });
  }
}

let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < pages.length) {
    const page = pages[cursor];
    cursor += 1;
    await auditPage(page);
  }
}));

console.log(JSON.stringify({ summaries, findings }, null, 2));
if (findings.length) process.exitCode = 2;
