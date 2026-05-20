export const DEFILLAMA_APY_STORAGE_KEY = 'curveyield.euler.defillama.apy.v2';
export const BUNDLED_APY_URL = './public/data/asset-apy-fallback.json';
export const DEFILLAMA_POOLS_URL = 'https://yields.llama.fi/pools';
export const YEARN_CHAIN_IDS = {
  arbitrum: 42161,
  ethereum: 1,
};
export const BEEFY_VAULTS_URL = 'https://api.beefy.finance/vaults';
export const BEEFY_APY_URL = 'https://api.beefy.finance/apy';
export const BEEFY_DATA_APYS_URL = 'https://data.beefy.finance/api/v2/apys';
export const CURVE_SCRVUSD_YIELD_URL = 'https://prices.curve.finance/v1/crvusd/savings/yield';

export const ASSET_APY_SOURCE_CONFIG = {
  asdCRV: { source: 'defillama', pool: 'd853189e-6f71-45d0-b3ee-b3b989faa447' },
  aCRV: { source: 'defillama', pool: 'fc43f71b-6b18-42d1-86a8-e8d5192857cb' },
  'st-yCRV': { source: 'defillama', pool: '320550a3-b7c4-4017-a5dd-f3ebed459470' },
  'yvCurve-yYB': { source: 'yearn', token: '0x0844C227b892be5d7c837000C096f64bFc316c2d' },
  crvUSD: { source: 'fixed', apy: 0 },
  'cy-crvUSD': { source: 'fixed', apy: 0 },
  YBcrvUSD: {
    source: 'beefy-data',
    vaultId: 'curve-crvusd-yb',
    token: '0x0B1b34677B80F499D2f03Bf335Ed6A2Db9f2a376',
  },
  scrvUSD: { source: 'curve' },
};

export function readStoredApy(raw) {
  if (!raw) return { updatedAt: 0, sources: {}, values: {} };
  try {
    const parsed = JSON.parse(raw);
    return {
      updatedAt: Number(parsed.updatedAt) || 0,
      sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
      values: parsed.values && typeof parsed.values === 'object' ? parsed.values : {},
    };
  } catch {
    return { updatedAt: 0, sources: {}, values: {} };
  }
}

export function mergeApySources({ bundled = {}, local = {} } = {}) {
  return {
    updatedAt: Math.max(Number(bundled.updatedAt) || 0, Number(local.updatedAt) || 0),
    sources: {
      ...(bundled.sources || {}),
      ...(local.sources || {}),
    },
    values: {
      ...(bundled.values || {}),
      ...(local.values || {}),
    },
  };
}

export async function loadBundledApy(fetcher = globalThis.fetch, url = BUNDLED_APY_URL) {
  if (!fetcher) return { updatedAt: 0, sources: {}, values: {} };
  try {
    const response = await fetcher(url, { cache: 'no-store' });
    if (!response?.ok) return { updatedAt: 0, sources: {}, values: {} };
    return readStoredApy(JSON.stringify(await response.json()));
  } catch {
    return { updatedAt: 0, sources: {}, values: {} };
  }
}

export function formatApy(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0.00%';
  return `${number.toFixed(2)}%`;
}

