export const LIVE_METRICS_STORAGE_KEY = 'curveyield.euler.liveMetrics.v2';
export const BUNDLED_LIVE_METRICS_URL = './public/data/live-metrics-fallback.json';
export const REMOTE_LIVE_METRICS_CONFIG_URL = './public/data/live-metrics-cache-config.json';
export const REMOTE_LIVE_METRICS_URL_KEY = 'curveyield.euler.remoteLiveMetricsUrl';
export const REMOTE_LIVE_METRICS_WRITE_URL_KEY = 'curveyield.euler.remoteLiveMetricsWriteUrl';
export const REMOTE_LIVE_METRICS_WRITE_METHOD_KEY = 'curveyield.euler.remoteLiveMetricsWriteMethod';

function normalizeConfig(config = {}) {
  return {
    readUrl: String(config.readUrl || '').trim(),
    writeUrl: String(config.writeUrl || '').trim(),
    writeMethod: String(config.writeMethod || 'PUT').trim().toUpperCase() || 'PUT',
  };
}

export async function loadLiveMetricsRemoteConfig(fetcher = globalThis.fetch, storage = globalThis.localStorage, url = REMOTE_LIVE_METRICS_CONFIG_URL) {
  let bundled = {};
  if (fetcher) {
    try {
      const response = await fetcher(url, { cache: 'no-store' });
      if (response?.ok) bundled = await response.json();
    } catch {
      bundled = {};
    }
  }
  const config = normalizeConfig(bundled);
  try {
    const readOverride = storage?.getItem?.(REMOTE_LIVE_METRICS_URL_KEY) || '';
    const writeOverride = storage?.getItem?.(REMOTE_LIVE_METRICS_WRITE_URL_KEY) || '';
    const methodOverride = storage?.getItem?.(REMOTE_LIVE_METRICS_WRITE_METHOD_KEY) || '';
    return normalizeConfig({
      ...config,
      readUrl: readOverride || config.readUrl,
      writeUrl: writeOverride || config.writeUrl,
      writeMethod: methodOverride || config.writeMethod,
    });
  } catch {
    return config;
  }
}

export function liveMetricsCacheUrlFromStorage(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(REMOTE_LIVE_METRICS_URL_KEY) || '';
  } catch {
    return '';
  }
}

function pageTimestamp(metrics = {}) {
  return Number(metrics?.updatedAt || 0);
}

function shouldReplacePage(current, next) {
  if (!current) return true;
  const currentUpdatedAt = pageTimestamp(current);
  const nextUpdatedAt = pageTimestamp(next);
  if (!currentUpdatedAt && nextUpdatedAt) return true;
  if (nextUpdatedAt && nextUpdatedAt >= currentUpdatedAt) return true;
  return false;
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

export function mergeLiveMetricsSources({ bundled = {}, remote = {}, local = {} } = {}) {
  const merged = {};
  for (const source of [sanitizeLiveMetrics(bundled), sanitizeLiveMetrics(remote), sanitizeLiveMetrics(local)]) {
    for (const [pageId, metrics] of Object.entries(source)) {
      if (shouldReplacePage(merged[pageId], metrics)) merged[pageId] = metrics;
    }
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

function normalizeLiveMetricsPayload(parsed) {
  const data = parsed?.pages || parsed;
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

export async function loadRemoteLiveMetrics(fetcher = globalThis.fetch, storage = globalThis.localStorage, config = null) {
  const remoteConfig = config || await loadLiveMetricsRemoteConfig(fetcher, storage);
  const url = remoteConfig.readUrl || liveMetricsCacheUrlFromStorage(storage);
  if (!url || !fetcher) return {};
  try {
    const response = await fetcher(url, { cache: 'no-store' });
    if (!response?.ok) return {};
    return normalizeLiveMetricsPayload(await response.json());
  } catch {
    return {};
  }
}

export async function publishRemoteLiveMetrics(fetcher = globalThis.fetch, storage = globalThis.localStorage, metrics = {}, config = null) {
  const remoteConfig = config || await loadLiveMetricsRemoteConfig(fetcher, storage);
  if (!remoteConfig.writeUrl || !fetcher) return false;
  const pages = sanitizeLiveMetrics(metrics);
  if (!Object.keys(pages).length) return false;
  try {
    const response = await fetcher(remoteConfig.writeUrl, {
      method: remoteConfig.writeMethod || 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedAt: Date.now(), pages }),
      cache: 'no-store',
    });
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}
