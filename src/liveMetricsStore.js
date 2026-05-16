export const LIVE_METRICS_STORAGE_KEY = 'curveyield.euler.liveMetrics.v2';
export const BUNDLED_LIVE_METRICS_URL = './public/data/live-metrics-fallback.json';
export const REMOTE_LIVE_METRICS_URL_KEY = 'curveyield.euler.remoteLiveMetricsUrl';

export function liveMetricsCacheUrlFromStorage(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(REMOTE_LIVE_METRICS_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function readLiveMetricsJson(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function isUnresolvedMetricValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return !normalized || normalized === 'Loading...' || normalized === 'Contract';
}

export function sanitizeLiveMetrics(metrics = {}) {
  const sanitized = {};
  for (const [pageId, pageMetrics] of Object.entries(metrics || {})) {
    if (!pageMetrics || typeof pageMetrics !== 'object' || Array.isArray(pageMetrics)) continue;
    const cleanPageMetrics = {};
    for (const [key, value] of Object.entries(pageMetrics)) {
      if (!isUnresolvedMetricValue(value)) cleanPageMetrics[key] = value;
    }
    if (Object.keys(cleanPageMetrics).length) sanitized[pageId] = cleanPageMetrics;
  }
  return sanitized;
}

export function mergeLiveMetricsSources({ bundled = {}, local = {} } = {}) {
  const merged = sanitizeLiveMetrics(bundled);
  for (const [pageId, metrics] of Object.entries(sanitizeLiveMetrics(local))) {
    merged[pageId] = {
      ...(merged[pageId] || {}),
      ...(metrics || {}),
    };
  }
  return merged;
}

export async function loadBundledLiveMetrics(fetcher = globalThis.fetch, url = BUNDLED_LIVE_METRICS_URL) {
  if (!fetcher) return {};
  try {
    const response = await fetcher(url, { cache: 'no-store' });
    if (!response?.ok) return {};
    const parsed = await response.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadRemoteLiveMetrics(fetcher = globalThis.fetch, storage = globalThis.localStorage) {
  const url = liveMetricsCacheUrlFromStorage(storage);
  if (!url || !fetcher) return {};
  try {
    const response = await fetcher(url, { cache: 'no-store' });
    if (!response?.ok) return {};
    const parsed = await response.json();
    const data = parsed?.pages || parsed;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}