export function assetApyKey(asset) {
  return `${asset.chainId || ''}:${asset.symbol}`;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function symbolMatches(poolSymbol, assetSymbol) {
  const normalizedPool = normalize(poolSymbol);
  const normalizedAsset = normalize(assetSymbol);
  if (normalizedPool === normalizedAsset) return true;
  if (normalizedPool.endsWith(normalizedAsset)) return true;
  return normalizedPool
    .split(/[^a-z0-9]+/i)
    .map(normalize)
    .includes(normalizedAsset);
}

function poolApy(pool) {
  if (Number.isFinite(Number(pool.apy))) return Number(pool.apy);
  const base = Number(pool.apyBase) || 0;
  const reward = Number(pool.apyReward) || 0;
  return base + reward;
}

export function extractIntrinsicApys(pools, assets) {
  const rows = Array.isArray(pools?.data) ? pools.data : pools;
  if (!Array.isArray(rows)) return {};

  return assets.reduce((result, asset) => {
    const token = normalize(asset.token);
    const chain = normalize(asset.chain);
    const symbol = normalize(asset.symbol);
    const candidates = rows.filter((pool) => {
      const tokenMatch = token && (
        normalize(pool.token) === token ||
        (Array.isArray(pool.underlyingTokens) && pool.underlyingTokens.map(normalize).includes(token))
      );
      const symbolMatch = symbol && symbolMatches(pool.symbol, symbol);
      const chainMatch = !chain || normalize(pool.chain) === chain;
      return chainMatch && (tokenMatch || symbolMatch);
    });

    const best = candidates.sort((a, b) => {
      const intrinsicScore = Number(Boolean(b.isIntrinsicSource)) - Number(Boolean(a.isIntrinsicSource));
      if (intrinsicScore !== 0) return intrinsicScore;
      return (Number(b.tvlUsd) || 0) - (Number(a.tvlUsd) || 0);
    })[0];

    if (best) {
      result[assetApyKey(asset)] = {
        apy: poolApy(best),
        formatted: formatApy(poolApy(best)),
        project: best.project || '',
        chain: best.chain || '',
        pool: best.pool || '',
        updatedAt: Date.now(),
      };
    }

    return result;
  }, {});
}

export function extractDefillamaPoolApys(pools, assets) {
  const rows = Array.isArray(pools?.data) ? pools.data : pools;
  if (!Array.isArray(rows)) return {};

  return assets.reduce((result, asset) => {
    const poolId = ASSET_APY_SOURCE_CONFIG[asset.symbol]?.pool;
    const row = rows.find((pool) => pool.pool === poolId);
    if (row) {
      const apy = poolApy(row);
      result[assetApyKey(asset)] = {
        apy,
        formatted: formatApy(apy),
        project: row.project || '',
        chain: row.chain || '',
        pool: row.pool || '',
        source: 'defillama',
        updatedAt: Date.now(),
      };
    }
    return result;
  }, {});
}

export function extractCurveScrvusdApy(response) {
  const rows = Array.isArray(response?.data) ? response.data : [];
  const latest = rows.filter((row) => Number.isFinite(Number(row.proj_apy))).at(-1);
  if (!latest) return null;
  const apy = Number(latest.proj_apy);
  return {
    apy,
    formatted: formatApy(apy),
    project: 'curve',
    chain: 'Ethereum',
    pool: 'scrvUSD savings',
    source: 'curve',
    updatedAt: Date.now(),
  };
}

function normalizeApyDecimal(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.abs(number) <= 1 ? number * 100 : number;
}

export function extractYearnApys(vaults, assets) {
  const rows = Array.isArray(vaults) ? vaults : [];
  return assets.reduce((result, asset) => {
    const symbol = normalize(asset.symbol);
    const token = normalize(asset.token);
    const chainId = YEARN_CHAIN_IDS[asset.chainId];

    const best = rows.find((vault) => {
      const vaultSymbol = normalize(vault.symbol || vault.token?.symbol);
      const vaultAddress = normalize(vault.address);
      const tokenAddress = normalize(vault.token?.address || vault.tokenAddress);
      const vaultChain = Number(vault.chainID || vault.chainId || vault.chain);
      const chainMatch = !chainId || !vaultChain || vaultChain === chainId;
      return chainMatch && (
        (token && (vaultAddress === token || tokenAddress === token)) ||
        (symbol && symbolMatches(vaultSymbol, symbol))
      );
    });

    const apy = normalizeApyDecimal(best?.apy?.net_apy ?? best?.apy?.netApy ?? best?.net_apy ?? best?.apr?.netAPR);
    if (best && apy !== null) {
      result[assetApyKey(asset)] = {
        apy,
        formatted: formatApy(apy),
        project: 'yearn',
        chain: asset.chain || '',
        pool: best.address || '',
        source: 'yearn',
        updatedAt: Date.now(),
      };
    }

    return result;
  }, {});
}

export function extractBeefyApys(vaults, apys, assets) {
  const rows = Array.isArray(vaults) ? vaults : [];
  return assets.reduce((result, asset) => {
    const symbol = normalize(asset.symbol);
    const token = normalize(asset.token);
    const configuredVaultId = ASSET_APY_SOURCE_CONFIG[asset.symbol]?.vaultId;
    const best = configuredVaultId ? rows.find((vault) => vault.id === configuredVaultId) : rows.find((vault) => {
      const chainMatch = !asset.chainId || normalize(vault.network) === normalize(asset.chainId);
      const tokenMatch = token && [
        vault.earnContractAddress,
        vault.earnedTokenAddress,
        vault.tokenAddress,
      ].map(normalize).includes(token);
      const symbolMatch = symbol && (
        symbolMatches(vault.token, symbol) ||
        symbolMatches(vault.oracleId, symbol) ||
        (Array.isArray(vault.assets) && vault.assets.map(normalize).includes(symbol))
      );
      return chainMatch && (tokenMatch || symbolMatch);
    });

    const apy = normalizeApyDecimal(apys?.[best?.id]);
    if (best && apy !== null) {
      result[assetApyKey(asset)] = {
        apy,
        formatted: formatApy(apy),
        project: 'beefy',
        chain: best.network || '',
        pool: best.id || '',
        source: 'beefy',
        updatedAt: Date.now(),
      };
    }

    return result;
  }, {});
}

export function extractBeefyDataApy(rows, asset) {
  const latest = (Array.isArray(rows) ? rows : [])
    .filter((row) => normalizeApyDecimal(row?.v) !== null)
    .sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0))
    .at(-1);
  const apy = normalizeApyDecimal(latest?.v);
  if (apy === null) return null;
  return {
    apy,
    formatted: formatApy(apy),
    project: 'beefy',
    chain: asset.chain || '',
    pool: ASSET_APY_SOURCE_CONFIG[asset.symbol]?.vaultId || '',
    source: 'beefy-data',
    updatedAt: Date.now(),
  };
}

export async function fetchAssetApys({ assets, cachedSources = {}, limitedFetch }) {
  const normalizedAssets = assets.map((asset) => {
    const configured = ASSET_APY_SOURCE_CONFIG[asset.symbol];
    return {
      ...asset,
      token: asset.token || configured?.token,
    };
  });
  const values = {};
  const sources = { ...cachedSources };
  const unresolved = [];

  for (const asset of normalizedAssets) {
    const configured = ASSET_APY_SOURCE_CONFIG[asset.symbol];
    const key = assetApyKey(asset);
    if (configured?.source === 'fixed') {
      const apy = Number(configured.apy) || 0;
      values[key] = {
        apy,
        formatted: formatApy(apy),
        project: 'fixed',
        chain: asset.chain || '',
        pool: 'hardcoded',
        source: 'fixed',
        updatedAt: Date.now(),
      };
      sources[key] = 'fixed';
    } else {
      unresolved.push(asset);
    }
  }

  async function applySource(source, candidates) {
    if (candidates.length === 0) return;
    let found = {};

    if (source === 'defillama') {
      const response = await limitedFetch(DEFILLAMA_POOLS_URL);
      const body = await response.json();
      const configuredCandidates = candidates.filter((asset) => ASSET_APY_SOURCE_CONFIG[asset.symbol]?.source === 'defillama');
      const discoveryCandidates = candidates.filter((asset) => !ASSET_APY_SOURCE_CONFIG[asset.symbol] && (!sources[asset.symbol] || sources[asset.symbol] === source));
      found = {
        ...extractDefillamaPoolApys(body, configuredCandidates),
        ...extractIntrinsicApys(body, discoveryCandidates),
      };
    }

    if (source === 'curve') {
      const end = Math.floor(Date.now() / 1000);
      const start = end - 86400;
      const response = await limitedFetch(`${CURVE_SCRVUSD_YIELD_URL}?start=${start}&end=${end}`);
      const scrvusd = extractCurveScrvusdApy(await response.json());
      const scrvusdAsset = candidates.find((asset) => asset.symbol === 'scrvUSD');
      if (scrvusd && scrvusdAsset) found[assetApyKey(scrvusdAsset)] = scrvusd;
    }

    if (source === 'yearn') {
      const byChain = [...new Set(candidates.map((asset) => asset.chainId))];
      const rows = [];
      for (const chainId of byChain) {
        const yearnChain = YEARN_CHAIN_IDS[chainId];
        if (yearnChain) {
          const response = await limitedFetch(`https://ydaemon.yearn.fi/${yearnChain}/vaults/all`);
          rows.push(...await response.json());
        }
      }
      found = extractYearnApys(rows, candidates);
    }

    if (source === 'beefy') {
      const [vaultsResponse, apyResponse] = await Promise.all([
        limitedFetch(BEEFY_VAULTS_URL),
        limitedFetch(BEEFY_APY_URL),
      ]);
      found = extractBeefyApys(await vaultsResponse.json(), await apyResponse.json(), candidates);
    }

    if (source === 'beefy-data') {
      for (const asset of candidates) {
        const vaultId = ASSET_APY_SOURCE_CONFIG[asset.symbol]?.vaultId;
        if (!vaultId) continue;
        const response = await limitedFetch(`${BEEFY_DATA_APYS_URL}?vault=${vaultId}&bucket=1h_1d`);
        const apy = extractBeefyDataApy(await response.json(), asset);
        if (apy) found[assetApyKey(asset)] = apy;
      }
    }

    for (const asset of candidates) {
      const key = assetApyKey(asset);
      if (found[key]) {
        values[key] = { ...found[key], source };
        sources[key] = source;
      }
    }
  }

  for (const source of ['defillama', 'curve', 'yearn', 'beefy', 'beefy-data']) {
    const candidates = unresolved.filter((asset) => {
      const configured = ASSET_APY_SOURCE_CONFIG[asset.symbol]?.source;
      if (configured) return configured === source;
      const key = assetApyKey(asset);
      return !sources[key] || sources[key] === source;
    });
    await applySource(source, candidates);
  }

  return { sources, values };
}

export function createRequestLimiter({ fetcher, intervalMs = 4000, maxCalls = 1 }) {
  const queue = [];
  let activeWindowCalls = 0;
  let windowStarted = 0;
  let running = false;

  function pump() {
    if (running || queue.length === 0) return;

    const now = Date.now();
    if (!windowStarted || now - windowStarted >= intervalMs) {
      windowStarted = now;
      activeWindowCalls = 0;
    }

    if (activeWindowCalls >= maxCalls) {
      globalThis.setTimeout(pump, Math.max(0, intervalMs - (now - windowStarted)));
      return;
    }

    const item = queue.shift();
    activeWindowCalls += 1;
    running = true;

    fetcher(item.url)
      .then(item.resolve, item.reject)
      .finally(() => {
        running = false;
        pump();
      });
  }

  return function limitedFetch(url) {
    return new Promise((resolve, reject) => {
      queue.push({ url, resolve, reject });
      pump();
    });
  };
}
