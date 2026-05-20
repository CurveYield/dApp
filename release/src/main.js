import { CHAINS, TOKEN_ACTIONS, TOKEN_LOGOS, getChainById } from './config/assets.js?v=2026-05-19-shared-live-cache';
import { DEFAULT_PAGE_ID, PAGES, TOKEN_DESCRIPTIONS, getPageById } from './config/pages.js?v=2026-05-19-shared-live-cache';
import { combinedSupplyApy, maxRoeFromSupplyBorrowAndMultiplier, netApyFromSupplyAndBorrow } from './apyMath.js?v=2026-05-19-shared-live-cache';
import {
  irmBorrowApyAtUtilization,
  kinkIrmChartPoints,
  ltvMarkerPercent,
} from './riskVisuals.js?v=2026-05-19-shared-live-cache';
import {
  DEFILLAMA_APY_STORAGE_KEY,
  assetApyKey,
  createRequestLimiter,
  fetchAssetApys,
  loadBundledApy,
  mergeApySources,
  readStoredApy,
} from './defillama.js?v=2026-05-19-shared-live-cache';
import {
  borrowFromMarket,
  borrowMoreFromPosition,
  calculateWeightedEarnSupplyApy,
  depositToVault,
  executeLiquidation,
  fetchMarketAccountLtv,
  fetchMarketBorrowCapacity,
  fetchMarketPositions,
  fetchVaultWalletBalance,
  fetchVaultRepayCapacity,
  fetchVaultWithdrawCapacity,
  fetchLivePageMetrics,
  getConnectedWalletAccount,
  getWalletChainHex,
  activeRpcUrlForChain,
  rpcDiagnosticsSnapshot,
  requestWalletAccount,
  resetWalletConnectionCache,
  switchWalletNetwork,
  walletChainHexFor,
  repayToMarket,
  waitForTransaction,
  withdrawCollateralFromPosition,
  withdrawFromVault,
  normalizeTransactionError,
} from './eulerLive.js?v=2026-05-19-shared-live-cache';
import {
  SIMULATION_STORAGE_KEY,
  applyEarnSimulation,
  applyMarketSimulation,
  formatAmount,
  readSimulationState,
} from './simulation.js?v=2026-05-19-shared-live-cache';
import {
  LIQUIDATION_CHAINS,
  LIQUIDATION_RISK_STORAGE_KEY,
  readStoredLiquidationState,
  refreshLiquidationRiskDashboard,
} from './liquidationRisk.js?v=2026-05-19-shared-live-cache';
import {
  LIVE_METRICS_STORAGE_KEY,
  isUnresolvedMetricValue,
  loadLiveMetricsRemoteConfig,
  loadBundledLiveMetrics,
  loadRemoteLiveMetrics,
  mergeLiveMetricsSources,
  publishRemoteLiveMetrics,
  readLiveMetricsJson,
} from './liveMetricsStore.js?v=2026-05-19-shared-live-cache';

const EXPLORE_PAGE = {
  id: 'explore',
  type: 'explore',
  chainId: 'global',
  network: 'All chains',
  title: 'Explore',
  subtitle: 'Discover lending markets across Euler. Filter by asset, risk manager, or market type.',
};
const DEV_DIAGNOSTICS_PAGE = {
  id: 'diagnostics',
  type: 'diagnostics',
  chainId: 'global',
  network: 'All chains',
  title: 'Diagnostics',
  subtitle: 'Live RPC, cache, and wallet health checks.',
  navLabel: 'Diagnostics',
};
const PORTFOLIO_PAGE = {
  id: 'portfolio',
  type: 'portfolio',
  chainId: 'global',
  network: 'All chains',
  title: 'Your Portfolio',
  subtitle: 'Active loans backed by your supplied collateral.',
  navLabel: 'Portfolio',
};
const EULER_CHAINS = CHAINS.filter((chain) => chain.id !== 'base');
const root = document.getElementById('root');
let simulationState = readSimulationState(window.localStorage.getItem(SIMULATION_STORAGE_KEY));
let apyState = readStoredApy(window.localStorage.getItem(DEFILLAMA_APY_STORAGE_KEY));
let liquidationRiskState = readStoredLiquidationState(window.localStorage.getItem(LIQUIDATION_RISK_STORAGE_KEY));
let apyRefreshStarted = false;
let liquidationRiskRefreshStarted = false;
let developerMenuEnabled = window.sessionStorage.getItem('curveyield.euler.devMenu') === '1';
const productionModeEnabled = new URLSearchParams(window.location.search).get('prod') === '1'
  || window.localStorage.getItem('curveyield.euler.productionMode') === '1';
let selectedChainId = normalizeChainId(window.sessionStorage.getItem('curveyield.euler.selectedChain') || currentPage().chainId);
let exploreSearchText = window.sessionStorage.getItem('curveyield.euler.exploreSearch') || '';
let activeInfo = null;
let iporPerformanceModes = new Set(
  (window.sessionStorage.getItem('curveyield.ipor.performanceModes') || 'apy,share')
    .split(',')
    .filter(Boolean),
);
const actionModes = {};
const actionNotices = {};
const fieldDrafts = {};
let fieldDraftRenderTimer = null;
let connectedWalletAccount = '';
let walletConnectionLoaded = false;
let walletRefreshInFlight = false;
let walletDisconnected = window.sessionStorage.getItem('curveyield.euler.walletDisconnected') === '1';
const walletNetworkNotices = {};
const walletNetworkSwitchRequests = new Set();
const liveMetrics = {};
let liveMetricsRemoteConfig = null;
let liveMetricsPublishTimer = null;
const walletBalances = {};
const walletBalanceRequests = new Set();
const borrowCapacities = {};
const borrowCapacityRequests = new Set();
const withdrawCapacities = {};
const withdrawCapacityRequests = new Set();
const repayCapacities = {};
const repayCapacityRequests = new Set();
const accountLtvs = {};
const accountLtvRequests = new Set();
const marketPositions = {};
const marketPositionRequests = new Set();
const limitedFetch = createRequestLimiter({
  fetcher: window.fetch.bind(window),
  intervalMs: 4000,
  maxCalls: 5,
});
const LIVE_METRICS_MAX_AGE_MS = 86_400_000;

function saveLiveMetrics() {
  window.localStorage.setItem(LIVE_METRICS_STORAGE_KEY, JSON.stringify(liveMetrics));
  scheduleRemoteLiveMetricsPublish();
}

function scheduleRemoteLiveMetricsPublish() {
  if (!liveMetricsRemoteConfig?.writeUrl) return;
  if (liveMetricsPublishTimer) window.clearTimeout(liveMetricsPublishTimer);
  liveMetricsPublishTimer = window.setTimeout(() => {
    liveMetricsPublishTimer = null;
    publishRemoteLiveMetrics(window.fetch.bind(window), window.localStorage, liveMetrics, liveMetricsRemoteConfig).catch(() => {});
  }, 750);
}

function mergeLiveMetrics(pageId, metrics) {
  if (!metrics) return;
  const cleanMetrics = Object.fromEntries(
    Object.entries(metrics).filter(([, value]) => !isUnresolvedDisplayValue(value)),
  );
  if (!Object.keys(cleanMetrics).length) return;
  liveMetrics[pageId] = {
    ...(liveMetrics[pageId] || {}),
    ...cleanMetrics,
    updatedAt: Date.now(),
  };
  saveLiveMetrics();
}

function replaceLiveMetrics(nextMetrics) {
  for (const key of Object.keys(liveMetrics)) delete liveMetrics[key];
  Object.assign(liveMetrics, nextMetrics || {});
}

function freshLiveMetricsOnly(metrics = {}, now = Date.now()) {
  const fresh = {};
  for (const [pageId, pageMetrics] of Object.entries(metrics || {})) {
    const updatedAt = Number(pageMetrics?.updatedAt || 0);
    if (!updatedAt || now - updatedAt > LIVE_METRICS_MAX_AGE_MS) continue;
    fresh[pageId] = pageMetrics;
  }
  return fresh;
}

async function hydrateLiveMetrics() {
  liveMetricsRemoteConfig = await loadLiveMetricsRemoteConfig(window.fetch.bind(window), window.localStorage);
  const [bundled, remote, local] = await Promise.all([
    loadBundledLiveMetrics(window.fetch.bind(window)),
    loadRemoteLiveMetrics(window.fetch.bind(window), window.localStorage, liveMetricsRemoteConfig),
    Promise.resolve(readLiveMetricsJson(window.localStorage.getItem(LIVE_METRICS_STORAGE_KEY))),
  ]);
  replaceLiveMetrics(mergeLiveMetricsSources({
    bundled,
    remote: freshLiveMetricsOnly(remote),
    local: freshLiveMetricsOnly(local),
  }));
}

async function hydrateApyState() {
  const [bundled, local] = await Promise.all([
    loadBundledApy(window.fetch.bind(window)),
    Promise.resolve(readStoredApy(window.localStorage.getItem(DEFILLAMA_APY_STORAGE_KEY))),
  ]);
  apyState = mergeApySources({ bundled, local });
}

function normalizeChainId(chainId) {
  return CHAINS.some((chain) => chain.id === chainId) ? chainId : 'ethereum';
}

function isUnresolvedDisplayValue(value) {
  return isUnresolvedMetricValue(value);
}

function displayAssetForPage(page) {
  return page.asset || page.debt || page.collateral || '';
}

function generatedMetricFallback(page, key) {
  const asset = displayAssetForPage(page);
  const fallbacks = {
    price: page.debt === 'crvUSD' || page.asset === 'crvUSD' || page.asset === 'scrvUSD' ? '1.000000' : '0.000000',
    totalSupply: '0.00',
    collateralTotalSupply: '0.00',
    debtTotalSupply: '0.00',
    totalBorrows: '0.00',
    availableLiquidity: '0.00',
    supplyApy: '0.00%',
    debtSupplyApy: '0.00%',
    borrowApy: '0.00%',
    netApy: '0.00%',
    maxRoe: '0.00%',
    utilization: '0.00%',
    maxLtv: '0.00%',
    liquidationLtv: '0.00%',
    maxMultiplier: '1.00x',
    supplyCap: 'Not configured',
    borrowCap: 'Not configured',
    collateralSupplyCap: 'Not configured',
    shareTokenExchangeRate: '1.000000',
    collateralShareTokenExchangeRate: '1.000000',
    interestFee: '0.00%',
    performanceFee: '0.00%',
    projectedEarnings: `0 ${asset} ≈ $0`,
    walletBalance: `0 ${asset}`,
    irmKink: '0.00%',
    irmBaseRate: '0.00%',
    irmRateAtKink: '0.00%',
    irmMaxRate: '0.00%',
    collateralAssetAddress: page.collateralVaultAddress || page.contractAddress || '',
    debtAssetAddress: page.debtVaultAddress || page.contractAddress || '',
    feeReceiver: '',
    oracleRouter: page.routerAddress || page.oracleAddress || '',
    unitOfAccount: page.underlyingAddress || '',
    interestRateModel: page.irmAddress || '',
    hookTarget: '',
  };
  return fallbacks[key] ?? '0.00';
}

function currentPage() {
  const id = currentRoute().pageId;
  const portfolioAction = portfolioActionPageForRoute(id);
  if (portfolioAction) return portfolioAction;
  const portfolioPosition = portfolioPositionPageForRoute(id);
  if (portfolioPosition) return portfolioPosition;
  if (id === PORTFOLIO_PAGE.id) return PORTFOLIO_PAGE;
  if (id === EXPLORE_PAGE.id) return EXPLORE_PAGE;
  if (id === DEV_DIAGNOSTICS_PAGE.id) return DEV_DIAGNOSTICS_PAGE;
  return getPageById(id);
}

function portfolioActionPageForRoute(id) {
  const match = String(id || '').match(/^portfolio-(borrow|repay|supply|withdraw)-(.+)$/);
  if (!match) return null;
  const [, action, routeMarketId] = match;
  let marketId = routeMarketId;
  let positionIndex = 0;
  const indexed = routeMarketId.match(/^(.+)-(\d+)$/);
  if (indexed && getPageById(indexed[1])?.type === 'market') {
    marketId = indexed[1];
    positionIndex = Number(indexed[2]);
  }
  const market = getPageById(marketId);
  if (market?.type !== 'market') return null;
  return {
    ...market,
    id,
    marketPageId: market.id,
    positionIndex,
    portfolioAction: action,
    type: 'portfolio-action',
    title: action === 'borrow' ? 'Borrow more' : action === 'repay' ? 'Repay debt' : action === 'supply' ? 'Supply collateral' : 'Withdraw collateral',
    subtitle: market.title,
    navLabel: market.navLabel,
  };
}

function portfolioPositionPageForRoute(id) {
  const match = String(id || '').match(/^portfolio-position-(.+)-(\d+)$/);
  if (!match) return null;
  const [, marketId, index] = match;
  const market = getPageById(marketId);
  if (market?.type !== 'market') return null;
  return {
    ...market,
    id,
    marketPageId: market.id,
    positionIndex: Number(index),
    type: 'portfolio-position',
    title: `Position ${index}`,
    subtitle: market.title,
    navLabel: market.navLabel,
  };
}

function currentRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '') || DEFAULT_PAGE_ID;
  const isDeveloper = raw.startsWith('dev/');
  const clean = isDeveloper ? raw.replace(/^dev\//, '') : raw;
  const [pageId, subview = 'pair'] = clean.split('/');

  if (isDeveloper) {
    return { isDeveloper: true, pageId, subview };
  }
  return { isDeveloper: false, pageId, subview };
}

function contractValue(page, key) {
  const liveValue = liveMetrics[page.id]?.[key];
  if (page.type === 'earn' && key === 'supplyApy') {
    const weightedEarnApy = earnSupplyApyFromAllocations(page);
    if (weightedEarnApy !== 'N/A') return weightedEarnApy;
    const liveNumber = parseMetricNumber(liveValue);
    if (!isUnresolvedDisplayValue(liveValue) && Number.isFinite(liveNumber) && liveNumber >= 0) return liveValue;
    return '0.00%';
  }
  if (!isUnresolvedDisplayValue(liveValue)) return liveValue;
  const fallback = page.contractMetrics?.find((metricItem) => metricItem.key === key)?.placeholder || '';
  if (!isUnresolvedDisplayValue(fallback)) return fallback;
  return generatedMetricFallback(page, key);
}

function walletBalanceFor(vaultAddress, symbol) {
  if (!vaultAddress) return `0 ${symbol}`;
  if (walletDisconnected) return 'Connect wallet';
  const balance = walletBalances[vaultAddress.toLowerCase()];
  if (!balance) return 'Connect wallet';
  return `${balance.formatted} ${symbol}`;
}

function formattedCapacity(map, vaultAddress, symbol) {
  if (!vaultAddress) return `0 ${symbol}`;
  if (walletDisconnected) return 'Connect wallet';
  const capacity = map[vaultAddress.toLowerCase()];
  if (!capacity) return 'Connect wallet';
  return `${capacity.formatted} ${symbol}`;
}

function capacityInputValue(map, vaultAddress) {
  const capacity = vaultAddress ? map[vaultAddress.toLowerCase()] : null;
  return capacity?.formatted?.replace(/\.?0+$/, '') || '';
}

function withdrawCapacityFor(vaultAddress, symbol) {
  return formattedCapacity(withdrawCapacities, vaultAddress, symbol);
}

function suppliedCollateralFor(vaultAddress, symbol) {
  if (!vaultAddress) return `0 ${symbol}`;
  const capacity = withdrawCapacities[vaultAddress.toLowerCase()];
  if (!capacity) return 'Connect wallet';
  return `${capacity.suppliedFormatted ?? capacity.formatted} ${symbol}`;
}

function withdrawCapacityInputValue(vaultAddress) {
  return capacityInputValue(withdrawCapacities, vaultAddress);
}

function repayCapacityFor(vaultAddress, symbol) {
  return formattedCapacity(repayCapacities, vaultAddress, symbol);
}

function repayCapacityInputValue(vaultAddress) {
  return capacityInputValue(repayCapacities, vaultAddress);
}

function borrowCapacityFor(page) {
  const debtVault = page.debtVaultAddress || page.contractAddress;
  if (!debtVault) return `0 ${page.debt}`;
  const capacity = previewBorrowCapacity(page);
  if (!capacity) {
    if (accountLtvs[debtVault.toLowerCase()]) return `0 ${page.debt}`;
    return 'Connect wallet';
  }
  return `${capacity.formatted} ${page.debt}`;
}

function borrowCapacityInputValue(page) {
  const capacity = previewBorrowCapacity(page);
  return capacity?.formatted?.replace(/\.?0+$/, '') || '';
}

function cleanAmountInput(value) {
  return String(value || '').replace(/\.?0+$/, '') || '0';
}

function walletRawForVault(vaultAddress) {
  return vaultAddress ? walletBalances[vaultAddress.toLowerCase()]?.raw : null;
}

function positionRepayMax(position, debtVault) {
  if (!position) return '';
  const walletRaw = walletRawForVault(debtVault);
  const debtRaw = BigInt(position.debt || 0n);
  if (typeof walletRaw === 'bigint' && walletRaw < debtRaw) {
    return walletBalances[debtVault.toLowerCase()]?.formatted || '';
  }
  return position.debtFormatted || '';
}

function previewBorrowCapacity(page) {
  const debtVault = page.debtVaultAddress || page.contractAddress;
  const base = debtVault ? borrowCapacities[debtVault.toLowerCase()] : null;
  if (!base) return null;
  const typedCollateral = Number(fieldDrafts[`${page.id}:collateral-amount`] || 0);
  const price = parseMetricNumber(contractValue(page, 'price')) ?? 0;
  const maxLtv = percentValue(contractValue(page, 'maxLtv')) / 100;
  const current = Number(base.formatted || 0);
  if (!typedCollateral || !price || !maxLtv) return base;
  return { ...base, formatted: (current + typedCollateral * price * maxLtv).toFixed(4) };
}

function actionModeKey(pageId, group) {
  return `${pageId}:${group}`;
}

function currentActionMode(pageId, group, fallback) {
  return actionModes[actionModeKey(pageId, group)] || fallback;
}

function setActionMode(pageId, group, action) {
  actionModes[actionModeKey(pageId, group)] = action;
}

function actionButtonClass(pageId, group, action, fallback) {
  return currentActionMode(pageId, group, fallback) === action ? 'accept' : 'ghost-action';
}

function supplyMaxButton(page, field, vaultAddress, symbol) {
  const isWithdraw = currentActionMode(page.id, 'supply', 'deposit') === 'withdraw';
  if (isWithdraw) {
    return `<button class="max-link" data-fill-max="${field}" data-fill-value="${withdrawCapacityInputValue(vaultAddress)}">${withdrawCapacityFor(vaultAddress, symbol)} <b>Max</b></button>`;
  }
  return `<button class="max-link" data-fill-max="${field}" data-fill-vault="${vaultAddress || ''}">${walletBalanceFor(vaultAddress, symbol)} <b>Max</b></button>`;
}

function debtMaxButton(page, field, vaultAddress, symbol) {
  const isRepay = currentActionMode(page.id, 'debt', 'borrow') === 'repay';
  if (isRepay) {
    return `<button class="max-link" data-fill-max="${field}" data-fill-value="${repayCapacityInputValue(vaultAddress)}">${repayCapacityFor(vaultAddress, symbol)} <b>Max</b></button>`;
  }
  return `<button class="max-link" data-fill-max="${field}" data-fill-value="${borrowCapacityInputValue(page)}">${borrowCapacityFor(page)} <b>Max</b></button>`;
}

function percentValue(value) {
  const number = Number(String(value || '').replace('%', ''));
  return Number.isFinite(number) ? number : 0;
}

function marketSafetyStatus(positionLtv, liquidationLtv) {
  if (!positionLtv?.ltv) return { label: 'Connect wallet', className: 'watch', copy: 'Connect wallet to load supplied collateral, debt, and liquidation risk.' };
  if (positionLtv.liquidationLtv === 'Not configured') return { label: 'Not configured', className: 'watch', copy: 'This market is not configured for borrowing yet.' };
  const ltv = percentValue(positionLtv.ltv);
  const liq = percentValue(positionLtv.liquidationLtv || liquidationLtv);
  if (!liq) return { label: 'Live limits unavailable', className: 'watch', copy: 'Live LTV limits are not available from the market contract yet.' };
  const buffer = liq - ltv;
  if (buffer <= 3) return { label: 'Danger', className: 'danger', copy: 'Position is close to liquidation. Repay debt or add collateral.' };
  if (buffer <= 8) return { label: 'Caution', className: 'caution', copy: 'Position has limited liquidation buffer. Avoid additional borrowing.' };
  return { label: 'Safe', className: 'safe', copy: 'Position has a healthy liquidation buffer.' };
}

function renderLtvSlider(page, positionLtv) {
  const currentLtv = positionLtv?.ltv || '0.00%';
  const borrowLtv = positionLtv?.borrowLtv || contractValue(page, 'maxLtv');
  const liquidationLtv = positionLtv?.liquidationLtv || contractValue(page, 'liquidationLtv');
  const currentMarker = ltvMarkerPercent(currentLtv, liquidationLtv);
  const borrowMarker = ltvMarkerPercent(borrowLtv, liquidationLtv);
  const liquidationMarker = ltvMarkerPercent(liquidationLtv, liquidationLtv);
  const cautionWidth = Math.max(0, liquidationMarker - borrowMarker);
  const dangerWidth = Math.max(0, 100 - liquidationMarker);
  return `
    <div class="ltv-visual" style="--current-ltv:${currentMarker}%;--borrow-ltv:${borrowMarker}%;--liquidation-ltv:${liquidationMarker}%;--caution-width:${cautionWidth}%;--danger-width:${dangerWidth}%">
      <div class="ltv-scale">
        <span class="ltv-band ltv-band-safe"></span>
        <span class="ltv-band ltv-band-caution"></span>
        <span class="ltv-band ltv-band-danger"></span>
        <i class="ltv-pin ltv-pin-current"></i>
        <i class="ltv-pin ltv-pin-borrow"></i>
        <i class="ltv-pin ltv-pin-liquidation"></i>
      </div>
      <div class="ltv-scale-labels">
        <span>0%</span>
        <span>${formatPercentLabel((percentValue(borrowLtv) || 0) * 0.25)}</span>
        <span>${formatPercentLabel((percentValue(borrowLtv) || 0) * 0.5)}</span>
        <span>${formatPercentLabel((percentValue(borrowLtv) || 0) * 0.75)}</span>
        <span>${borrowLtv}</span>
      </div>
    </div>
  `;
}

function formatPercentLabel(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Number(value.toFixed(2))}%`;
}

function renderEulerLtvModule(page, positionLtv) {
  return `
    <div class="ltv-module">
      <div class="ltv-module-head">
        <strong>LTV</strong>
        <span>${positionLtv?.ltv || '0%'}</span>
      </div>
      ${renderLtvSlider(page, positionLtv)}
    </div>
  `;
}

function renderPositionSafetyPanel(page, positionLtv) {
  const debtVault = page.debtVaultAddress || page.contractAddress || '';
  const collateralVault = page.collateralVaultAddress || '';
  const status = marketSafetyStatus(positionLtv, contractValue(page, 'liquidationLtv'));
  return `
    <div class="position-risk-card safety-${status.className}">
      <div class="risk-head"><span>Position Safety</span><strong>${status.label}</strong></div>
      <div class="risk-line"><span>Wallet collateral token</span><strong>${walletBalanceFor(collateralVault, page.collateral)}</strong></div>
      <div class="risk-line"><span>Supplied collateral</span><strong>${positionLtv?.collateralFormatted ? `${positionLtv.collateralFormatted} ${page.collateral}` : suppliedCollateralFor(collateralVault, page.collateral)}</strong></div>
      <div class="risk-line"><span>Wallet debt token</span><strong>${walletBalanceFor(debtVault, page.debt)}</strong></div>
      <div class="risk-line"><span>Current debt</span><strong>${positionLtv?.debtFormatted ? `${positionLtv.debtFormatted} ${page.debt}` : repayCapacityFor(debtVault, page.debt)}</strong></div>
      <div class="risk-line"><span>Current LTV</span><strong>${positionLtv?.ltv || 'Connect wallet'}</strong></div>
      <div class="risk-line"><span>Max LTV</span><strong>${positionLtv?.borrowLtv || contractValue(page, 'maxLtv')}</strong></div>
      <div class="risk-line"><span>Liquidation LTV</span><strong>${positionLtv?.liquidationLtv || contractValue(page, 'liquidationLtv')}</strong></div>
      <div class="risk-line"><span>Borrow remaining</span><strong>${positionLtv?.borrowCapacityFormatted ? `${positionLtv.borrowCapacityFormatted} ${page.debt}` : borrowCapacityFor(page)}</strong></div>
      <div class="risk-line"><span>Withdraw remaining</span><strong>${positionLtv?.withdrawCapacityFormatted ? `${positionLtv.withdrawCapacityFormatted} ${page.collateral}` : withdrawCapacityFor(collateralVault, page.collateral)}</strong></div>
      <p>${positionLtv?.warning || status.copy}</p>
    </div>
  `;
}

function formatTxStepNotice({ index, total, label }) {
  return `Executing ${index} out of ${total} transactions: ${label}.`;
}

function setTxStepNotice(pageId, step) {
  actionNotices[pageId] = formatTxStepNotice(step);
  render();
}

function setPreflightNotice(pageId, preflight) {
  actionNotices[pageId] = `Preflight passed for ${preflight.label}: estimated ${preflight.formattedGas}. Open your wallet to sign.`;
  render();
}

function clearWalletDerivedState() {
  for (const key of Object.keys(walletBalances)) delete walletBalances[key];
  for (const key of Object.keys(borrowCapacities)) delete borrowCapacities[key];
  for (const key of Object.keys(withdrawCapacities)) delete withdrawCapacities[key];
  for (const key of Object.keys(repayCapacities)) delete repayCapacities[key];
  for (const key of Object.keys(accountLtvs)) delete accountLtvs[key];
  for (const key of Object.keys(marketPositions)) delete marketPositions[key];
  walletBalanceRequests.clear();
  borrowCapacityRequests.clear();
  withdrawCapacityRequests.clear();
  repayCapacityRequests.clear();
  accountLtvRequests.clear();
  marketPositionRequests.clear();
}

function setConnectedWalletAccount(account) {
  const normalized = account || '';
  if (normalized.toLowerCase() === connectedWalletAccount.toLowerCase()) return false;
  connectedWalletAccount = normalized;
  clearWalletDerivedState();
  return true;
}

async function refreshWalletConnection({ forceRender = false } = {}) {
  if (walletRefreshInFlight) return;
  walletRefreshInFlight = true;
  try {
    if (walletDisconnected || !window.ethereum) {
      const changed = setConnectedWalletAccount('');
      walletConnectionLoaded = true;
      if (changed || forceRender) render();
      return;
    }
    const account = await getConnectedWalletAccount().catch(() => '');
    const changed = setConnectedWalletAccount(account);
    walletConnectionLoaded = true;
    if (changed || forceRender) render();
  } finally {
    walletRefreshInFlight = false;
  }
}

async function connectWallet({ change = false } = {}) {
  try {
    walletDisconnected = false;
    window.sessionStorage.removeItem('curveyield.euler.walletDisconnected');
    const account = await requestWalletAccount({ forcePermission: change });
    setConnectedWalletAccount(account);
    actionNotices.wallet = '';
    render();
  } catch (error) {
    actionNotices.wallet = normalizeTransactionError(error) || 'Wallet connection failed.';
    render();
  }
}

function disconnectWallet() {
  walletDisconnected = true;
  window.sessionStorage.setItem('curveyield.euler.walletDisconnected', '1');
  resetWalletConnectionCache();
  setConnectedWalletAccount('');
  actionNotices.wallet = 'Wallet disconnected in this app.';
  render();
}

function switchActionModeOnly(pageId, group, action) {
  const fallback = group === 'debt' ? 'borrow' : 'deposit';
  if (currentActionMode(pageId, group, fallback) === action) return false;
  setActionMode(pageId, group, action);
  if (action === 'withdraw') {
    actionNotices[pageId] = 'Withdraw mode selected. Max now shows your withdrawable balance.';
  } else if (action === 'repay') {
    actionNotices[pageId] = 'Repay mode selected. Max now shows the amount you can repay.';
  } else {
    actionNotices[pageId] = '';
  }
  render();
  return true;
}

function liveVaultForAction(page, renderedVault, role) {
  if (role === 'collateral') return page?.collateralVaultAddress || renderedVault || '';
  if (role === 'debt') return page?.debtVaultAddress || page?.contractAddress || renderedVault || '';
  if (role === 'earn' || role === 'ipor') return page?.contractAddress || renderedVault || '';
  return renderedVault || page?.contractAddress || '';
}

function pageForActionId(pageId) {
  const current = currentPage();
  return current.id === pageId ? current : getPageById(pageId);
}

function invalidateWalletBalance(vaultAddress) {
  if (!vaultAddress) return;
  const key = vaultAddress.toLowerCase();
  delete walletBalances[key];
  walletBalanceRequests.delete(key);
}

function invalidateBorrowCapacity(debtVault) {
  if (!debtVault) return;
  const key = debtVault.toLowerCase();
  delete borrowCapacities[key];
  borrowCapacityRequests.delete(key);
}

function invalidateWithdrawCapacity(vaultAddress) {
  if (!vaultAddress) return;
  const key = vaultAddress.toLowerCase();
  delete withdrawCapacities[key];
  withdrawCapacityRequests.delete(key);
}

function invalidateRepayCapacity(debtVault) {
  if (!debtVault) return;
  const key = debtVault.toLowerCase();
  delete repayCapacities[key];
  repayCapacityRequests.delete(key);
}

function invalidateAccountLtv(debtVault) {
  if (!debtVault) return;
  const key = debtVault.toLowerCase();
  delete accountLtvs[key];
  delete marketPositions[key];
  accountLtvRequests.delete(key);
  marketPositionRequests.delete(key);
}

function invalidatePageBorrowCapacity(pageId) {
  const page = getPageById(pageId);
  if (page?.type !== 'market') return;
  invalidateBorrowCapacity(page.debtVaultAddress || page.contractAddress);
  invalidateAccountLtv(page.debtVaultAddress || page.contractAddress);
}

function refreshWalletBalancesForPage(page) {
  if (walletDisconnected) return;
  if (['portfolio-action', 'portfolio-position'].includes(page.type)) {
    const market = getPageById(page.marketPageId);
    refreshWalletBalancesForPage(market);
    return;
  }
  if (page.type === 'portfolio') {
    refreshPortfolioPositions();
    return;
  }
  if (!['arbitrum', 'ethereum', 'base'].includes(page.chainId)) return;
  const targets = [];
  if (page.type === 'earn' && page.contractAddress) {
    targets.push({ vault: page.contractAddress, symbol: page.asset, ownerOnly: true });
  }
  if (page.type === 'ipor-vault' && page.contractAddress) {
    targets.push({ vault: page.contractAddress, symbol: page.asset, ownerOnly: true });
  }
  if (page.type === 'market') {
    if (page.collateralVaultAddress) targets.push({ vault: page.collateralVaultAddress, symbol: page.collateral, marketDebtVault: page.debtVaultAddress || page.contractAddress || '' });
    if (page.debtVaultAddress || page.contractAddress) targets.push({ vault: page.debtVaultAddress || page.contractAddress, symbol: page.debt });
  }

  for (const target of targets) {
    const key = target.vault.toLowerCase();
    if (walletBalances[key] || walletBalanceRequests.has(key)) continue;
    walletBalanceRequests.add(key);
    fetchVaultWalletBalance({ vault: target.vault, chainId: page.chainId }).then((balance) => {
      walletBalanceRequests.delete(key);
      if (!balance) return;
      walletBalances[key] = { ...balance, symbol: target.symbol };
      render();
    }).catch(() => {
      walletBalanceRequests.delete(key);
    });
  }

  for (const target of targets) {
    const key = target.vault.toLowerCase();
    if (withdrawCapacities[key] || withdrawCapacityRequests.has(key)) continue;
    withdrawCapacityRequests.add(key);
    fetchVaultWithdrawCapacity({ vault: target.vault, marketDebtVault: target.marketDebtVault || '', chainId: page.chainId, ownerOnly: Boolean(target.ownerOnly) }).then((capacity) => {
      withdrawCapacityRequests.delete(key);
      if (!capacity) return;
      withdrawCapacities[key] = { ...capacity, symbol: target.symbol };
      render();
    }).catch(() => {
      withdrawCapacityRequests.delete(key);
    });
  }

  if (page.type === 'market') {
    const debtVault = page.debtVaultAddress || page.contractAddress;
    const key = debtVault?.toLowerCase();
    if (key && !borrowCapacities[key] && !borrowCapacityRequests.has(key)) {
      borrowCapacityRequests.add(key);
      fetchMarketBorrowCapacity({ debtVault, collateralVault: page.collateralVaultAddress, chainId: page.chainId }).then((capacity) => {
        borrowCapacityRequests.delete(key);
        if (!capacity) return;
        borrowCapacities[key] = { ...capacity, symbol: page.debt };
        render();
      }).catch(() => {
        borrowCapacityRequests.delete(key);
      });
    }
    if (key && !repayCapacities[key] && !repayCapacityRequests.has(key)) {
      repayCapacityRequests.add(key);
      fetchVaultRepayCapacity({ debtVault, collateralVault: page.collateralVaultAddress, chainId: page.chainId }).then((capacity) => {
        repayCapacityRequests.delete(key);
        if (!capacity) return;
        repayCapacities[key] = { ...capacity, symbol: page.debt };
        render();
      }).catch(() => {
        repayCapacityRequests.delete(key);
      });
    }
    if (key && page.collateralVaultAddress && !accountLtvs[key] && !accountLtvRequests.has(key)) {
      accountLtvRequests.add(key);
      fetchMarketAccountLtv({ debtVault, collateralVault: page.collateralVaultAddress, chainId: page.chainId }).then((position) => {
        accountLtvRequests.delete(key);
        if (!position) return;
        accountLtvs[key] = position;
        render();
      }).catch(() => {
        accountLtvRequests.delete(key);
      });
    }
    if (key && page.collateralVaultAddress && !marketPositions[key] && !marketPositionRequests.has(key)) {
      marketPositionRequests.add(key);
      fetchMarketPositions({ debtVault, collateralVault: page.collateralVaultAddress, chainId: page.chainId }).then((positions) => {
        marketPositionRequests.delete(key);
        marketPositions[key] = positions || [];
        render();
      }).catch(() => {
        marketPositionRequests.delete(key);
      });
    }
  }
}

function refreshPortfolioPositions() {
  if (walletDisconnected) return;
  PAGES.filter((item) => item.type === 'market').forEach((page) => {
    const debtVault = page.debtVaultAddress || page.contractAddress;
    const key = debtVault?.toLowerCase();
    if (!key || marketPositions[key] || marketPositionRequests.has(key)) return;
    marketPositionRequests.add(key);
    fetchMarketPositions({ debtVault, collateralVault: page.collateralVaultAddress, chainId: page.chainId }).then((positions) => {
      marketPositionRequests.delete(key);
      marketPositions[key] = positions || [];
      render();
    }).catch(() => {
      marketPositionRequests.delete(key);
    });
  });
}

function shortAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function explorerAddressUrl(page, address) {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return '';
  if (page.chainId === 'arbitrum') return `https://arbiscan.io/address/${address}`;
  if (page.chainId === 'base') return `https://basescan.org/address/${address}`;
  return `https://etherscan.io/address/${address}`;
}

function etherscanAddressUrl(address) {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return '';
  return `https://etherscan.io/address/${address}`;
}

function etherscanBlockUrl(block) {
  if (!block) return '';
  return `https://etherscan.io/block/${block}`;
}

function pageHref(page) {
  return `#/${page.id}`;
}

function addressLink(page, address, label = shortAddress(address)) {
  const url = explorerAddressUrl(page, address);
  if (!url) return label || 'Not available';
  return `<a class="address-link" href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
}

function riskManagerAddressFor(page) {
  return contractValue(page, 'riskManager') || '';
}

function etherscanAddressLink(address, label = shortAddress(address)) {
  const url = etherscanAddressUrl(address);
  if (!url) return label || 'Not available';
  return `<a class="address-link" href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
}

function etherscanBlockLink(block) {
  const url = etherscanBlockUrl(block);
  if (!url) return 'Not indexed';
  return `<a class="address-link" href="${url}" target="_blank" rel="noreferrer">${block}</a>`;
}

function chainExplorerBase(rowOrChainId) {
  if (typeof rowOrChainId === 'object' && rowOrChainId?.explorerBaseUrl) return rowOrChainId.explorerBaseUrl;
  const chainId = typeof rowOrChainId === 'object' ? rowOrChainId?.chainId : rowOrChainId;
  const chain = Object.values(LIQUIDATION_CHAINS).find((config) => Number(config.chainId) === Number(chainId));
  return chain?.explorerBaseUrl || 'https://etherscan.io';
}

function explorerAddressLink(row, address, label = shortAddress(address)) {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return label || 'Not available';
  return `<a class="address-link" href="${chainExplorerBase(row)}/address/${address}" target="_blank" rel="noreferrer">${label}</a>`;
}

function explorerBlockLink(row, block) {
  if (!block) return 'Not indexed';
  return `<a class="address-link" href="${chainExplorerBase(row)}/block/${block}" target="_blank" rel="noreferrer">${block}</a>`;
}

function contractAddressValue(page, key, fallback = '') {
  const value = contractValue(page, key);
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || '')) ? value : fallback;
}

function marketsForDebt(page) {
  return PAGES.filter((item) => item.type === 'market' && item.chainId === page.chainId && item.debt === page.debt);
}

function oracleAddressFor(page, side = 'pair') {
  if (side === 'collateral') return page.collateralOracleAddress || page.oracleAddress;
  if (side === 'debt') return page.debtOracleAddress || page.oracleAddress;
  return page.oracleAddress;
}

function saveSimulationState(nextState) {
  simulationState = nextState;
  window.localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(nextState));
  render();
}

function resetSimulation(pageId) {
  const positions = { ...simulationState.positions };
  delete positions[pageId];
  saveSimulationState({ ...simulationState, positions });
}

function simulatedPosition(page) {
  return simulationState.positions[page.id] || null;
}

function selectedChain() {
  return getChainById(selectedChainId);
}

function apyAssets() {
  const seen = new Map();
  for (const page of PAGES) {
    for (const symbol of [page.asset, page.collateral, page.debt].filter(Boolean)) {
      const key = `${page.chainId}:${symbol}`;
      if (!seen.has(key)) {
        seen.set(key, { symbol, chainId: page.chainId, chain: page.network });
      }
    }
  }
  return [...seen.values()];
}

function intrinsicApy(symbol) {
  return intrinsicApyFor(selectedChainId, symbol);
}

function intrinsicApySource(symbol) {
  return intrinsicApySourceFor(selectedChainId, symbol);
}

function intrinsicApyFor(chainId, symbol) {
  const key = assetApyKey({ chainId, symbol });
  return apyState.values?.[key]?.formatted || '0.00%';
}

function intrinsicApySourceFor(chainId, symbol) {
  const key = assetApyKey({ chainId, symbol });
  return apyState.sources?.[key] || apyState.values?.[key]?.source || 'configured';
}

function refreshApyOnce() {
  if (apyRefreshStarted) return;
  apyRefreshStarted = true;

  fetchAssetApys({
    assets: apyAssets(),
    cachedSources: apyState.sources,
    limitedFetch,
  }).then((fresh) => {
    const nextState = {
      updatedAt: Date.now(),
      sources: fresh.sources,
      values: {
        ...apyState.values,
        ...fresh.values,
      },
    };
    apyState = nextState;
    window.localStorage.setItem(DEFILLAMA_APY_STORAGE_KEY, JSON.stringify(nextState));
    render();
  }).catch(() => {
    actionNotices.apy = 'External APY refresh failed. Showing stored values.';
  });
}

async function refreshLiquidationRisk({ manual = false } = {}) {
  if (liquidationRiskRefreshStarted) return;
  liquidationRiskRefreshStarted = true;
  if (manual) actionNotices['arb-easy-liquidations'] = 'Refreshing Ethereum and Arbitrum liquidation risk from EVC logs...';
  render();
  try {
    const nextState = await refreshLiquidationRiskDashboard(liquidationRiskState, { scanMode: manual ? 'manual' : 'recent' });
    liquidationRiskState = nextState;
    window.localStorage.setItem(LIQUIDATION_RISK_STORAGE_KEY, JSON.stringify(nextState));
    const scanned = Object.values(LIQUIDATION_CHAINS)
      .map((chain) => `${chain.label} ${nextState.lastScannedBlocks?.[chain.chainId] || 'not scanned'}`)
      .join(', ');
    actionNotices['arb-easy-liquidations'] = `Liquidation dashboard refreshed: ${scanned}.`;
  } catch (error) {
    actionNotices['arb-easy-liquidations'] = error?.message || 'Liquidation dashboard refresh failed. Showing stored data.';
  } finally {
    liquidationRiskRefreshStarted = false;
    render();
  }
}

async function refreshLiveMetricsOnce() {
  const livePages = PAGES.filter((page) => ['arbitrum', 'ethereum', 'base'].includes(page.chainId) && page.contractAddress && ['earn', 'market', 'ipor-vault'].includes(page.type));
  const refreshRank = { market: 0, earn: 1, 'ipor-vault': 2 };
  const activePageId = currentRoute().pageId;
  livePages.sort((a, b) => {
    if (a.id === activePageId) return -1;
    if (b.id === activePageId) return 1;
    return (refreshRank[a.type] ?? 9) - (refreshRank[b.type] ?? 9);
  });
  for (const page of livePages) {
    try {
      const metrics = await fetchLivePageMetrics(page);
      if (!metrics) continue;
      mergeLiveMetrics(page.id, metrics);
      render();
    } catch {
      actionNotices[page.id] = 'Live data refresh failed. Showing configured fallback values.';
    }
  }
}

async function refreshStatsAfterBalanceChange(pageId) {
  const page = PAGES.find((item) => item.id === pageId);
  if (!page || !['arbitrum', 'ethereum', 'base'].includes(page.chainId) || !page.contractAddress || !['earn', 'market', 'ipor-vault'].includes(page.type)) return;
  try {
    const metrics = await fetchLivePageMetrics(page);
    if (metrics) mergeLiveMetrics(page.id, metrics);
  } catch {
    actionNotices[pageId] = 'Transaction confirmed. Live stats refresh failed; reload to retry the live data read.';
  }
}

function assetIcon(symbol, tone = 'blue') {
  if (!symbol) {
    return `<span class="asset-icon ${tone}">•</span>`;
  }
  const logo = TOKEN_LOGOS[symbol] || PAGES.find((item) => item.asset === symbol && item.logo)?.logo;
  if (logo) {
    return `<span class="asset-icon image-token"><img src="${logo}" alt="" /></span>`;
  }
  const letters = symbol.length > 4 ? symbol.slice(0, 2) : symbol.slice(0, 1);
  return `<span class="asset-icon ${tone}">${letters}</span>`;
}

function chainIcon(chain) {
  return `<span class="chain-logo"><img src="${chain.logo}" alt="" /></span>`;
}

function renderChainSelector(page) {
  const selected = EULER_CHAINS.find((chain) => chain.id === selectedChainId)
    || EULER_CHAINS.find((chain) => chain.id === page.chainId)
    || EULER_CHAINS[0];
  return `
    <details class="chain-select">
      <summary class="pill chain-pill">${chainIcon(selected)}<span>${selected.label}</span><span class="chevron">⌄</span></summary>
      <div class="chain-menu">
        ${EULER_CHAINS.map((chain) => `
          <button class="chain-option ${chain.id === selected.id ? 'selected' : ''}" data-chain-id="${chain.id}">
            ${chainIcon(chain)}
            <span>${chain.label}</span>
          </button>
        `).join('')}
      </div>
    </details>
  `;
}

function renderWalletControl() {
  const label = connectedWalletAccount
    ? shortAddress(connectedWalletAccount)
    : walletConnectionLoaded || walletDisconnected
    ? 'Connect wallet'
    : 'Checking wallet';
  const connected = Boolean(connectedWalletAccount);
  return `<button class="pill address" ${connected ? 'data-wallet-change' : 'data-wallet-connect'}>${label} <span>⌄</span></button>`;
}

function renderHeader(page) {
  const markets = PAGES.filter((item) => item.type === 'market');
  const earnVaults = PAGES.filter((item) => item.type === 'earn');
  const liquidatorPages = PAGES.filter((item) => item.type === 'liquidator');
  const developerPages = PAGES.filter((item) => ['market', 'earn', 'liquidator'].includes(item.type));
  const route = currentRoute();
  return `
    <header class="topbar">
      <details class="brand-menu">
        <summary class="brand" aria-label="Open app menu">
          <span class="brand-glyph"><i></i><i></i><i></i></span>
        </summary>
        <div class="market-menu brand-dropdown">
          <a class="${page.type === 'home' ? 'selected' : ''}" href="#/home">
            <span>Home</span>
            <small>CurveYield</small>
          </a>
          <a class="${page.type === 'ipor-vault' ? 'selected' : ''}" href="#/ipor-crvusd-lp-vault">
            <span>IPOR</span>
            <small>cy-crvUSD Vault</small>
          </a>
          ${productionModeEnabled ? '' : `<button class="${developerMenuEnabled ? 'selected' : ''}" data-dev-toggle>Developer Mode</button>`}
          ${developerMenuEnabled && !productionModeEnabled ? `<a class="${route.isDeveloper && page.id === 'diagnostics' ? 'selected' : ''}" href="#/dev/diagnostics">
            <span>Developer Data</span>
            <small>RPC and cache diagnostics</small>
          </a>` : ''}
        </div>
      </details>
      <nav class="main-nav" aria-label="Euler pages">
        <a class="nav-item ${['portfolio', 'portfolio-action', 'portfolio-position'].includes(page.type) ? 'active' : ''}" href="#/portfolio">
          <span class="nav-dot">◎</span>
          <span>Portfolio</span>
        </a>
        <a class="nav-item ${page.type === 'explore' ? 'active' : ''}" href="#/explore">
          <span class="nav-dot explore-dot">⌘</span>
          <span>Explore</span>
        </a>
        <details class="nav-menu">
          <summary class="nav-item ${page.type === 'earn' ? 'active' : ''}">
            <span class="nav-dot">→</span>
            <span>Earn</span>
          </summary>
          <div class="market-menu">
            ${earnVaults.map((vault) => `
              <a class="${vault.id === page.id ? 'selected' : ''}" href="#/${vault.id}">
                <span>${vault.navLabel}</span>
                <small>${vault.network}</small>
              </a>
            `).join('')}
          </div>
        </details>
        <details class="nav-menu">
          <summary class="nav-item ${page.type === 'market' ? 'active' : ''}">
            <span class="nav-dot">↑</span>
            <span>Borrow</span>
            <small>Markets</small>
          </summary>
          <div class="market-menu">
            ${markets.map((market) => `
              <a class="${market.id === page.id ? 'selected' : ''}" href="#/${market.id}">
                <span>${market.navLabel}</span>
                <small>${market.network}</small>
              </a>
            `).join('')}
          </div>
        </details>
        <details class="nav-menu">
          <summary class="nav-item ${page.type === 'liquidator' ? 'active' : ''}">
            <span class="nav-dot">!</span>
            <span>Liquidations</span>
          </summary>
          <div class="market-menu">
            ${liquidatorPages.map((liquidatorPage) => `
              <a class="${liquidatorPage.id === page.id ? 'selected' : ''}" href="#/${liquidatorPage.id}">
                <span>${liquidatorPage.network === 'Ethereum Mainnet' ? 'Ethereum' : liquidatorPage.network}</span>
                <small>${liquidatorPage.navLabel}</small>
              </a>
            `).join('')}
          </div>
        </details>
        ${developerMenuEnabled && !productionModeEnabled ? `<details class="nav-menu">
          <summary class="nav-item ${route.isDeveloper ? 'active' : ''}">
            <span class="nav-dot">⚙</span>
            <span>Dev</span>
            <small>Sim</small>
          </summary>
          <div class="market-menu">
            ${developerPages.map((item) => `
              <a class="${route.isDeveloper && item.id === page.id ? 'selected' : ''}" href="#/dev/${item.id}">
                <span>${item.navLabel}</span>
                <small>${item.network}</small>
              </a>
            `).join('')}
            <a class="${route.isDeveloper && page.id === 'diagnostics' ? 'selected' : ''}" href="#/dev/diagnostics">
              <span>Diagnostics</span>
              <small>RPC health</small>
            </a>
          </div>
        </details>` : ''}
      </nav>
      <div class="wallet-row">
        ${renderChainSelector(page)}
        ${renderWalletControl()}
      </div>
    </header>
  `;
}

function newestLiveMetricsTimestamp() {
  return Math.max(0, ...Object.values(liveMetrics).map((item) => Number(item?.updatedAt || 0)));
}

function diagnosticsRowsFor(chainId) {
  return (rpcDiagnosticsSnapshot()[chainId] || []).map((item) => `
    <tr>
      <td><span class="diag-url">${item.url}</span></td>
      <td>${item.active ? 'Active' : 'Standby'}</td>
      <td>${item.latencyMs === null ? 'No sample' : `${item.latencyMs}ms`}</td>
      <td>${item.successes}</td>
      <td>${item.failures}</td>
      <td>${item.cooldownMs ? `${Math.ceil(item.cooldownMs / 1000)}s` : 'Ready'}</td>
      <td>${item.lastError || 'None'}</td>
    </tr>
  `).join('');
}

function renderDiagnostics() {
  const walletChain = window.ethereum?.chainId || 'Wallet not connected';
  const lastSync = newestLiveMetricsTimestamp();
  return `
    <section class="liquidator-hero diagnostics-hero">
      <p>Developer diagnostics</p>
      <h1>Production Health</h1>
      <span>RPC rotation, cache freshness, and wallet network state.</span>
    </section>
    <div class="left-stack full-width-stack">
      ${renderCard('Runtime', `
        <div class="metric-grid">
          ${metric('Wallet chain', walletChain)}
          ${metric('Selected app chain', selectedChain().label)}
          ${metric('Last successful data sync', lastSync ? new Date(lastSync).toLocaleString() : 'No local sample yet')}
          ${metric('Cached page count', String(Object.keys(liveMetrics).length))}
          ${metric('Active RPC endpoint', activeRpcUrlForChain(selectedChainId))}
        </div>
      `)}
      ${renderCard('Ethereum RPC Pool', `
        <div class="table-wrap">
          <table class="risk-table diagnostics-table">
            <thead><tr><th>Endpoint</th><th>Status</th><th>Latency</th><th>OK</th><th>Failures</th><th>Cooldown</th><th>Last error</th></tr></thead>
            <tbody>${diagnosticsRowsFor('ethereum')}</tbody>
          </table>
        </div>
      `)}
      ${renderCard('Arbitrum RPC Pool', `
        <div class="table-wrap">
          <table class="risk-table diagnostics-table">
            <thead><tr><th>Endpoint</th><th>Status</th><th>Latency</th><th>OK</th><th>Failures</th><th>Cooldown</th><th>Last error</th></tr></thead>
            <tbody>${diagnosticsRowsFor('arbitrum')}</tbody>
          </table>
        </div>
      `)}
      ${renderCard('Base RPC Pool', `
        <div class="table-wrap">
          <table class="risk-table diagnostics-table">
            <thead><tr><th>Endpoint</th><th>Status</th><th>Latency</th><th>OK</th><th>Failures</th><th>Cooldown</th><th>Last error</th></tr></thead>
            <tbody>${diagnosticsRowsFor('base')}</tbody>
          </table>
        </div>
      `)}
    </div>
  `;
}

function renderPageTitle(page) {
  if (page.type === 'portfolio') {
    return `
      <div class="page-title">
        <a class="back" href="#/${DEFAULT_PAGE_ID}">‹</a>
        <div>
          <p>${page.subtitle}</p>
          <h1>${page.title}</h1>
        </div>
      </div>
    `;
  }
  if (page.type === 'earn') {
    return `
      <div class="page-title">
        <a class="back" href="#/${DEFAULT_PAGE_ID}">‹</a>
        ${assetIcon(page.asset)}
        <div>
          <p>${page.subtitle}</p>
          <h1>${page.title}</h1>
        </div>
      </div>
    `;
  }
  return `
    <div class="page-title">
      <a class="back" href="#/${DEFAULT_PAGE_ID}">‹</a>
      <span class="pair-icons">${assetIcon(page.collateral, 'gold')}${assetIcon(page.debt)}</span>
      <div>
        <p>${page.subtitle}</p>
        <h1>${page.title}</h1>
      </div>
    </div>
  `;
}

function metric(label, value, accent = false) {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong class="${accent ? 'accent' : ''}">${accent ? '✣ ' : ''}${value}</strong>
    </div>
  `;
}

function infoLabel(label, kind) {
  return `${label} <button class="info-dot" data-info-kind="${kind}" aria-label="${label} info">i</button>`;
}

function tokenDescription(token) {
  return TOKEN_DESCRIPTIONS[token] || `${token} is a configured collateral or loan asset for these CurveYield Euler markets.`;
}

function eulerFinanceLink(url) {
  if (!url) return '';
  return `<a class="overview-link" href="${url}" target="_blank" rel="noreferrer">Euler Finance Page</a>`;
}

function overviewUrlFor(page, section = 'pair') {
  if (page.type === 'earn') return page.eulerLinks?.earn;
  if (section === 'collateral') return page.eulerLinks?.collateral;
  if (section === 'debt') return page.eulerLinks?.debt;
  return page.eulerLinks?.borrow;
}

function defillamaSwapUrl(chainId, tokenAddress) {
  const chain = chainId === 'arbitrum' ? 'arbitrum' : 'ethereum';
  return `https://swap.defillama.com/?chain=${chain}&from=0x0000000000000000000000000000000000000000&tab=swap&to=${tokenAddress}`;
}

function tokenActionLinks(page, token) {
  const config = TOKEN_ACTIONS[token];
  if (!config) return '';
  const links = [];
  if (TOKEN_ACTIONS[token]?.vaultUrl) {
    const isInternalLink = config.vaultUrl.startsWith('#/');
    links.push(`<a class="overview-link" href="${config.vaultUrl}"${isInternalLink ? '' : ' target="_blank" rel="noreferrer"'}>Get Vault Token</a>`);
  }
  const underlying = config.underlyingByChain?.[page.chainId];
  if (underlying) {
    links.push(`<a class="overview-link" href="${defillamaSwapUrl(page.chainId, underlying)}" target="_blank" rel="noreferrer">Get Underlying Token</a>`);
  }
  return links.join('');
}

function overviewActions(page, section = 'pair', token = page.collateral || page.asset || page.debt) {
  if (page.type === 'market') return '';
  const tokenActions = page.type === 'market' && section === 'pair' ? '' : tokenActionLinks(page, token);
  return `${eulerFinanceLink(overviewUrlFor(page, section))}${tokenActions}`;
}

function renderCard(title, body, extraClass = '', action = '') {
  return `
    <section class="card ${extraClass}">
      <div class="card-title-row">
        <h2>${title}</h2>
        ${action ? `<div class="card-action-row">${action}</div>` : ''}
      </div>
      ${body}
    </section>
  `;
}

function renderExploreGraph(symbols) {
  return `
    <div class="explore-graph" aria-hidden="true">
      ${symbols.map((symbol, index) => `
        <span class="explore-node node-${index + 1}">${assetIcon(symbol)}</span>
      `).join('')}
    </div>
  `;
}

function renderExploreRow(page) {
  const stats = exploreItemStats(page);
  return `
    <a class="explore-row" href="${pageHref(page)}">
      <div class="explore-row-head">
        <div class="explore-row-main">
          ${page.type === 'market' ? `<span class="pair-icons explore-icons">${assetIcon(page.collateral, 'gold')}${assetIcon(page.debt)}</span>` : assetIcon(page.asset)}
          <div>
            <p>${page.subtitle}</p>
            <h2>${page.title}</h2>
            <span>${exploreItemDescription(page)}</span>
          </div>
        </div>
        <div class="explore-counts">
          <strong>${stats.assets}</strong>
          <span>${stats.pairs}</span>
          <small>${page.network}</small>
        </div>
      </div>
      <div class="explore-row-divider"></div>
      <div class="explore-row-stats">
        <div>
          <span>Total supply</span>
          <strong>${stats.totalSupply}</strong>
        </div>
        ${stats.totalBorrowed ? `
          <div>
            <span>Total borrowed</span>
            <strong>${stats.totalBorrowed}</strong>
          </div>
        ` : ''}
        <div>
          <span>Available liquidity</span>
          <strong>${stats.availableLiquidity}</strong>
        </div>
        <div>
          <span>${page.type === 'market' ? 'Best max ROE' : 'Supply APY'}</span>
          <strong class="explore-best">${stats.best}</strong>
        </div>
        ${renderExploreGraph(exploreTokens(page))}
      </div>
    </a>
  `;
}

function exploreFilteredItems() {
  const query = exploreSearchText.trim().toLowerCase();
  return PAGES.filter((item) => ['market', 'earn'].includes(item.type))
    .filter((item) => {
      if (!query) return true;
      const haystack = [
        item.title,
        item.subtitle,
        item.navLabel,
        item.network,
        item.collateral,
        item.debt,
        item.asset,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
}

function renderExplore(page) {
  const exploreItems = exploreFilteredItems();
  return `
    <section class="explore-hero">
      <div class="explore-title-icon"><span class="nav-dot explore-dot">⌘</span></div>
      <div>
        <h1>${page.title}</h1>
        <p>${page.subtitle}</p>
      </div>
    </section>
    <div class="explore-toolbar">
      <label class="explore-search">
        <span>⌕</span>
        <input placeholder="Search by asset, market, curator..." aria-label="Search by asset, market, curator" data-explore-search value="${escapeAttribute(exploreSearchText)}" />
      </label>
    </div>
    <section class="explore-list">
      ${exploreItems.length ? exploreItems.map(renderExploreRow).join('') : '<div class="explore-empty">No markets match that search.</div>'}
    </section>
  `;
}

function portfolioActivePositions() {
  return PAGES.filter((page) => page.type === 'market')
    .flatMap((page) => positionsForMarket(page).map((position, positionIndex) => {
      const collateralShares = BigInt(position.collateralShares || 0n);
      const debt = BigInt(position.debt || 0n);
      if (!(collateralShares > 0n || debt > 0n)) return null;
      return { page, position, positionIndex, collateralShares, debt };
    }))
    .filter(Boolean);
}

function renderPortfolio(page) {
  const positions = portfolioActivePositions();
  const trackedCount = PAGES.filter((item) => item.type === 'market').length;
  const hasPendingScan = PAGES.some((item) => item.type === 'market' && marketPositionRequests.has(marketPositionKey(item)));
  const totals = positions.reduce((acc, item) => {
    acc.supplied += bigintUsdToNumber(item.position.collateralValue);
    acc.borrowed += bigintUsdToNumber(item.position.debtValue);
    acc.net += bigintUsdToNumber(item.position.netAssetValue);
    return acc;
  }, { supplied: 0, borrowed: 0, net: 0 });
  const emptyCopy = hasPendingScan
    ? 'Scanning connected-wallet positions across configured CurveYield markets.'
    : 'No active borrow positions detected for the connected wallet.';
  return `
    <section class="portfolio-hero">
      <h1>Your Portfolio</h1>
      <label class="portfolio-toggle">Show all <span class="toggle-on"></span></label>
    </section>
    <div class="portfolio-summary-grid">
      <section class="portfolio-summary-card">
        <h2>Portfolio performance</h2>
        <div class="portfolio-summary-lines">
          <div><span>Open positions</span><strong>${positions.length}</strong></div>
          <div><span>Tracked markets</span><strong>${trackedCount}</strong></div>
        </div>
      </section>
      <section class="portfolio-summary-card">
        <h2>Portfolio value</h2>
        <div class="portfolio-summary-lines big">
          <div><span>Total supplied</span><strong>${formatDollarAmount(totals.supplied)}</strong></div>
          <div><span>Total borrowed</span><strong>${formatDollarAmount(totals.borrowed)}</strong></div>
          <div><span>Net asset value</span><strong>${formatDollarAmount(totals.net)}</strong></div>
        </div>
      </section>
    </div>
    <div class="portfolio-tabs">
      <button class="active">Positions <b>${positions.length}</b></button>
      <button>Deposits <b>${PAGES.filter((item) => item.type === 'earn').length}</b></button>
    </div>
    <section class="portfolio-section">
      <div class="section-heading">
        <h2>Borrow positions</h2>
        <p>Active loans backed by your supplied collateral.</p>
      </div>
      <div class="position-list">
        ${positions.length ? positions.map(({ page: market, position, positionIndex }, index) => `
          <a class="position-card" href="#/portfolio-position-${market.id}-${positionIndex}">
            <div class="position-row-top">
              <div>
                <span class="position-chip">Position ${index}</span>
                <div class="position-title-line">
                  <span class="position-icons">${assetIcon(market.collateral, 'gold')}${assetIcon(market.debt)}</span>
                  <span><small>${market.network}</small><strong>${market.title}</strong></span>
                </div>
              </div>
              <div class="position-apy">
                <span>Borrow APY</span><span>Health</span>
                <strong class="accent">${contractValue(market, 'borrowApy')}</strong><strong>${position.healthScore || '---'}</strong>
              </div>
            </div>
            <div class="position-row-body">
              <span>Net asset value</span><strong>${position.netAssetValueFormatted || '$0.00'}</strong>
              <span>My Debt</span><strong>${position.debtValueFormatted || '$0.00'} ~ ${position.debtFormatted || '0.0000'} ${market.debt}</strong>
              <span>Collateral value</span><strong>${position.collateralValueFormatted || '$0.00'} ~ ${position.collateralFormatted || '0.0000'} ${market.collateral}</strong>
              <span>Health score</span><strong>${position.healthScore || '---'}</strong>
              <span>Your LTV</span><strong class="ltv-inline"><span class="mini-ltv-bar"><i style="width:${position.ltvProgress || '0'}%"></i></span>${position.ltvPair || position.ltv || '0.00%'}</strong>
            </div>
          </a>
        `).join('') : `<div class="empty-state">${emptyCopy}<br/>Tracked markets: ${trackedCount}</div>`}
      </div>
    </section>
  `;
}

function renderPortfolioPosition(page) {
  const market = getPageById(page.marketPageId);
  const position = selectedPositionForMarket(market, page.positionIndex) || selectedPositionForMarket(market, 0);
  const ltvPair = position?.ltvPair || '0.00/0%';
  const health = position?.healthScore || '---';
  const debtPrice = position?.debtPriceFormatted || position?.debtOraclePriceFormatted || '$0.00';
  const collateralPrice = position?.collateralPriceFormatted || position?.collateralOraclePriceFormatted || '$0.00';
  const collateralOraclePrice = position?.collateralOraclePriceFormatted || collateralPrice;
  const debtOraclePrice = position?.debtOraclePriceFormatted || debtPrice;
  const liquidationPrice = position?.liquidationPriceFormatted || '$0.00';
  return `
    <div class="position-detail-page">
      <div class="position-detail-title">
        <a class="back" href="#/portfolio" data-back-button>&lsaquo;</a>
        <div>
          <h1>Position ${page.positionIndex}</h1>
          <div class="position-detail-asset">
            <span class="position-icons large">${assetIcon(market.collateral, 'gold')}${assetIcon(market.debt)}</span>
            <div><small>${market.network}</small><h2>${market.title}</h2></div>
          </div>
        </div>
      </div>
      <div class="position-detail-summary">
        <section class="portfolio-summary-card">
          <h2>Position summary</h2>
          <div class="portfolio-summary-lines big">
            <div><span>Borrow APY</span><strong class="accent">${contractValue(market, 'borrowApy')}</strong></div>
            <div><span>Current debt</span><strong>${position?.debtValueFormatted || '$0.00'}</strong></div>
            <div><span>Net asset value</span><strong>${position?.netAssetValueFormatted || '$0.00'}</strong></div>
          </div>
        </section>
        <section class="portfolio-summary-card">
          <h2>Position risk</h2>
          <div class="portfolio-summary-lines big">
            <div><span>Health score</span><strong>${health}</strong></div>
            <div><span>Current LTV</span><strong>${position?.ltv || '0.00%'}</strong></div>
            <div><span>Liquidation LTV</span><strong>${ltvPair}</strong></div>
          </div>
          <span class="detail-ltv-bar"><i style="width:${position?.ltvProgress || '0'}%"></i></span>
        </section>
      </div>
      <h2 class="position-section-title">Borrow</h2>
      <section class="position-asset-panel">
        <div class="position-panel-head">
          <div class="position-title-line">${assetIcon(market.debt)}<span><small>Debt token</small><strong>${market.debt}</strong></span></div>
          <div><span>Borrow APY</span><strong class="accent">${contractValue(market, 'borrowApy')}</strong></div>
        </div>
        <div class="position-panel-lines">
          <span>Market value</span><strong>${position?.debtValueFormatted || '$0.00'} ~ ${position?.debtFormatted || '0.0000'} ${market.debt}</strong>
          <span>Current price</span><strong>${debtPrice}</strong>
          <span>Oracle price</span><strong>${debtOraclePrice}</strong>
          <span>Borrow remaining</span><strong>${position?.borrowCapacityFormatted || '0.0000'} ${market.debt}</strong>
        </div>
        <div class="position-detail-actions four">
          <a href="#/portfolio-borrow-${market.id}-${page.positionIndex}">Borrow</a>
          <a href="#/portfolio-repay-${market.id}-${page.positionIndex}">Repay</a>
          <span class="disabled-action">Multiply</span>
          <span class="disabled-action">Convert debt</span>
        </div>
      </section>
      <h2 class="position-section-title">Collateral</h2>
      <section class="position-asset-panel">
        <div class="position-panel-head">
          <div class="position-title-line">${assetIcon(market.collateral, 'gold')}<span><small>Collateral token</small><strong>${market.collateral}</strong></span></div>
          <div><span>Supply APY</span><strong class="accent">${currentSupplyApyTotal(market)}</strong></div>
        </div>
        <div class="position-panel-lines">
          <span>Market value</span><strong>${position?.collateralValueFormatted || '$0.00'} ~ ${position?.collateralFormatted || '0.0000'} ${market.collateral}</strong>
          <span>Current price</span><strong>${collateralPrice}</strong>
          <span>Oracle price</span><strong>${collateralOraclePrice}</strong>
          <span>Liq. price</span><strong>${liquidationPrice}</strong>
          <span>Liquidation LTV</span><strong>${position?.liquidationLtv || contractValue(market, 'liquidationLtv')}</strong>
        </div>
        <div class="position-detail-actions three">
          <a href="#/portfolio-supply-${market.id}-${page.positionIndex}">Supply</a>
          <a href="#/portfolio-withdraw-${market.id}-${page.positionIndex}">Withdraw</a>
          <span class="disabled-action">Convert collateral</span>
        </div>
      </section>
      <button class="position-info-button">Position information</button>
    </div>
  `;
}

function renderPortfolioAction(page) {
  const market = getPageById(page.marketPageId);
  const debtVault = market.debtVaultAddress || market.contractAddress || '';
  const collateralVault = market.collateralVaultAddress || '';
  const position = selectedPositionForMarket(market, page.positionIndex || 0) || accountLtvs[debtVault.toLowerCase()];
  const action = page.portfolioAction;
  const fieldName = `portfolio-${action}-amount`;
  const amountSymbol = ['withdraw', 'supply'].includes(action) ? market.collateral : market.debt;
  const title = action === 'borrow' ? `Borrow more ${market.debt}` : action === 'repay' ? `Repay ${market.debt}` : action === 'supply' ? `Supply ${market.collateral}` : `Withdraw ${market.collateral}`;
  const positionAccount = position?.account || '';
  const button = action === 'borrow'
    ? `<button class="accept" data-live-borrow-more="${page.id}" data-live-debt-vault="${debtVault}" data-live-collateral-vault="${collateralVault}" data-live-account="${positionAccount}" data-live-field-name="${fieldName}">Borrow more</button>`
    : action === 'repay'
    ? `<button class="accept" data-live-repay="${page.id}" data-live-debt-vault="${debtVault}" data-live-collateral-vault="${collateralVault}" data-live-account="${positionAccount}" data-live-field-name="${fieldName}">Repay</button>`
    : action === 'supply'
    ? `<button class="accept" data-live-deposit="${page.id}" data-live-role="collateral" data-live-vault="${collateralVault}" data-live-debt-vault="${debtVault}" data-live-account="${positionAccount}" data-live-field-name="${fieldName}">Supply collateral</button>`
    : `<button class="accept" data-live-withdraw="${page.id}" data-live-role="collateral" data-live-vault="${collateralVault}" data-live-debt-vault="${debtVault}" data-live-account="${positionAccount}" data-live-field-name="${fieldName}">Withdraw collateral</button>`;
  const maxButton = action === 'withdraw'
    ? `<button class="max-link" type="button" data-fill-max="${fieldName}" data-fill-value="${cleanAmountInput(position?.withdrawCapacityFormatted || '')}"><b>Max</b></button>`
    : action === 'repay'
    ? `<button class="max-link" type="button" data-fill-max="${fieldName}" data-fill-value="${cleanAmountInput(positionRepayMax(position, debtVault))}"><b>Max</b></button>`
    : action === 'supply'
    ? `<button class="max-link" type="button" data-fill-max="${fieldName}" data-fill-vault="${collateralVault}"><b>Max</b></button>`
    : `<button class="max-link" type="button" data-fill-max="${fieldName}" data-fill-value="${cleanAmountInput(position?.borrowCapacityFormatted || '')}"><b>Max</b></button>`;
  return `
    <div class="position-detail-title action-detail-title">
      <a class="back" href="#/portfolio-position-${market.id}-${page.positionIndex || 0}" data-back-button>&lsaquo;</a>
      <div>
        <h1>${title}</h1>
        <div class="position-detail-asset">
          <span class="position-icons large">${assetIcon(market.collateral, 'gold')}${assetIcon(market.debt)}</span>
          <div><small>${market.network}</small><h2>${market.title}</h2></div>
        </div>
      </div>
    </div>
    <div class="page-grid market-layout">
      <div class="left-stack">
        ${renderCard('Position summary', `
          <div class="metric-grid">
            ${metric('Market', market.title)}
            ${metric('Euler account', positionAccount ? shortAddress(positionAccount) : 'Connect wallet')}
            ${metric('Supplied collateral', `${position?.collateralFormatted || '0.0000'} ${market.collateral}`)}
            ${metric('Current debt', `${position?.debtFormatted || '0.0000'} ${market.debt}`)}
            ${metric('Current LTV', position?.ltv || '0.00%')}
            ${metric('Max LTV', position?.borrowLtv || contractValue(market, 'maxLtv'))}
            ${metric('Liquidation LTV', position?.liquidationLtv || contractValue(market, 'liquidationLtv'))}
            ${metric('Borrow remaining', `${position?.borrowCapacityFormatted || '0.0000'} ${market.debt}`)}
            ${metric('Withdraw remaining', `${position?.withdrawCapacityFormatted || '0.0000'} ${market.collateral}`)}
          </div>
        `)}
        ${renderCard(['withdraw', 'supply'].includes(action) ? 'Collateral' : 'Borrow', `
          <div class="metric-grid">
            ${metric('Wallet collateral token', walletBalanceFor(collateralVault, market.collateral))}
            ${metric('Wallet debt token', walletBalanceFor(debtVault, market.debt))}
            ${metric('Collateral vault', addressLink(market, collateralVault))}
            ${metric('Debt vault', addressLink(market, debtVault))}
            ${metric('Action source', action === 'withdraw' ? 'Euler EVC withdraw batch' : action === 'repay' ? 'Euler repay' : action === 'supply' ? 'Euler EVC collateral deposit' : 'Euler borrow-more batch')}
          </div>
        `)}
      </div>
      <aside class="action-panel">
        <div class="field-card">
          <div class="field-top"><span>${title}</span><span>${market.title}</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-live-field="${fieldName}" inputmode="decimal" placeholder="0.00" value="${fieldDrafts[`${page.id}:${fieldName}`] || ''}" />
            <span>${assetIcon(amountSymbol, ['withdraw', 'supply'].includes(action) ? 'gold' : 'blue')}${amountSymbol}</span>
          </div>
          <div class="field-bottom"><span>$0</span>${maxButton}</div>
        </div>
        <div class="tx-row single-action-row">${button}</div>
        ${actionNotices[page.id] ? `<div class="action-notice">${actionNotices[page.id]}</div>` : ''}
      </aside>
    </div>
  `;
}
function currentSupplyApyTotal(page) {
  if (page.type === 'market') {
    return combinedSupplyApy(contractValue(page, 'supplyApy'), intrinsicApyFor(page.chainId, page.collateral));
  }
  const lending = contractValue(page, 'supplyApy');
  return lending === 'N/A' ? '0.00%' : lending;
}

function earnAllocationFor(page, row) {
  const allocations = liveMetrics[page.id]?.earnAllocations || [];
  return allocations.find((allocation) => (
    row.pageId && allocation.pageId === row.pageId
  ) || (
    row.debtVaultAddress && allocation.debtVaultAddress?.toLowerCase() === row.debtVaultAddress.toLowerCase()
  )) || null;
}

function earnSupplyApyFromAllocations(page) {
  if (page.type !== 'earn') return 'N/A';
  const allocations = liveMetrics[page.id]?.earnAllocations || [];
  if (!allocations.length) return 'N/A';
  const rows = allocations.map((allocation) => {
    const market = allocation.pageId ? getPageById(allocation.pageId) : null;
    return {
      allocationAssetsRaw: allocation.allocationAssetsRaw,
      supplyApy: allocation.supplyApy || (market ? contractValue(market, 'debtSupplyApy') : 'N/A'),
    };
  });
  return calculateWeightedEarnSupplyApy(rows, liveMetrics[page.id]?.totalAssetsRaw || 0);
}

function activeSupplyApyParts(page) {
  const subview = currentRoute().subview;
  if (page.type === 'market' && subview === 'debt') {
    const intrinsic = intrinsicApyFor(page.chainId, page.debt);
    const lending = contractValue(page, 'debtSupplyApy') || '0.00%';
    return {
      suppliedAsset: page.debt,
      intrinsic,
      intrinsicSource: intrinsicApySourceFor(page.chainId, page.debt),
      lending,
      total: combinedSupplyApy(lending, intrinsic),
    };
  }

  const suppliedAsset = page.type === 'market' ? page.collateral : page.asset;
  const intrinsic = intrinsicApyFor(page.chainId, suppliedAsset);
  const lending = contractValue(page, 'supplyApy') || '0.00%';
  if (page.type === 'earn') {
    return {
      suppliedAsset,
      intrinsic: '0.00%',
      intrinsicSource: 'Earn allocation only',
      lending,
      total: lending,
    };
  }
  return {
    suppliedAsset,
    intrinsic,
    intrinsicSource: intrinsicApySourceFor(page.chainId, suppliedAsset),
    lending,
    total: combinedSupplyApy(lending, intrinsic),
  };
}

function displayNetApy(page) {
  if (page.type !== 'market') return contractValue(page, 'netApy');
  return netApyFromSupplyAndBorrow(currentSupplyApyTotal(page), contractValue(page, 'borrowApy'));
}

function displayMaxMultiplier(page) {
  const maxLtv = parseMetricNumber(contractValue(page, 'maxLtv'));
  if (maxLtv === null || maxLtv <= 0 || maxLtv >= 100) return '1.00x';
  return `${(100 / (100 - maxLtv)).toFixed(2)}x`;
}

function displayMaxRoe(page) {
  if (page.type !== 'market') return contractValue(page, 'maxRoe');
  const multiplierNumber = parseMetricNumber(displayMaxMultiplier(page));
  if (multiplierNumber === null || multiplierNumber <= 0) return '0.00%';
  const calculated = maxRoeFromSupplyBorrowAndMultiplier(
    currentSupplyApyTotal(page),
    contractValue(page, 'borrowApy'),
    displayMaxMultiplier(page),
  );
  const number = parseMetricNumber(calculated);
  if (isUnresolvedDisplayValue(calculated) || number === null) return '0.00%';
  return calculated;
}

function renderIrmChart(page) {
  const baseRate = contractValue(page, 'irmBaseRate');
  const rateAtKink = contractValue(page, 'irmRateAtKink');
  const maxRate = contractValue(page, 'irmMaxRate');
  const kink = contractValue(page, 'irmKink');
  const utilization = parseMetricNumber(contractValue(page, 'utilization')) ?? 0;
  const width = 420;
  const height = 220;
  const padding = 24;
  const points = kinkIrmChartPoints({ baseRate, rateAtKink, maxRate, kink, width, height, padding });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const currentApy = irmBorrowApyAtUtilization({ utilization, baseRate, rateAtKink, maxRate, kink });
  const currentX = padding + (Math.min(100, Math.max(0, utilization)) / 100) * (width - padding * 2);
  const kinkX = padding + ((parseMetricNumber(kink) ?? 0) / 100) * (width - padding * 2);
  return `
    <div class="irm-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Interest rate model chart">
        <line class="irm-axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
        <line class="irm-axis" x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"></line>
        <path class="irm-area" d="${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z"></path>
        <path class="irm-line" d="${path}"></path>
        <line class="irm-marker kink-marker" x1="${kinkX.toFixed(2)}" y1="${padding}" x2="${kinkX.toFixed(2)}" y2="${height - padding}"></line>
        <line class="irm-marker current-marker" x1="${currentX.toFixed(2)}" y1="${padding}" x2="${currentX.toFixed(2)}" y2="${height - padding}"></line>
      </svg>
      <div class="irm-chart-labels">
        <span>Current ${contractValue(page, 'utilization')}</span>
        <span>Kink ${kink}</span>
        <span>Curve ${currentApy.toFixed(2)}%</span>
      </div>
    </div>
  `;
}

function parseMetricNumber(value) {
  const cleaned = String(value || '').replace(/[$,%\sx,]/gi, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function formatDollarAmount(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '$0';
  const absolute = Math.abs(number);
  if (absolute >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `$${(number / 1_000).toFixed(2)}K`;
  return `$${number.toFixed(2)}`;
}

function dollarDisplay(value) {
  const text = String(value ?? '').trim();
  if (!text || isUnresolvedDisplayValue(text)) return '$0.00';
  return text.startsWith('$') ? text : `$${text}`;
}

function formatPercentNumber(value) {
  if (!Number.isFinite(value)) return '0.00%';
  return `${value.toFixed(2)}%`;
}

function tokenUnitsToDollarMetric(units, price = '1', fallback = '$0') {
  const amount = parseMetricNumber(units);
  if (amount === null) return fallback;
  const unitPrice = parseMetricNumber(price) ?? 1;
  return formatDollarAmount(amount * unitPrice);
}

function exposureRowAllocation(page, row) {
  if (!row.pageId) return row.allocation;
  const allocation = earnAllocationFor(page, row);
  if (allocation?.allocationValue) return allocation.allocationValue;
  if (allocation?.allocation) return tokenUnitsToDollarMetric(allocation.allocation, '1', row.allocation);
  return '$0.00';
}

function exposureRowCap(page, row) {
  if (!row.pageId) return row.cap;
  const allocation = earnAllocationFor(page, row);
  if (allocation?.cap) return tokenUnitsToDollarMetric(allocation.cap, contractValue(page, 'price'), '$0.00');
  const market = getPageById(row.pageId);
  const cap = market ? contractValue(market, 'supplyCap') : row.cap;
  if (!cap || isUnresolvedDisplayValue(cap)) return 'Not configured';
  if (cap === 'Not configured' || !Number.isFinite(parseMetricNumber(cap))) return cap;
  return tokenUnitsToDollarMetric(cap, contractValue(page, 'price'), '$0.00');
}

function exposureRowApy(page, row) {
  if (!row.pageId) return isUnresolvedDisplayValue(row.apy) ? '0.00%' : row.apy;
  const market = getPageById(row.pageId);
  if (!market) return '0.00%';
  const allocation = earnAllocationFor(page, row);
  const liveBorrowApy = allocation?.borrowApy || contractValue(market, 'borrowApy');
  return isUnresolvedDisplayValue(liveBorrowApy) ? '0.00%' : liveBorrowApy;
}

function pageTokenValueMetric(page, key, price = contractValue(page, 'price'), fallback = '$0') {
  return tokenUnitsToDollarMetric(contractValue(page, key), price, fallback);
}

function exploreItemDescription(page) {
  if (page.type === 'market') {
    return `A market for supplying ${page.collateral} collateral and borrowing ${page.debt}. Curated by ${page.subtitle}.`;
  }
  return `A deposit vault for supplying ${page.asset} and earning yield through configured CurveYield markets.`;
}

function exploreItemStats(page) {
  if (page.type === 'market') {
    const debtPrice = contractValue(page, 'debtPrice') || '$1.00';
    const collateralPrice = contractValue(page, 'collateralPrice') || contractValue(page, 'price');
    return {
      totalSupply: tokenUnitsToDollarMetric(contractValue(page, 'totalSupply'), collateralPrice, '$0'),
      totalBorrowed: tokenUnitsToDollarMetric(contractValue(page, 'totalBorrows'), debtPrice, '$0'),
      availableLiquidity: tokenUnitsToDollarMetric(contractValue(page, 'availableLiquidity'), debtPrice, '$0'),
      best: `${displayMaxRoe(page)} ${page.title}`,
      assets: '2 assets',
      pairs: '1 pair',
    };
  }
  return {
    totalSupply: tokenUnitsToDollarMetric(contractValue(page, 'totalSupply'), contractValue(page, 'price'), '$0'),
    totalBorrowed: '',
    availableLiquidity: tokenUnitsToDollarMetric(contractValue(page, 'availableLiquidity'), contractValue(page, 'price'), '$0'),
    best: currentSupplyApyTotal(page),
    assets: '1 asset',
    pairs: `${page.exposures?.length || 0} markets`,
  };
}

function exploreTokens(page) {
  if (page.type === 'market') return [page.collateral, page.debt];
  return [page.asset, ...(page.exposures || []).map((row) => row.caption || row.asset)].filter(Boolean).slice(0, 5);
}

function marketPositionKey(page) {
  return (page?.debtVaultAddress || page?.contractAddress || '').toLowerCase();
}

function positionsForMarket(page) {
  const key = marketPositionKey(page);
  const list = key ? marketPositions[key] : null;
  if (Array.isArray(list) && list.length) return list;
  const single = key ? accountLtvs[key] : null;
  return single ? [single] : [];
}

function selectedPositionForMarket(page, index = 0) {
  return positionsForMarket(page)[index] || null;
}

function bigintUsdToNumber(value) {
  return Number(String(value || 0n)) / 1e18;
}

function signedPercent(value, sign = '+') {
  const clean = String(value || '0.00%');
  if (clean.startsWith('-')) return clean;
  return `${sign} ${clean}`;
}

function renderInfoModal(page) {
  if (!activeInfo) return '';
  const { suppliedAsset, intrinsic, intrinsicSource, lending, total } = activeSupplyApyParts(page);
  const borrow = contractValue(page, 'borrowApy') || '0.00%';
  const rewards = page.borrowRewardsApy || '0.00%';
  const totalBorrow = borrow;
  const maxMultiplier = displayMaxMultiplier(page);
  const maxLtv = contractValue(page, 'maxLtv');
  const simple = {
    'max-ltv': ['Max LTV', 'Maximum loan-to-value configured for opening or maintaining a borrow position.', contractValue(page, 'maxLtv')],
    'liquidation-ltv': ['Liquidation LTV', 'Loan-to-value where the position can become eligible for liquidation.', contractValue(page, 'liquidationLtv')],
    'intrinsic-apy': ['Intrinsic APY', 'Yield intrinsic to the supplied asset, such as staking yield or external rewards.', intrinsic],
  }[activeInfo];

  return `
    <div class="info-backdrop" data-close-info>
      <section class="info-modal" role="dialog" aria-modal="true" aria-label="APY details" data-stop-close>
        <button class="info-close" data-close-info aria-label="Close">x</button>
        ${activeInfo === 'supply-apy' ? `
          <h2>Supply APY</h2>
          <div class="info-row">
            <div>
              <h3>Lending APY</h3>
              <p>Yield from lending on Euler</p>
            </div>
            <strong>${lending}</strong>
          </div>
          <div class="info-row">
            <div>
              <h3>Intrinsic APY (${suppliedAsset} via ${intrinsicSource})</h3>
              <p>Yield intrinsic to the supplied asset, such as staking yield or external rewards, might be compounded with lending yield</p>
              <a href="https://defillama.com/yields" target="_blank" rel="noreferrer">Source</a>
            </div>
            <strong>${intrinsic}</strong>
          </div>
          <div class="info-divider"></div>
          <div class="info-total">
            <span>Total supply APY</span>
            <strong>${total}</strong>
          </div>
        ` : activeInfo === 'borrow-apy' ? `
          <h2>Borrow APY</h2>
          <div class="info-row">
            <div>
              <h3>Borrowing APY</h3>
              <p>Cost of borrowing on Euler</p>
            </div>
            <strong>${borrow}</strong>
          </div>
          <div class="info-row">
            <div>
              <h3>Rewards APY</h3>
              <p>Yield from token rewards</p>
            </div>
            <strong>- ${rewards}</strong>
          </div>
          <div class="info-row reward-row">
            <div>
              <h3>Reward token</h3>
              <p>No active reward source configured for this market.</p>
            </div>
            <strong>${rewards}</strong>
          </div>
          <div class="info-divider"></div>
          <div class="info-total">
            <span>Total borrow APY</span>
            <strong>${totalBorrow}</strong>
          </div>
        ` : activeInfo === 'net-apy' ? `
          <h2>Net APY</h2>
          <p class="info-copy">Net APY estimates the annualized return on your supplied collateral after accounting for borrowing costs and any reward incentives. A positive net APY means the combined yield exceeds the cost of borrowing. A negative net APY means borrowing costs outweigh the yield.</p>
          <div class="info-row"><div><h3>Supply APY</h3><p>Yield from lending collateral on Euler</p></div><strong>${signedPercent(lending)}</strong></div>
          <div class="info-row"><div><h3>Intrinsic supply APY</h3><p>Yield intrinsic to the collateral asset</p></div><strong>${signedPercent(intrinsic)}</strong></div>
          <div class="info-row"><div><h3>Borrow APY</h3><p>Cost of borrowing on Euler</p></div><strong>${signedPercent(borrow, '-')}</strong></div>
          <div class="info-row"><div><h3>Borrow rewards APY</h3><p>No active reward source configured for this market.</p></div><strong>${rewards}</strong></div>
          <div class="info-divider"></div>
          <div class="info-total"><span>Net APY</span><strong>${displayNetApy(page)}</strong></div>
        ` : activeInfo === 'max-roe' ? `
          <h2>Max ROE</h2>
          <p class="info-copy">ROE (Return on Equity) estimates the annualized return on your own capital in a multiplied position. A positive ROE means the supply yield exceeds borrowing costs at the given multiplier. A negative ROE means the position is gradually losing value to interest costs.</p>
          <div class="info-row"><div><h3>Max LTV</h3><p>Maximum loan-to-value ratio</p></div><strong>${maxLtv}</strong></div>
          <div class="info-row"><div><h3>Max multiplier</h3><p>Max multiplier at max LTV</p></div><strong>${maxMultiplier}</strong></div>
          <div class="info-row"><div><h3>Supply APY</h3><p>Collateral yield (S)</p></div><strong>${total}</strong></div>
          <div class="info-row"><div><h3>Borrow APY</h3><p>Borrowing cost (B)</p></div><strong>${borrow}</strong></div>
          <div class="info-row"><div><h3>Borrow rewards APY</h3><p>No active reward source configured for this market.</p></div><strong>${rewards}</strong></div>
          <div class="info-divider"></div>
          <div class="info-total"><span>Max ROE</span><strong>${displayMaxRoe(page)}</strong></div>
        ` : `
          <h2>${simple?.[0] || 'Market Info'}</h2>
          <div class="info-row">
            <div>
              <h3>${simple?.[0] || 'Value'}</h3>
              <p>${simple?.[1] || 'Current market value from the configured data source.'}</p>
            </div>
            <strong>${simple?.[2] || '0.00%'}</strong>
          </div>
        `}
      </section>
    </div>
  `;
}

function marketSubviewHref(page, subview) {
  const route = currentRoute();
  return `#/${route.isDeveloper ? 'dev/' : ''}${page.id}${subview === 'pair' ? '' : `/${subview}`}`;
}

function renderMarketTabs(page, subview) {
  return `
    <div class="tabs pair-tabs">
      <a class="${subview === 'pair' ? 'active' : ''}" href="${marketSubviewHref(page, 'pair')}">
        ${assetIcon(page.collateral, 'gold')}${assetIcon(page.debt)}<span>Pair details</span>
      </a>
      <a class="${subview === 'collateral' ? 'active' : ''}" href="${marketSubviewHref(page, 'collateral')}">
        ${assetIcon(page.collateral, 'gold')}<span>${page.collateral}</span>
      </a>
      <a class="${subview === 'debt' ? 'active' : ''}" href="${marketSubviewHref(page, 'debt')}">
        ${assetIcon(page.debt)}<span>${page.debt}</span>
      </a>
    </div>
  `;
}

function renderChainWarning(page) {
  if (page.chainId === 'global' || ['explore', 'home', 'portfolio', 'ipor-vault'].includes(page.type)) return '';
  const switchNotice = walletNetworkNotices[page.id];
  if (switchNotice) {
    return `
      <div class="chain-warning">
        ${switchNotice}
      </div>
    `;
  }
  if (page.chainId === selectedChainId) return '';
  return `
    <div class="chain-warning">
      This page is on ${page.network}. Your selector is set to ${selectedChain().label}.
    </div>
  `;
}

async function ensurePageWalletNetwork(page) {
  if (walletDisconnected || !window.ethereum || ['explore', 'home', 'ipor-vault'].includes(page.type) || !['ethereum', 'arbitrum', 'base'].includes(page.chainId)) return;
  if (walletNetworkSwitchRequests.has(page.id)) return;
  walletNetworkSwitchRequests.add(page.id);
  let shouldRender = false;
  try {
    const walletChainHex = await getWalletChainHex();
    if (String(walletChainHex).toLowerCase() === walletChainHexFor(page.chainId).toLowerCase()) {
      shouldRender = Boolean(walletNetworkNotices[page.id]) || selectedChainId !== page.chainId;
      delete walletNetworkNotices[page.id];
      selectedChainId = page.chainId;
      window.sessionStorage.setItem('curveyield.euler.selectedChain', selectedChainId);
      return;
    }
    await switchWalletNetwork(page.chainId);
    shouldRender = true;
    delete walletNetworkNotices[page.id];
    selectedChainId = page.chainId;
    window.sessionStorage.setItem('curveyield.euler.selectedChain', selectedChainId);
  } catch (error) {
    shouldRender = true;
    walletNetworkNotices[page.id] = `Unable to switch wallet network automatically. Please change your wallet to ${page.network}.`;
  } finally {
    walletNetworkSwitchRequests.delete(page.id);
    if (shouldRender) render();
  }
}

function renderMarket(page) {
  const notice = actionNotices[page.id] || '';
  const subview = currentRoute().subview;
  const collateralIntrinsicApy = intrinsicApyFor(page.chainId, page.collateral);
  const totalSupplyApy = combinedSupplyApy(contractValue(page, 'supplyApy'), collateralIntrinsicApy);
  const debtVaultKey = (page.debtVaultAddress || page.contractAddress || '').toLowerCase();
  const positionLtv = selectedPositionForMarket(page, 0) || accountLtvs[debtVaultKey];

  if (subview === 'collateral') {
    return renderMarketTokenSubview(page, 'collateral', notice);
  }

  if (subview === 'debt') {
    return renderMarketTokenSubview(page, 'debt', notice);
  }

  return `
    ${renderPageTitle(page)}
    <div class="page-grid market-layout">
      <div class="left-stack">
        ${renderMarketTabs(page, 'pair')}
        ${renderCard('Overview', `
          <div class="metric-grid">
            ${metric('Price', `${contractValue(page, 'price')} ${page.title} ↔`)}
            ${metric('Max multiplier', displayMaxMultiplier(page))}
            ${metric(infoLabel('Supply APY', 'supply-apy'), totalSupplyApy)}
            ${metric(infoLabel('Borrow APY', 'borrow-apy'), contractValue(page, 'borrowApy'), true)}
            ${metric(infoLabel('Net APY', 'net-apy'), displayNetApy(page), true)}
            ${metric(infoLabel('Max ROE', 'max-roe'), displayMaxRoe(page), true)}
            ${metric(infoLabel('Max LTV', 'max-ltv'), contractValue(page, 'maxLtv'))}
            ${metric(infoLabel('Liquidation LTV', 'liquidation-ltv'), contractValue(page, 'liquidationLtv'))}
          </div>
        `, '', overviewActions(page, 'pair', page.collateral))}
        ${renderCard('Oracles', `
          <div class="oracle-box">
            <div class="oracle-head">
              <strong>${page.title}</strong>
              ${addressLink(page, page.oracleAddress || page.routerAddress)}
            </div>
            <div class="oracle-grid">
              ${metric('Provider', 'ERC4626Vault')}
              ${metric('Methodology', 'Exchange Rate')}
              ${metric('Checks', 'Live')}
              ${metric('Price', contractValue(page, 'price'))}
            </div>
          </div>
        `)}
      </div>
      <aside class="action-panel">
        <div class="tabs action-tabs">
          <button class="active">Borrow</button>
          <button class="disabled-action-tab" disabled>Multiply</button>
        </div>
        <div class="field-card">
          <div class="field-top"><span>Supply ${page.collateral}</span><span>${page.subtitle}</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-live-field="collateral-amount" inputmode="decimal" placeholder="0.00" value="${fieldDrafts[`${page.id}:collateral-amount`] || ''}" />
            <span>${assetIcon(page.collateral, 'gold')}${page.collateral}</span>
          </div>
          <div class="field-bottom"><span>$0</span>${supplyMaxButton(page, 'collateral-amount', page.collateralVaultAddress || page.contractAddress || '', page.collateral)}</div>
        </div>
        ${renderEulerLtvModule(page, positionLtv)}
        <div class="field-card">
          <div class="field-top"><span>Borrow ${page.debt}</span><span>${page.subtitle}</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-live-field="borrow-amount" inputmode="decimal" placeholder="0.00" value="${fieldDrafts[`${page.id}:borrow-amount`] || ''}" />
            <span>${assetIcon(page.debt)}${page.debt}</span>
          </div>
          <div class="field-bottom"><span>$0</span>${debtMaxButton(page, 'borrow-amount', page.debtVaultAddress || page.contractAddress || '', page.debt)}</div>
        </div>
        <div class="tx-row debt-tx-row">
          <button class="${actionButtonClass(page.id, 'debt', 'borrow', 'borrow')}" data-live-borrow="${page.id}" data-live-debt-vault="${page.debtVaultAddress || page.contractAddress || ''}" data-live-collateral-vault="${page.collateralVaultAddress || ''}" data-live-field-name="borrow-amount">Borrow</button>
        </div>
        ${renderPositionSafetyPanel(page, positionLtv)}
        ${notice ? `<div class="action-notice">${notice}</div>` : ''}
      </aside>
    </div>
  `;
}

function renderEarn(page) {
  const notice = actionNotices[page.id] || '';
  const assetAddress = contractAddressValue(page, 'assetAddress', page.tokenAddress || page.underlyingAddress || '');
  const feeReceiver = contractAddressValue(page, 'feeReceiver', '');
  const totalSupplyApy = currentSupplyApyTotal(page);
  return `
    ${renderPageTitle(page)}
    <div class="page-grid earn-layout">
      <div class="left-stack">
        ${renderCard('Overview', `
          <div class="metric-grid">
            ${metric('Price', contractValue(page, 'price'))}
            ${metric('Performance fee', contractValue(page, 'performanceFee'))}
            ${metric('Capital allocator', page.allocator, true)}
            ${metric('Vault type', `<span class="managed">Managed</span>`)}
          </div>
        `, '', overviewActions(page, 'earn', page.asset))}
        ${renderCard('Statistics', `
          <div class="stat-list">
            ${metric('Total supply', pageTokenValueMetric(page, 'totalSupply'))}
            ${metric('Available liquidity', pageTokenValueMetric(page, 'availableLiquidity'))}
            ${metric(`${infoLabel('Supply APY', 'supply-apy')} <span class="chip">1h</span>`, totalSupplyApy)}
          </div>
        `)}
        ${renderCard('Exposure', `
          <div class="exposure-list">
            ${page.exposures.map((row) => `
              <div class="exposure-row">
                <div class="exposure-head">
                  <div>${assetIcon(row.asset)}<span><small>${row.label}</small><strong>${row.asset}</strong>${row.caption ? `<small>${row.caption}</small>` : ''}</span></div>
                  <div><small>Borrow APY</small><strong class="accent">${exposureRowApy(page, row)}</strong>${row.pageId ? `<a class="mini-link" href="#/${row.pageId}">View market</a>` : ''}</div>
                </div>
                <div class="exposure-metrics">
                  ${metric('Current allocation', exposureRowAllocation(page, row))}
                  ${metric('Allocation cap', exposureRowCap(page, row))}
                </div>
              </div>
            `).join('')}
          </div>
        `)}
        ${renderCard('Management', `
          <div class="stat-list">
            ${metric('Owner', '0x34a0...E343')}
            ${metric('Curator', '0x7d07...dCd8')}
            ${metric('Guardian', 'None')}
            ${metric('Timelock', '1 day')}
          </div>
        `)}
        ${renderCard('Addresses', `
          <div class="stat-list">
            ${metric(`${page.asset} token`, assetAddress ? addressLink(page, assetAddress) : 'Not available')}
            ${metric(`${page.asset} vault`, page.contractAddress ? addressLink(page, page.contractAddress) : 'Not available')}
            ${page.underlyingAddress && page.underlyingAddress.toLowerCase() !== String(assetAddress).toLowerCase() ? metric('Underlying token', addressLink(page, page.underlyingAddress)) : ''}
            ${metric('Fee receiver', feeReceiver ? addressLink(page, feeReceiver) : 'None')}
          </div>
        `)}
      </div>
      <aside class="action-panel earn-panel">
        <div class="apy-head"><span>Supply APY <b>1h</b> ⓘ</span><strong>⌁ ${totalSupplyApy}</strong></div>
        <div class="field-card">
          <div class="field-top"><span>Supply amount</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-live-field="earn-amount" inputmode="decimal" placeholder="0.00" value="${fieldDrafts[`${page.id}:earn-amount`] || ''}" />
            <span>${assetIcon(page.asset)}${page.asset}</span>
          </div>
          <div class="field-bottom"><span>$0</span>${supplyMaxButton(page, 'earn-amount', page.contractAddress || '', page.asset)}</div>
        </div>
        <div class="tx-row">
          <button class="${actionButtonClass(page.id, 'supply', 'deposit', 'deposit')}" data-live-deposit="${page.id}" data-live-role="earn" data-live-vault="${page.contractAddress || ''}" data-live-field-name="earn-amount">Deposit</button>
          <button class="${actionButtonClass(page.id, 'supply', 'withdraw', 'deposit')}" data-live-withdraw="${page.id}" data-live-role="earn" data-live-vault="${page.contractAddress || ''}" data-live-field-name="earn-amount">Withdraw</button>
        </div>
        <div class="summary-card">
          ${metric('Projected earnings per month', contractValue(page, 'projectedEarnings'))}
        </div>
        ${notice ? `<div class="action-notice">${notice}</div>` : ''}
      </aside>
    </div>
  `;
}

function renderLiquidator(page) {
  const notice = actionNotices[page.id] || '';
  const riskRows = liquidationRiskState.rows || [];
  const updatedAt = liquidationRiskState.updatedAt ? new Date(liquidationRiskState.updatedAt).toLocaleString() : 'Never';
  const hiddenHealthy = Object.keys(liquidationRiskState.candidates || {}).length - riskRows.length;
  const scannedBlocks = Object.values(LIQUIDATION_CHAINS)
    .map((chain) => `${chain.label}: ${liquidationRiskState.lastScannedBlocks?.[chain.chainId] || 'Not scanned'}`)
    .join(' | ');
  const trackedMarketCount = Object.values(LIQUIDATION_CHAINS)
    .reduce((sum, chain) => sum + chain.liabilityVaults.length, 0);
  return `
    <section class="liquidator-hero">
      <p>${page.subtitle}</p>
      <h1>${page.headline}</h1>
      <span>${page.description}</span>
    </section>
    <div class="page-grid earn-layout">
      <div class="left-stack">
        ${renderCard('Liquidator', `
          <div class="metric-grid">
            ${metric('Network', page.network)}
            ${metric('Address', addressLink(page, page.contractAddress))}
            ${metric('Function', 'liquidate(address,uint8)')}
            ${metric('Up-front cost', page.upFrontCost)}
          </div>
        `)}
      </div>
      <aside class="action-panel earn-panel">
        <div class="apy-head"><span>Easy Liquidation</span><strong>${page.network}</strong></div>
        <div class="field-card liquidator-form">
          <label>
            <span>Select which market to liquidate from</span>
            <select class="sim-input liquidator-select" data-liquidation-market>
              ${page.markets.map((market) => `
                <option value="${market.marketNumber}">${market.label}</option>
              `).join('')}
            </select>
          </label>
          <label>
            <span>Address of account with bad debt to liquidate</span>
            <input class="sim-input liquidator-address" data-liquidation-borrower placeholder="0x..." spellcheck="false" />
          </label>
        </div>
        <button class="accept" data-live-liquidate="${page.id}">Liquidate</button>
        ${notice ? `<div class="action-notice">${notice}</div>` : ''}
      </aside>
    </div>
    <div class="full-width-stack liquidation-dashboard-row">
      ${renderCard('Liquidation Risk Dashboard', `
        <div class="dashboard-toolbar">
          <div>
            <strong>At-risk account scanner</strong>
            <span>Scans exact EVC logs for ${trackedMarketCount} CurveYield liability markets on Ethereum and Arbitrum, then re-reads live account health before showing anything.</span>
            <span>Last update: ${updatedAt}. ${scannedBlocks}.</span>
          </div>
          <button class="ghost-action compact-action" data-refresh-liquidation-risk ${liquidationRiskRefreshStarted ? 'disabled' : ''}>Refresh risk</button>
        </div>
        <div class="risk-summary-grid">
          ${metric('Displayed accounts', String(riskRows.length))}
          ${metric('Healthy candidates hidden', String(Math.max(0, hiddenHealthy)))}
          ${metric('Tracked markets', String(trackedMarketCount))}
        </div>
        <div class="risk-table-wrap">
          <table class="risk-table">
            <thead>
              <tr>
                <th>Chain</th>
                <th>account/sub-account</th>
                <th>owner wallet</th>
                <th>market label</th>
                <th>enabled collateral vaults</th>
                <th>debt amount</th>
                <th>collateral amount/value</th>
                <th>health score</th>
                <th>status</th>
                <th>last checked block</th>
                <th>last AccountStatusCheck block</th>
                <th>Explorer links</th>
              </tr>
            </thead>
            <tbody>
              ${riskRows.length ? riskRows.map((row) => `
                <tr>
                  <td data-label="Chain">${row.chain || 'Ethereum'}</td>
                  <td data-label="account/sub-account">${explorerAddressLink(row, row.account)}</td>
                  <td data-label="owner wallet">${row.owner ? explorerAddressLink(row, row.owner) : 'Not available'}</td>
                  <td data-label="market label">${row.marketLabel}</td>
                  <td data-label="enabled collateral vaults">${(row.collaterals || []).length ? row.collaterals.map((address) => explorerAddressLink(row, address)).join(', ') : 'None indexed'}</td>
                  <td data-label="debt amount">${row.debt}</td>
                  <td data-label="collateral amount/value">${row.collateralValue} / liability ${row.liabilityValue}</td>
                  <td data-label="health score">${row.healthScore}</td>
                  <td data-label="status"><span class="risk-status ${row.statusClass}">${row.status}</span></td>
                  <td data-label="last checked block">${explorerBlockLink(row, row.lastCheckedBlock)}</td>
                  <td data-label="last AccountStatusCheck block">${explorerBlockLink(row, row.lastAccountStatusCheckBlock)}</td>
                  <td data-label="Explorer links">${explorerAddressLink(row, row.account, 'Account')} ${explorerAddressLink(row, row.controller, 'Controller')}</td>
                </tr>
              `).join('') : `
                <tr class="risk-empty-row">
                  <td colspan="12">No liquidatable, high-risk, or watch accounts found in the stored scan. That usually means there are no currently discovered risky accounts, or a deeper manual refresh has not found any. Healthy accounts stay hidden.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
        <p class="section-copy">This dashboard is discovery and risk monitoring only. It does not label an account profitable unless a liquidation simulation succeeds.</p>
      `)}
    </div>
  `;
}

function renderMarketTokenSubview(page, side, notice) {
  const isCollateral = side === 'collateral';
  if (!isCollateral) return renderDebtTokenSubview(page, notice);
  const token = isCollateral ? page.collateral : page.debt;
  const primaryApyLabel = infoLabel('Supply APY', 'supply-apy');
  const primaryApy = currentSupplyApyTotal(page);
  const actionField = `${side}-token-amount`;
  const actionVault = page.collateralVaultAddress || page.contractAddress || '';
  const tokenAddress = contractAddressValue(page, 'collateralAssetAddress');
  const totalSupply = liveMetrics[page.id]?.collateralTotalSupply || contractValue(page, 'totalSupply');
  const collateralPrice = contractValue(page, 'collateralPrice') || contractValue(page, 'price');

  return `
    ${renderPageTitle(page)}
    <div class="page-grid market-layout">
      <div class="left-stack">
        ${renderMarketTabs(page, side)}
        ${renderCard('Overview', `
          <div class="metric-grid">
            <p class="overview-copy">${tokenDescription(token)}</p>
            ${metric('Price', dollarDisplay(collateralPrice))}
            ${metric('Market', page.subtitle)}
            ${metric('Risk manager', addressLink(page, riskManagerAddressFor(page)))}
            ${metric('Vault type', '<span class="managed">Governed</span>')}
            ${metric('Can be borrowed', 'No')}
            ${metric('Can be used as collateral', 'Yes in 1 markets')}
          </div>
        `, '', overviewActions(page, 'collateral', token))}
        ${renderCard('Statistics', `
          <div class="stat-list">
            ${metric('Total supply', tokenUnitsToDollarMetric(totalSupply, collateralPrice, '$0'))}
            ${metric(primaryApyLabel, primaryApy)}
          </div>
        `)}
        ${renderCard('Risk parameters', `
          <div class="stat-list">
            ${metric('Supply cap', contractValue(page, 'collateralSupplyCap') || '∞')}
            ${metric('Share token exchange rate', contractValue(page, 'collateralShareTokenExchangeRate') || '1.00')}
            ${metric('Disabled operations', 'None')}
          </div>
        `)}
        ${renderCard('Addresses', `
          <div class="stat-list">
            ${metric(`${token} token`, tokenAddress ? addressLink(page, tokenAddress) : 'Not available')}
            ${metric(`${token} vault`, addressLink(page, actionVault))}
            ${metric('Risk manager', addressLink(page, riskManagerAddressFor(page)))}
            ${metric('Hook target', 'None')}
          </div>
        `)}
      </div>
      <aside class="action-panel">
        <div class="tabs action-tabs">
          <button class="active">${isCollateral ? 'Supply' : 'Borrow'}</button>
        </div>
        <div class="field-card">
          <div class="field-top"><span>${isCollateral ? 'Supply' : 'Borrow'} ${token}</span><span>${page.subtitle}</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-live-field="${actionField}" inputmode="decimal" placeholder="0.00" value="${fieldDrafts[`${page.id}:${actionField}`] || ''}" />
            <span>${assetIcon(token, isCollateral ? 'gold' : 'blue')}${token}</span>
          </div>
          <div class="field-bottom"><span>$0</span>${isCollateral ? supplyMaxButton(page, actionField, actionVault, token) : debtMaxButton(page, actionField, actionVault, token)}</div>
        </div>
        <div class="tx-row">
          <button class="${actionButtonClass(page.id, 'supply', 'withdraw', 'deposit')}" data-live-withdraw="${page.id}" data-live-role="collateral" data-live-vault="${actionVault}" data-live-debt-vault="${page.debtVaultAddress || page.contractAddress || ''}" data-live-field-name="${actionField}">Withdraw</button>
        </div>
        ${notice ? `<div class="action-notice">${notice}</div>` : ''}
      </aside>
    </div>
  `;
}

function renderDebtTokenSubview(page, notice) {
  const token = page.debt;
  const actionField = 'debt-token-amount';
  const actionVault = page.debtVaultAddress || page.contractAddress || '';
  const tokenAddress = contractAddressValue(page, 'debtAssetAddress');
  const debtTokenAddress = contractAddressValue(page, 'debtTokenAddress') || actionVault;
  const debtMarkets = [page];
  const debtPrice = contractValue(page, 'debtPrice') || '$1.00';
  return `
    ${renderPageTitle(page)}
    <div class="page-grid market-layout">
      <div class="left-stack">
        ${renderMarketTabs(page, 'debt')}
        ${renderCard('Overview', `
          <div class="metric-grid">
            <p class="overview-copy">${tokenDescription(token)}</p>
            ${metric('Price', debtPrice)}
            ${metric('Market', page.subtitle)}
            ${metric('Risk manager', addressLink(page, riskManagerAddressFor(page)))}
            ${metric('Vault type', '<span class="managed">Governed</span>')}
            ${metric('Can be borrowed', `Yes in ${debtMarkets.length} markets`)}
            ${metric('Can be used as collateral', 'No')}
          </div>
        `, '', overviewActions(page, 'debt', token))}
        ${renderCard('Statistics', `
          <div class="stat-list">
            ${metric('Total supply', pageTokenValueMetric(page, 'debtTotalSupply', debtPrice, '$0'))}
            ${metric('Total borrowed', pageTokenValueMetric(page, 'totalBorrows', debtPrice, '$0'))}
            ${metric('Available liquidity', pageTokenValueMetric(page, 'availableLiquidity', debtPrice, '$0'))}
            ${metric(infoLabel('Supply APY', 'supply-apy'), contractValue(page, 'debtSupplyApy') || '0.00%')}
            ${metric(infoLabel('Borrow APY', 'borrow-apy'), contractValue(page, 'borrowApy'))}
            ${metric('Utilization', contractValue(page, 'utilization') || '0.00%')}
          </div>
        `)}
        ${renderCard('Risk parameters', `
          <div class="stat-list">
            ${metric('Liquidation bonus', '0-15%')}
            ${metric('Supply cap', contractValue(page, 'supplyCap') || '∞')}
            ${metric('Borrow cap', contractValue(page, 'borrowCap') || '∞')}
            ${metric('Share token exchange rate', contractValue(page, 'shareTokenExchangeRate') || '1.00')}
            ${metric('Bad debt socialisation', 'Yes')}
            ${metric('Interest fee', contractValue(page, 'interestFee'))}
            ${metric('Disabled operations', 'None')}
          </div>
        `)}
        ${renderCard('Collateral exposure', `
          <p class="section-copy">Deposits in this vault can be borrowed. Please make sure you're comfortable accepting the collaterals listed in the table below before supplying.</p>
          <div class="exposure-list">
            ${debtMarkets.map((market) => `
              <div class="exposure-row">
                <div class="exposure-head">
                  <div>${assetIcon(market.collateral, 'gold')}<span><small>${market.subtitle}</small><strong>${market.collateral}</strong></span></div>
                </div>
                <div class="exposure-metrics">
                  ${metric('Max LTV', contractValue(market, 'maxLtv') || contractValue(page, 'maxLtv'))}
                  ${metric('Liquidation LTV', contractValue(market, 'liquidationLtv') || contractValue(page, 'liquidationLtv'))}
                </div>
              </div>
            `).join('')}
          </div>
        `)}
        ${renderCard('Interest rate model', `
          ${renderIrmChart(page)}
          <div class="stat-list">
            ${metric('Kink', contractValue(page, 'irmKink'))}
            ${metric('Base rate', contractValue(page, 'irmBaseRate'))}
            ${metric('Rate at kink', contractValue(page, 'irmRateAtKink'))}
            ${metric('Max rate', contractValue(page, 'irmMaxRate'))}
          </div>
        `)}
        ${renderCard('Addresses', `
          <div class="stat-list">
            ${metric(`${token} token`, tokenAddress ? addressLink(page, tokenAddress) : 'Not available')}
            ${metric(`${token} vault`, addressLink(page, actionVault))}
            ${metric(`${token} debt`, addressLink(page, debtTokenAddress))}
            ${metric('Risk manager', addressLink(page, riskManagerAddressFor(page)))}
            ${metric('Fee receiver', contractValue(page, 'feeReceiver') ? addressLink(page, contractValue(page, 'feeReceiver')) : 'Not available')}
            ${metric('Oracle router', contractValue(page, 'oracleRouter') ? addressLink(page, contractValue(page, 'oracleRouter')) : addressLink(page, page.routerAddress))}
            ${metric('Unit of account', contractValue(page, 'unitOfAccount') ? addressLink(page, contractValue(page, 'unitOfAccount')) : 'Not available')}
            ${metric('Interest rate model', contractValue(page, 'interestRateModel') ? addressLink(page, contractValue(page, 'interestRateModel')) : addressLink(page, page.irmAddress))}
            ${metric('Hook target', contractValue(page, 'hookTarget') && contractValue(page, 'hookTarget') !== '0x0000000000000000000000000000000000000000' ? addressLink(page, contractValue(page, 'hookTarget')) : 'None')}
          </div>
        `)}
      </div>
      <aside class="action-panel">
        <div class="tabs action-tabs">
          <button class="active">Borrow</button>
        </div>
        <div class="field-card">
          <div class="field-top"><span>Borrow ${token}</span><span>${page.subtitle}</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-live-field="${actionField}" inputmode="decimal" placeholder="0.00" value="${fieldDrafts[`${page.id}:${actionField}`] || ''}" />
            <span>${assetIcon(token)}${token}</span>
          </div>
          <div class="field-bottom"><span>$0</span>${debtMaxButton(page, actionField, actionVault, token)}</div>
        </div>
        <div class="tx-row debt-tx-row">
          <button class="${actionButtonClass(page.id, 'debt', 'borrow', 'borrow')}" data-live-borrow="${page.id}" data-live-debt-vault="${actionVault}" data-live-collateral-vault="${page.collateralVaultAddress || ''}" data-live-field-name="${actionField}">Borrow</button>
        </div>
        ${notice ? `<div class="action-notice">${notice}</div>` : ''}
      </aside>
    </div>
  `;
}

function iporMetric(label, value, subvalue = '') {
  return `
    <div class="ipor-stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
      ${subvalue ? `<small>${subvalue}</small>` : ''}
    </div>
  `;
}

function renderCurveYieldHome(page) {
  return `
    <div class="cy-home">
      <div class="cy-home-card">
        <img class="cy-home-logo" src="./assets/logos/curveyield-512.png" alt="" />
        <h1>${page.title}</h1>
        <div class="cy-home-actions">
          <a href="#/fusion-vaults">
            <span>IPOR Vaults</span>
          </a>
          <a href="#/explore">
            <span>cy-scrvUSD Euler Vault & Markets</span>
          </a>
          <a href="https://docs.curveyield.com" target="_blank" rel="noopener noreferrer">
            <span>CurveYield Documentation</span>
          </a>
          <a href="https://github.com/orgs/CurveYield/repositories" target="_blank" rel="noopener noreferrer">
            <span>CurveYield Github</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderIporVaultList(page) {
  const rows = page.vaultRows || [];
  return `
    <div class="ipor-shell">
      <header class="ipor-topbar">
        <a class="ipor-brand" href="#/fusion-vaults">
          <span class="ipor-brand-mark">âœ¦</span>
          <span><strong>Fusion</strong><small>by IPOR</small></span>
        </a>
        <nav>
          <a class="active" href="#/fusion-vaults">Fusion</a>
          <a href="#/explore">Euler</a>
          <a href="https://docs.curveyield.com" target="_blank" rel="noreferrer">CurveYield Docs</a>
        </nav>
        <div class="ipor-wallet-row">
          <span class="ipor-pill">Ethereum</span>
          <span class="ipor-pill">${connectedWalletAccount ? shortAddress(connectedWalletAccount) : 'Connect wallet'}</span>
        </div>
      </header>
      <main class="ipor-container ipor-vault-list-page">
        <section class="fusion-vault-list">
          <div class="fusion-vault-search">
            <span>⌕</span>
            <input aria-label="Search vaults" placeholder="Search" />
          </div>
          <div class="fusion-vault-table">
            <div class="fusion-vault-row fusion-vault-head">
              <span>Chain / Asset</span><span>Vault Name / Strategy</span><span>APY</span><span>TVM</span>
            </div>
            ${rows.map((row) => {
              const chain = getChainById(row.chainId);
              const sourcePage = row.sourcePageId ? getPageById(row.sourcePageId) : null;
              const sourceLive = sourcePage ? liveMetrics[sourcePage.id] || {} : {};
              const apy = sourcePage ? (sourceLive.supplyApy || sourcePage.strategyApr || row.apy) : row.apy;
              const sourceTvm = sourcePage ? (sourceLive.totalValueManaged || sourcePage.totalValueManaged || sourceLive.totalAssets || row.tvm) : row.tvm;
              const tvm = String(sourceTvm || row.tvm).startsWith('$') ? sourceTvm : `$${sourceTvm}`;
              const content = `
                <span class="fusion-vault-chain">
                  <img class="ipor-base-logo" src="${chain.logo}" alt="" />
                  <small>${row.asset}</small>
                </span>
                <span class="fusion-vault-name">
                  <img src="${row.logo}" alt="" />
                  <strong>${row.name}</strong>
                  <small>${row.strategy}</small>
                </span>
                <span class="fusion-vault-apy">${apy}</span>
                <span class="fusion-vault-tvm">${tvm}</span>
              `;
              return row.href
                ? `<a class="fusion-vault-row" href="${row.href}">${content}</a>`
                : `<div class="fusion-vault-row">${content}</div>`;
            }).join('')}
          </div>
        </section>
      </main>
    </div>
  `;
}

function chartPoints(values, min, max) {
  const range = max - min || 1;
  return values.map((value, index) => {
    const step = values.length > 1 ? 338 / (values.length - 1) : 0;
    const x = 42 + index * step;
    const y = 178 - ((value - min) / range) * 120;
    return `${x.toFixed(2)},${Math.max(46, Math.min(178, y)).toFixed(2)}`;
  }).join(' ');
}

function renderPerformanceChart(page) {
  const showApy = iporPerformanceModes.has('apy');
  const showShare = iporPerformanceModes.has('share');
  const history = page.performanceHistory || {};
  const apyPoints = chartPoints(history.apy || [0, 0, 0, 0, 0, 0, 0], history.apyMin ?? 0, history.apyMax ?? 1);
  const sharePoints = chartPoints(history.share || [1, 1, 1, 1, 1, 1, 1], history.shareMin ?? 1, history.shareMax ?? 1.01);
  const apyLabels = history.apyLabels || ['1.00%', '0.50%', '0.00%'];
  const shareLabels = history.shareLabels || ['1.010', '1.005', '1.000'];
  const xLabels = history.xLabels || ['02.05', '04.05', '06.05', '08.05'];
  return `
    <svg class="ipor-chart" viewBox="0 0 410 240" role="img" aria-label="Performance report">
      <g class="ipor-grid">
        <path d="M42 42H380M42 88H380M42 134H380M42 180H380"/>
        <path d="M42 42V190M96 42V190M150 42V190M204 42V190M258 42V190M312 42V190M366 42V190"/>
      </g>
      ${showApy ? `<polyline class="ipor-line ipor-line-apy" points="${apyPoints}" />` : ''}
      ${showShare ? `<polyline class="ipor-line ipor-line-share" points="${sharePoints}" />` : ''}
      <g class="ipor-axis">
        <text x="8" y="47">${apyLabels[0]}</text>
        <text x="8" y="137">${apyLabels[1]}</text>
        <text x="8" y="184">${apyLabels[2]}</text>
        <text x="374" y="47">${shareLabels[0]}</text>
        <text x="374" y="137">${shareLabels[1]}</text>
        <text x="374" y="184">${shareLabels[2]}</text>
        <text x="42" y="220">${xLabels[0] || ''}</text>
        <text x="150" y="220">${xLabels[1] || ''}</text>
        <text x="258" y="220">${xLabels[2] || ''}</text>
        <text x="352" y="220">${xLabels[3] || ''}</text>
      </g>
    </svg>
  `;
}

function renderIporMarketDetailsModal(page, apy, assets) {
  if (activeInfo !== 'ipor-market-details') return '';
  const assetNumber = Number(String(assets).replace(/[$,]/g, '')) || 0;
  const vaultAssets = `$${(assetNumber * 0.99).toFixed(2)}`;
  const poolAssets = `$${(assetNumber * 0.99).toFixed(2)}`;
  const idleAssets = `$${(assetNumber * 0.01).toFixed(2)}`;
  const poolName = page.poolName || 'Curve LP';
  return `
    <div class="info-backdrop" data-close-info>
      <section class="info-modal ipor-details-modal ipor-full-details-modal" data-stop-close>
        <button class="modal-close" data-close-info aria-label="Close">×</button>
        <h2>All Markets</h2>
        <div class="ipor-modal-table">
          <div class="ipor-modal-row ipor-modal-head">
            <span>Layer</span><span>Asset</span><span>Assets</span><span>APY</span><span>Allocation</span><span>Notes</span>
          </div>
          <div class="ipor-modal-row ipor-modal-group">
            <span><strong>Vault</strong><small>${page.shareSymbol || page.title}</small></span><span>${page.asset}</span><span>$${assets}</span><span>${apy}</span><span>100.00%</span><span>${page.depositRoute || page.strategyName}</span>
          </div>
          <div class="ipor-modal-row ipor-modal-group">
            <span><span class="ipor-protocol-logo">Curve</span><strong>Curve LP</strong><small>OUSD/crvUSD</small></span><span>LP token</span><span>${poolAssets}</span><span>${apy}</span><span>99.00%</span><span>${poolName}</span>
          </div>
          <div class="ipor-modal-row ipor-modal-subhead ipor-credit-cols">
            <span>Curve pool</span><span>Input</span><span>Output</span><span>Pool APY</span><span>StakeDAO APY</span><span>Borrowed</span><span>Borrow APY</span><span>Net APY</span><span>Allocation</span>
          </div>
          <div class="ipor-modal-row ipor-credit-cols ipor-modal-leaf">
            <span>${poolName}</span><span>${page.asset}</span><span>OUSD/crvUSD LP</span><span>0.00%</span><span>${apy}</span><span>$0</span><span>---</span><span>${apy}</span><span>99.00%</span>
          </div>
          <div class="ipor-modal-row ipor-modal-group">
            <span><strong>ERC4626 Vault</strong><small><i class="ipor-dot purple"></i>99.00%</small></span><span>StakeDAO vault shares</span><span>${vaultAssets}</span><span>${apy}</span><span>99.00%</span><span>Holds the Curve LP token</span>
          </div>
          <div class="ipor-modal-row ipor-modal-subhead ipor-vault-cols">
            <span>Vault</span><span>Underlying</span><span>Assets</span><span>Net APY</span><span>Allocation</span>
          </div>
          <div class="ipor-modal-row ipor-vault-cols ipor-modal-leaf">
            <span><a href="${page.sourceAprUrl}" target="_blank" rel="noreferrer">${page.strategyName} ↗</a></span><span>${poolName}</span><span>${vaultAssets}</span><span>${apy}</span><span><i class="ipor-dot purple"></i>99.00%</span>
          </div>
          <div class="ipor-modal-row ipor-modal-group">
            <span><strong>ERC20 Tokens</strong><small><i class="ipor-dot navy"></i>1.00%</small></span><span>${page.asset}</span><span>${idleAssets}</span><span>0.00%</span><span>1.00%</span><span>${page.idleAssetName || `Idle ${page.asset}`}</span>
          </div>
          <div class="ipor-modal-row ipor-token-cols ipor-modal-subhead">
            <span>Token</span><span>Balance</span><span>Price</span><span>Assets</span><span>Assets APY</span><span>Net APY</span><span>Allocation</span>
          </div>
          <div class="ipor-modal-row ipor-token-cols ipor-modal-leaf">
            <span>${assetIcon(page.asset)} ${page.asset}</span><span>${(assetNumber * 0.01).toFixed(2)}</span><span>$1</span><span>${idleAssets}</span><span>0.00%</span><span>0.00%</span><span><i class="ipor-dot navy"></i>1.00%</span>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderAllocationChart(page) {
  const history = page?.allocationHistory || {};
  const values = history.values || [1, 0, 99];
  const labels = history.labels || ['Idle', 'Curve LP', 'StakeDAO'];
  const maxValue = Math.max(100, ...values);
  const bars = values.map((value, index) => {
    const x = 104 + index * 78;
    const height = Math.max(4, (value / maxValue) * 140);
    const y = 190 - height;
    const mutedClass = index === 0 ? ' muted' : '';
    return `<rect class="ipor-allocation-bar${mutedClass}" x="${x}" y="${y.toFixed(2)}" width="30" height="${height.toFixed(2)}" rx="4"/><text x="${x - 22}" y="220">${labels[index]}</text>`;
  }).join('');
  return `
    <svg class="ipor-chart" viewBox="0 0 410 240" role="img" aria-label="Historical allocation">
      <g class="ipor-grid">
        <path d="M42 42H380M42 88H380M42 134H380M42 180H380"/>
        <path d="M42 42V190M96 42V190M150 42V190M204 42V190M258 42V190M312 42V190M366 42V190"/>
      </g>
      ${bars}
      <g class="ipor-axis">
        <text x="8" y="47">${history.maxValueLabel || '100%'}</text>
        <text x="16" y="137">${history.midValueLabel || '50%'}</text>
        <text x="28" y="184">${history.minValueLabel || '0%'}</text>
      </g>
    </svg>
  `;
}

function renderIporMarketsTable(page, apy, assets) {
  if (Array.isArray(page.marketRows) && page.marketRows.length) {
    return `
      <div class="ipor-table ipor-credit-market-table">
        <div class="head"><span>Market</span><span>Assets</span><span>Assets APY</span><span>Liabilities</span><span>Liabilities APY</span><span>Net APY</span></div>
        ${page.marketRows.map((row) => `
          <div class="row">
            <span>${row.label}<small>${row.caption || ''}</small></span>
            <span>${row.assets || ''}</span>
            <span>${row.assetsApy || ''}</span>
            <span>${row.liabilities || ''}</span>
            <span>${row.liabilitiesApy || ''}</span>
            <span>${row.netApy || ''}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  return `
    <div class="ipor-table">
      <div class="head"><span>Route</span><span>Assets</span><span>APY</span><span>Input</span><span>Output</span><span>Allocation</span></div>
      <div class="row strong"><span>${page.shareSymbol || page.title}<small>${page.network}</small></span><span>$${assets}</span><span>${apy}</span><span>${page.asset}</span><span>${page.shareSymbol || 'Vault shares'}</span><span>100.00%</span></div>
      <details class="ipor-expand-row" open>
        <summary class="row"><span>StakeDAO<small>${page.strategyName}</small></span><span>$${assets}</span><span>${apy}</span><span>${page.poolName || 'Curve LP'}</span><span>StakeDAO vault shares</span><span>99.00%</span></summary>
        <div class="ipor-row-details">
          ${metric('Allocation', '100.00%')}
          ${metric('Strategy', page.strategyName)}
          ${metric('Pool', page.poolName || 'Curve LP')}
          ${metric('APR source', 'StakeDAO')}
          ${metric('Risk note', 'Single allocation')}
        </div>
      </details>
      <div class="row"><span>${page.idleAssetName || `Idle ${page.asset}`}<small>withdrawal buffer</small></span><span>$${(Number(String(assets).replace(/[$,]/g, '')) * 0.01).toFixed(2)}</span><span>0.00%</span><span>${page.asset}</span><span>${page.asset}</span><span>1.00%</span></div>
    </div>
  `;
}

function renderIporVault(page) {
  const notice = actionNotices[page.id] || '';
  const live = liveMetrics[page.id] || {};
  const renderPage = live.allocationHistory || live.performanceHistory
    ? { ...page, allocationHistory: live.allocationHistory || page.allocationHistory, performanceHistory: live.performanceHistory || page.performanceHistory }
    : page;
  const marketRows = live.marketRows || page.marketRows;
  const apy = contractValue(page, 'supplyApy') || page.strategyApr;
  const assets = live.totalValueManaged || page.totalValueManaged || contractValue(page, 'totalAssets');
  const totalSupply = live.totalValueLocked || page.totalValueLocked || contractValue(page, 'totalSupply');
  const withdrawMode = currentActionMode(page.id, 'supply', 'deposit') === 'withdraw';
  const vaultBalance = withdrawMode
    ? withdrawCapacityFor(page.contractAddress, page.asset)
    : walletBalanceFor(page.contractAddress, page.asset);
  const tokenLogo = TOKEN_LOGOS[page.asset];
  const iporAssetIcon = tokenLogo
    ? `<img class="ipor-token-logo" src="${tokenLogo}" alt="" />`
    : assetIcon(page.asset);
  const chain = getChainById(page.chainId);
  const chainLogo = `<img class="ipor-base-logo" src="${chain.logo}" alt="" />`;
  const explorerLabel = page.chainId === 'base' ? 'Basescan Page' : page.chainId === 'ethereum' ? 'Etherscan Page' : 'Explorer Page';
  const managedUnit = live.totalAssetsUnit || page.totalAssetsUnit || `${contractValue(page, 'totalAssets') || assets} ${page.asset}`;
  const lockedUnit = live.totalLockedUnit || page.totalLockedUnit || `${contractValue(page, 'totalSupply') || totalSupply} ${page.asset}`;
  const primaryActionLabel = page.actionPrimaryLabel || 'Approve / Deposit';
  const secondaryActionLabel = page.actionSecondaryLabel || 'Withdraw';
  const capacityRemaining = live.capacityRemaining || page.capacityRemaining;
  const depositsLabel = live.depositsLabel || page.depositsLabel;
  const maxCapacityLabel = live.maxCapacityLabel || page.maxCapacityLabel;
  const capacityPercent = live.capacityPercent ?? page.capacityPercent ?? 0;
  return `
    <div class="ipor-shell">
      <header class="ipor-topbar">
        <a class="ipor-brand" href="#/ipor-crvusd-lp-vault">
          <span class="ipor-brand-mark">✦</span>
          <span><strong>Fusion</strong><small>by IPOR</small></span>
        </a>
        <nav>
          <a class="active" href="#/ipor-crvusd-lp-vault">Fusion</a>
          <a href="#/explore">Euler</a>
          <a href="https://docs.curveyield.com" target="_blank" rel="noreferrer">CurveYield Docs</a>
        </nav>
        <div class="ipor-wallet-row">
          <span class="ipor-pill">${chainLogo} ${chain.shortLabel}</span>
          <span class="ipor-pill">${connectedWalletAccount ? shortAddress(connectedWalletAccount) : 'Connect wallet'}</span>
        </div>
      </header>
      <main class="ipor-container">
        <div class="ipor-breadcrumb"><span>Fusion Vaults list</span><span>›</span><span>Fusion Vault details</span></div>
        <section class="ipor-hero">
          <div class="ipor-title-row">
            <img class="ipor-vault-logo" src="${page.logo}" alt="" />
            <div>
              <h1>${page.title}</h1>
              <p>${page.subtitle}</p>
            </div>
            <a class="ipor-page-button" href="${explorerAddressUrl(page, page.contractAddress)}" target="_blank" rel="noreferrer">${explorerLabel}</a>
            <a class="ipor-page-button" href="${page.externalUrl}" target="_blank" rel="noreferrer">IPOR Page</a>
          </div>
          <div class="ipor-badges">
            <span>${chainLogo} ${chain.shortLabel}</span>
            <span>${iporAssetIcon} ${page.asset}</span>
            <span><img src="./assets/logos/curveyield-512.png" alt="" /> CurveYield</span>
          </div>
        </section>
        <div class="ipor-layout">
          <section class="ipor-main">
            <div class="ipor-tabs"><button class="active">Overview</button></div>
            <div class="ipor-stats">
              ${iporMetric('APY', apy, 'StakeDAO strategy APR')}
              ${iporMetric('Total Value Managed', `$${assets}`, managedUnit)}
              ${iporMetric('Total Value Locked', `$${totalSupply}`, lockedUnit)}
            </div>
            <div class="ipor-charts">
              <section class="ipor-panel">
                <div class="ipor-panel-head"><h2>Performance Report</h2><span>↗</span></div>
                ${renderPerformanceChart(page)}
                <div class="ipor-chart-legend">
                  <button class="${iporPerformanceModes.has('apy') ? 'active' : ''}" data-ipor-chart="apy"><span class="${iporPerformanceModes.has('apy') ? 'checked' : ''}"></span>Strategy APY</button>
                  <button class="${iporPerformanceModes.has('share') ? 'active' : ''}" data-ipor-chart="share"><span class="${iporPerformanceModes.has('share') ? 'checked' : ''}"></span>Share price</button>
                </div>
              </section>
              <section class="ipor-panel">
                <div class="ipor-panel-head"><h2>Historical Allocation</h2><button>Report issue</button></div>
                ${renderAllocationChart(renderPage)}
                <div class="ipor-chart-legend"><span class="aqua"></span>${page.strategyName}</div>
              </section>
            </div>
            <section class="ipor-panel ipor-markets">
              <div class="ipor-panel-head"><h2>All Markets</h2><button data-info-kind="ipor-market-details">More details ↗</button></div>
              ${Array.isArray(marketRows) && marketRows.length ? renderIporMarketsTable({ ...page, marketRows }, apy, assets) : ''}
              <div class="ipor-table" style="${Array.isArray(marketRows) && marketRows.length ? 'display: none' : ''}">
                <div class="head"><span>Route</span><span>Assets</span><span>APY</span><span>Input</span><span>Output</span><span>Allocation</span></div>
                <div class="row strong"><span>${page.shareSymbol || page.title}<small>${page.network}</small></span><span>$${assets}</span><span>${apy}</span><span>${page.asset}</span><span>${page.shareSymbol || 'Vault shares'}</span><span>100.00%</span></div>
                <details class="ipor-expand-row" open>
                  <summary class="row"><span>StakeDAO<small>${page.strategyName}</small></span><span>$${assets}</span><span>${apy}</span><span>${page.poolName || 'Curve LP'}</span><span>StakeDAO vault shares</span><span>99.00%</span></summary>
                  <div class="ipor-row-details">
                    ${metric('Allocation', '100.00%')}
                    ${metric('Strategy', page.strategyName)}
                    ${metric('Pool', page.poolName || 'Curve LP')}
                    ${metric('APR source', 'StakeDAO')}
                    ${metric('Risk note', 'Single allocation')}
                  </div>
                </details>
                <div class="row"><span>${page.idleAssetName || `Idle ${page.asset}`}<small>withdrawal buffer</small></span><span>$${(Number(String(assets).replace(/[$,]/g, '')) * 0.01).toFixed(2)}</span><span>0.00%</span><span>${page.asset}</span><span>${page.asset}</span><span>1.00%</span></div>
              </div>
            </section>
          </section>
          <aside class="ipor-action">
            <div class="ipor-action-tabs">
              <button class="${withdrawMode ? '' : 'active'}" data-ipor-mode="deposit">Deposit</button>
              <button class="${withdrawMode ? 'active' : ''}" data-ipor-mode="withdraw">Withdraw</button>
            </div>
            ${capacityRemaining ? `
              <div class="ipor-capacity-card">
                <strong>${capacityRemaining}</strong>
                <div><i style="width: ${capacityPercent}%"></i></div>
                <span>${depositsLabel || ''}</span><span>${maxCapacityLabel || ''}</span>
              </div>
            ` : ''}
            <div class="ipor-action-card">
              <h2>↓ ${withdrawMode ? 'Withdraw' : 'Deposit'}</h2>
              <p>${page.withdrawalLabel || 'Withdraw through vault'}</p>
              <a href="${page.externalUrl}" target="_blank" rel="noreferrer">${page.feeLabel || 'Learn about the fees'} ↗</a>
              <div class="ipor-input-card">
                <div><span>Amount</span><small>Available: ${vaultBalance}</small></div>
                <label>
                  <input data-live-field="ipor-amount" inputmode="decimal" placeholder="0" value="${fieldDrafts[`${page.id}:ipor-amount`] || ''}" />
                  <strong>${assetIcon(page.asset)} ${page.asset}</strong>
                </label>
                <div class="ipor-percents"><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
              </div>
              <div class="ipor-deposit-row"><span>No Slippage</span><span>Direct Deposit</span></div>
              <div class="ipor-net-card"><span>Net ${withdrawMode ? 'withdraw' : 'deposit'}</span><strong>0.00 ${assetIcon(page.asset)} ${page.asset}</strong><small>~$0.00</small></div>
              <div class="ipor-step"><span class="done">1</span><i></i><span>2</span></div>
              <div class="tx-row ipor-buttons">
                <button class="${actionButtonClass(page.id, 'supply', 'deposit', 'deposit')}" data-live-deposit="${page.id}" data-live-role="ipor" data-live-vault="${page.contractAddress}" data-live-field-name="ipor-amount">${primaryActionLabel}</button>
                <button class="${actionButtonClass(page.id, 'supply', 'withdraw', 'deposit')}" data-live-withdraw="${page.id}" data-live-role="ipor" data-live-vault="${page.contractAddress}" data-live-field-name="ipor-amount">${secondaryActionLabel}</button>
              </div>
              ${notice ? `<div class="action-notice">${notice}</div>` : ''}
            </div>
            <div class="ipor-side-card">${metric('My Deposit', page.myDeposit || withdrawCapacityFor(page.contractAddress, page.asset))}${page.myDepositUnit ? `<small>${page.myDepositUnit}</small>` : ''}</div>
          </aside>
        </div>
        ${renderIporMarketDetailsModal(page, apy, assets)}
      </main>
    </div>
  `;
}

function renderDeveloperMarket(page) {
  const position = simulatedPosition(page);
  const supplied = formatAmount(position?.supplied || 0);
  const borrowed = formatAmount(position?.borrowed || 0);
  const ltv = Number(position?.ltv || 0);
  const ltvDisplay = `${ltv.toFixed(2)}%`;
  const ltvWidth = `${Math.min(100, ltv).toFixed(2)}%`;

  return `
    ${renderPageTitle(page)}
    <div class="page-grid market-layout">
      <div class="left-stack">
        ${renderCard('Developer Simulation', `
          <div class="metric-grid">
            ${metric('Mode', 'Local browser simulation')}
            ${metric('Network', page.network)}
            ${metric('Address', page.contractAddress ? shortAddress(page.contractAddress) : 'Not available')}
            ${metric('Storage', 'session/local')}
          </div>
        `)}
        ${renderCard('Simulated Position', `
          <div class="metric-grid">
            ${metric(`Supplied ${page.collateral}`, supplied)}
            ${metric(`Borrowed ${page.debt}`, borrowed)}
            ${metric('LTV', ltvDisplay)}
            ${metric('Route', `#/dev/${page.id}`)}
          </div>
        `)}
      </div>
      <aside class="action-panel">
        <div class="tabs action-tabs">
          <button class="active">Sim Borrow</button>
        </div>
        <div class="field-card">
          <div class="field-top"><span>Supply ${page.collateral}</span><span>${page.subtitle}</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-sim-field="collateral" inputmode="decimal" placeholder="0.00" />
            <span>${assetIcon(page.collateral, 'gold')}${page.collateral}</span>
          </div>
          <div class="field-bottom"><span>Sim supplied: ${supplied}</span><span>${page.collateral}</span></div>
        </div>
        <div class="field-card">
          <div class="field-top"><span>Borrow ${page.debt}</span><span>${page.subtitle}</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-sim-field="borrow" inputmode="decimal" placeholder="0.00" />
            <span>${assetIcon(page.debt)}${page.debt}</span>
          </div>
          <div class="field-bottom"><span>Sim borrowed: ${borrowed}</span><span>${page.debt}</span></div>
        </div>
        <button class="accept" data-sim-market="${page.id}">Simulate Borrow</button>
        ${position ? `<button class="ghost-action" data-sim-reset="${page.id}">Reset Simulation</button>` : ''}
      </aside>
    </div>
  `;
}

function renderDeveloperEarn(page) {
  const position = simulatedPosition(page);
  const supplied = formatAmount(position?.supplied || 0);

  return `
    ${renderPageTitle(page)}
    <div class="page-grid earn-layout">
      <div class="left-stack">
        ${renderCard('Developer Simulation', `
          <div class="metric-grid">
            ${metric('Mode', 'Local browser simulation')}
            ${metric('Network', page.network)}
            ${metric('Address', page.contractAddress ? shortAddress(page.contractAddress) : 'Not available')}
            ${metric('Route', `#/dev/${page.id}`)}
          </div>
        `)}
        ${renderCard('Simulated Position', `
          <div class="metric-grid">
            ${metric(`Supplied ${page.asset}`, supplied)}
            ${metric('Storage', 'session/local')}
          </div>
        `)}
      </div>
      <aside class="action-panel earn-panel">
        <div class="apy-head"><span>Supply Simulator</span><strong>${page.asset}</strong></div>
        <div class="field-card">
          <div class="field-top"><span>Supply amount</span></div>
          <div class="amount-row sim-input-row">
            <input class="sim-input" data-sim-field="earn" inputmode="decimal" placeholder="0.00" />
            <span>${assetIcon(page.asset)}${page.asset}</span>
          </div>
          <div class="field-bottom"><span>Sim supplied: ${supplied}</span><span>${page.asset}</span></div>
        </div>
        <button class="accept" data-sim-earn="${page.id}">Simulate Supply</button>
        ${position ? `<button class="ghost-action" data-sim-reset="${page.id}">Reset Simulation</button>` : ''}
      </aside>
    </div>
  `;
}

function render() {
  const page = currentPage();
  const route = currentRoute();
  if (page.type === 'home') {
    root.innerHTML = renderCurveYieldHome(page);
    bindEvents();
    return;
  }
  if (page.type === 'ipor-vault-list') {
    root.innerHTML = renderIporVaultList(page);
    bindEvents();
    refreshWalletConnection();
    return;
  }
  if (page.type === 'ipor-vault') {
    root.innerHTML = renderIporVault(page);
    bindEvents();
    refreshWalletConnection();
    ensurePageWalletNetwork(page);
    refreshWalletBalancesForPage(page);
    return;
  }
  const content = route.isDeveloper && productionModeEnabled
    ? renderExplore(EXPLORE_PAGE)
    : route.isDeveloper
    ? (page.type === 'diagnostics' ? renderDiagnostics() : page.type === 'earn' ? renderDeveloperEarn(page) : page.type === 'liquidator' ? renderLiquidator(page) : renderDeveloperMarket(page))
    : (page.type === 'portfolio-position' ? renderPortfolioPosition(page) : page.type === 'portfolio-action' ? renderPortfolioAction(page) : page.type === 'portfolio' ? renderPortfolio(page) : page.type === 'explore' ? renderExplore(page) : page.type === 'earn' ? renderEarn(page) : page.type === 'liquidator' ? renderLiquidator(page) : renderMarket(page));
  root.innerHTML = `
    <div class="app-shell">
      ${renderHeader(page)}
      <main class="container ${page.type}-page">
        ${renderChainWarning(page)}
        ${content}
      </main>
      ${renderInfoModal(page)}
    </div>
  `;
  bindEvents();
  refreshWalletConnection();
  ensurePageWalletNetwork(page);
  refreshWalletBalancesForPage(page);
  if (page.id === 'arb-easy-liquidations' && !liquidationRiskState.updatedAt && !liquidationRiskRefreshStarted) {
    window.setTimeout(() => refreshLiquidationRisk(), 0);
  }
}

function bindEvents() {
  document.querySelectorAll('.back').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.hash = `#/${DEFAULT_PAGE_ID}`;
      }
    });
  });

  document.querySelectorAll('[data-live-field]').forEach((input) => {
    input.addEventListener('input', () => {
      fieldDrafts[`${currentPage().id}:${input.dataset.liveField}`] = input.value;
      if (input.dataset.liveField !== 'collateral-amount') return;
      window.clearTimeout(fieldDraftRenderTimer);
      fieldDraftRenderTimer = window.setTimeout(() => render(), 120);
    });
  });

  document.querySelector('[data-explore-search]')?.addEventListener('input', (event) => {
    exploreSearchText = event.target.value || '';
    window.sessionStorage.setItem('curveyield.euler.exploreSearch', exploreSearchText);
    window.clearTimeout(fieldDraftRenderTimer);
    fieldDraftRenderTimer = window.setTimeout(() => render(), 120);
  });

  document.querySelectorAll('[data-chain-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const chain = getChainById(button.dataset.chainId);
      selectedChainId = chain.id;
      window.sessionStorage.setItem('curveyield.euler.selectedChain', selectedChainId);
      render();
    });
  });

  document.querySelector('[data-wallet-connect]')?.addEventListener('click', () => {
    connectWallet();
  });

  document.querySelector('[data-wallet-change]')?.addEventListener('click', () => {
    connectWallet({ change: true });
  });

  document.querySelector('[data-wallet-disconnect]')?.addEventListener('click', () => {
    disconnectWallet();
  });

  document.querySelectorAll('[data-ipor-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      actionModes[`${currentPage().id}:supply`] = button.dataset.iporMode;
      render();
    });
  });

  document.querySelectorAll('[data-ipor-chart]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.iporChart || 'apy';
      if (iporPerformanceModes.has(mode)) {
        iporPerformanceModes.delete(mode);
      } else {
        iporPerformanceModes.add(mode);
      }
      if (!iporPerformanceModes.size) iporPerformanceModes.add(mode);
      window.sessionStorage.setItem('curveyield.ipor.performanceModes', [...iporPerformanceModes].join(','));
      render();
    });
  });

  document.querySelectorAll('[data-info-kind]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      activeInfo = button.dataset.infoKind;
      render();
    });
  });

  document.querySelectorAll('[data-close-info]').forEach((element) => {
    element.addEventListener('click', () => {
      activeInfo = null;
      render();
    });
  });

  document.querySelectorAll('[data-stop-close]').forEach((element) => {
    element.addEventListener('click', (event) => event.stopPropagation());
  });

  document.querySelectorAll('[data-live-deposit]').forEach((button) => {
    button.addEventListener('click', async () => {
      const pageId = button.dataset.liveDeposit;
      const page = pageForActionId(pageId);
      if (switchActionModeOnly(pageId, 'supply', 'deposit')) return;
      const liveVault = liveVaultForAction(page, button.dataset.liveVault, button.dataset.liveRole);
      const amountText = document.querySelector(`[data-live-field="${button.dataset.liveFieldName}"]`)?.value || '';
      try {
        actionNotices[pageId] = 'Preparing deposit transaction...';
        render();
        const hash = await depositToVault({
          vault: liveVault,
          marketDebtVault: button.dataset.liveDebtVault,
          positionAccount: button.dataset.liveAccount,
          amountText,
          chainId: page.chainId,
          onTransactionStep: (step) => setTxStepNotice(pageId, step),
          onPreflight: (preflight) => setPreflightNotice(pageId, preflight),
        });
        actionNotices[pageId] = `Deposit submitted: ${shortAddress(hash)}`;
        render();
        await waitForTransaction(hash);
        invalidateWalletBalance(liveVault);
        invalidateWithdrawCapacity(liveVault);
        invalidateBorrowCapacity(liveVault);
        invalidatePageBorrowCapacity(page.marketPageId || pageId);
        invalidateAccountLtv(button.dataset.liveDebtVault);
        actionNotices[pageId] = 'Deposit confirmed. Refreshing live stats...';
        render();
        await refreshStatsAfterBalanceChange(page.marketPageId || pageId);
        actionNotices[pageId] = `Deposit confirmed: ${shortAddress(hash)}`;
      } catch (error) {
        actionNotices[pageId] = normalizeTransactionError(error) || 'Deposit failed.';
      }
      render();
    });
  });

  document.querySelectorAll('[data-fill-max]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.querySelector(`[data-live-field="${button.dataset.fillMax}"]`);
      if (button.dataset.fillValue && input) {
        input.value = button.dataset.fillValue;
        fieldDrafts[`${currentPage().id}:${button.dataset.fillMax}`] = input.value;
        render();
        return;
      }
      const balance = walletBalances[button.dataset.fillVault?.toLowerCase()];
      if (!balance || !input) return;
      input.value = balance.formatted.replace(/\.?0+$/, '');
      fieldDrafts[`${currentPage().id}:${button.dataset.fillMax}`] = input.value;
      render();
    });
  });

  document.querySelectorAll('[data-live-withdraw]').forEach((button) => {
    button.addEventListener('click', async () => {
      const pageId = button.dataset.liveWithdraw;
      const page = pageForActionId(pageId);
      if (page.type !== 'portfolio-action' && switchActionModeOnly(pageId, 'supply', 'withdraw')) return;
      const liveVault = liveVaultForAction(page, button.dataset.liveVault, button.dataset.liveRole);
      const amountText = document.querySelector(`[data-live-field="${button.dataset.liveFieldName}"]`)?.value || '';
      try {
        actionNotices[pageId] = 'Preparing withdraw transaction...';
        render();
        const isPositionCollateralWithdraw = button.dataset.liveRole === 'collateral' && Boolean(button.dataset.liveDebtVault);
        const hash = isPositionCollateralWithdraw
          ? await withdrawCollateralFromPosition({
            collateralVault: liveVault,
            debtVault: button.dataset.liveDebtVault,
            positionAccount: button.dataset.liveAccount,
            amountText,
            chainId: page.chainId,
            onPreflight: (preflight) => setPreflightNotice(pageId, preflight),
          })
          : await withdrawFromVault({
            vault: liveVault,
            marketDebtVault: button.dataset.liveDebtVault,
            amountText,
            chainId: page.chainId,
            useEvcBatch: button.dataset.liveRole !== 'earn',
            onPreflight: (preflight) => setPreflightNotice(pageId, preflight),
          });
        actionNotices[pageId] = `Withdraw submitted: ${shortAddress(hash)}`;
        render();
        await waitForTransaction(hash);
        invalidateWalletBalance(liveVault);
        invalidateWithdrawCapacity(liveVault);
        invalidateBorrowCapacity(liveVault);
        invalidatePageBorrowCapacity(page.marketPageId || pageId);
        invalidateAccountLtv(button.dataset.liveDebtVault);
        actionNotices[pageId] = 'Withdraw confirmed. Refreshing live stats...';
        render();
        await refreshStatsAfterBalanceChange(page.marketPageId || pageId);
        actionNotices[pageId] = `Withdraw confirmed: ${shortAddress(hash)}`;
      } catch (error) {
        actionNotices[pageId] = normalizeTransactionError(error) || 'Withdraw failed.';
      }
      render();
    });
  });

  document.querySelectorAll('[data-live-borrow]').forEach((button) => {
    button.addEventListener('click', async () => {
      const pageId = button.dataset.liveBorrow;
      const page = pageForActionId(pageId);
      if (switchActionModeOnly(pageId, 'debt', 'borrow')) return;
      const amountText = document.querySelector(`[data-live-field="${button.dataset.liveFieldName}"]`)?.value || '';
      try {
        actionNotices[pageId] = 'Preparing borrow transaction...';
        render();
        const hash = await borrowFromMarket({
          debtVault: button.dataset.liveDebtVault,
          collateralVault: button.dataset.liveCollateralVault,
          amountText,
          collateralAmountText: document.querySelector('[data-live-field="collateral-amount"]')?.value || '',
          chainId: page.chainId,
          onTransactionStep: (step) => setTxStepNotice(pageId, step),
          onPreflight: (preflight) => setPreflightNotice(pageId, preflight),
        });
        invalidateBorrowCapacity(button.dataset.liveDebtVault);
        invalidateRepayCapacity(button.dataset.liveDebtVault);
        invalidateWalletBalance(button.dataset.liveDebtVault);
        invalidateAccountLtv(button.dataset.liveDebtVault);
        actionNotices[pageId] = `Borrow submitted: ${shortAddress(hash)}`;
        render();
        await waitForTransaction(hash);
        actionNotices[pageId] = 'Borrow confirmed. Refreshing live stats...';
        await refreshStatsAfterBalanceChange(pageId);
        actionNotices[pageId] = `Borrow confirmed: ${shortAddress(hash)}`;
      } catch (error) {
        actionNotices[pageId] = normalizeTransactionError(error) || 'Borrow failed.';
      }
      render();
    });
  });

  document.querySelectorAll('[data-live-borrow-more]').forEach((button) => {
    button.addEventListener('click', async () => {
      const pageId = button.dataset.liveBorrowMore;
      const page = pageForActionId(pageId);
      const market = page.type === 'portfolio-action' ? getPageById(page.marketPageId) : page;
      const amountText = document.querySelector(`[data-live-field="${button.dataset.liveFieldName}"]`)?.value || '';
      try {
        actionNotices[pageId] = 'Preparing borrow-more transaction...';
        render();
        const otherCollateralVaults = PAGES
          .filter((item) => item.type === 'market' && item.chainId === market.chainId)
          .map((item) => item.collateralVaultAddress)
          .filter(Boolean);
        const hash = await borrowMoreFromPosition({
          debtVault: button.dataset.liveDebtVault,
          collateralVault: button.dataset.liveCollateralVault,
          otherCollateralVaults,
          positionAccount: button.dataset.liveAccount,
          amountText,
          chainId: market.chainId,
          onTransactionStep: (step) => setTxStepNotice(pageId, step),
          onPreflight: (preflight) => setPreflightNotice(pageId, preflight),
        });
        invalidateBorrowCapacity(button.dataset.liveDebtVault);
        invalidateRepayCapacity(button.dataset.liveDebtVault);
        invalidateWalletBalance(button.dataset.liveDebtVault);
        invalidateAccountLtv(button.dataset.liveDebtVault);
        actionNotices[pageId] = `Borrow-more submitted: ${shortAddress(hash)}`;
        render();
        await waitForTransaction(hash);
        actionNotices[pageId] = 'Borrow-more confirmed. Refreshing live stats...';
        await refreshStatsAfterBalanceChange(market.id);
        actionNotices[pageId] = `Borrow-more confirmed: ${shortAddress(hash)}`;
      } catch (error) {
        actionNotices[pageId] = normalizeTransactionError(error) || 'Borrow more failed.';
      }
      render();
    });
  });

  document.querySelectorAll('[data-live-repay]').forEach((button) => {
    button.addEventListener('click', async () => {
      const pageId = button.dataset.liveRepay;
      const page = pageForActionId(pageId);
      if (page.type !== 'portfolio-action' && switchActionModeOnly(pageId, 'debt', 'repay')) return;
      const amountText = document.querySelector(`[data-live-field="${button.dataset.liveFieldName}"]`)?.value || '';
      try {
        actionNotices[pageId] = 'Preparing repay transaction...';
        render();
        const hash = await repayToMarket({
          debtVault: button.dataset.liveDebtVault,
          collateralVault: button.dataset.liveCollateralVault,
          positionAccount: button.dataset.liveAccount,
          amountText,
          chainId: page.chainId,
          onPreflight: (preflight) => setPreflightNotice(pageId, preflight),
        });
        invalidateBorrowCapacity(button.dataset.liveDebtVault);
        invalidateRepayCapacity(button.dataset.liveDebtVault);
        invalidateWalletBalance(button.dataset.liveDebtVault);
        invalidateAccountLtv(button.dataset.liveDebtVault);
        actionNotices[pageId] = `Repay submitted: ${shortAddress(hash)}`;
        render();
        await waitForTransaction(hash);
        actionNotices[pageId] = 'Repay confirmed. Refreshing live stats...';
        await refreshStatsAfterBalanceChange(page.marketPageId || pageId);
        actionNotices[pageId] = `Repay confirmed: ${shortAddress(hash)}`;
      } catch (error) {
        actionNotices[pageId] = normalizeTransactionError(error) || 'Repay failed.';
      }
      render();
    });
  });

  document.querySelectorAll('[data-live-liquidate]').forEach((button) => {
    button.addEventListener('click', async () => {
      const pageId = button.dataset.liveLiquidate;
      const page = getPageById(pageId);
      try {
        actionNotices[pageId] = 'Preparing liquidation transaction...';
        render();
        const marketNumber = Number(document.querySelector('[data-liquidation-market]')?.value || '0');
        const borrower = document.querySelector('[data-liquidation-borrower]')?.value || '';
        const hash = await executeLiquidation({
          liquidator: page.contractAddress,
          chainId: page.chainId,
          borrower,
          marketNumber,
          onPreflight: (preflight) => setPreflightNotice(pageId, preflight),
        });
        actionNotices[pageId] = `Liquidation submitted: ${shortAddress(hash)}`;
      } catch (error) {
        actionNotices[pageId] = normalizeTransactionError(error) || 'Liquidation failed.';
      }
      render();
    });
  });

  document.querySelector('[data-refresh-liquidation-risk]')?.addEventListener('click', () => {
    refreshLiquidationRisk({ manual: true });
  });

  document.querySelector('[data-dev-toggle]')?.addEventListener('click', () => {
    developerMenuEnabled = !developerMenuEnabled;
    window.sessionStorage.setItem('curveyield.euler.devMenu', developerMenuEnabled ? '1' : '0');
    render();
  });

  document.querySelectorAll('[data-sim-market]').forEach((button) => {
    button.addEventListener('click', () => {
      const page = getPageById(button.dataset.simMarket);
      const collateralAmount = document.querySelector('[data-sim-field="collateral"]')?.value || '';
      const borrowAmount = document.querySelector('[data-sim-field="borrow"]')?.value || '';
      saveSimulationState(applyMarketSimulation(simulationState, {
        pageId: page.id,
        collateralSymbol: page.collateral,
        debtSymbol: page.debt,
        collateralAmount,
        borrowAmount,
        collateralPrice: contractValue(page, 'price'),
      }));
    });
  });

  document.querySelectorAll('[data-sim-earn]').forEach((button) => {
    button.addEventListener('click', () => {
      const page = getPageById(button.dataset.simEarn);
      const amount = document.querySelector('[data-sim-field="earn"]')?.value || '';
      saveSimulationState(applyEarnSimulation(simulationState, {
        pageId: page.id,
        asset: page.asset,
        amount,
      }));
    });
  });

  document.querySelectorAll('[data-sim-reset]').forEach((button) => {
    button.addEventListener('click', () => resetSimulation(button.dataset.simReset));
  });
}

window.addEventListener('hashchange', render);
if (window.ethereum?.on) {
  window.ethereum.on('chainChanged', () => {
    walletNetworkSwitchRequests.clear();
    for (const key of Object.keys(walletNetworkNotices)) delete walletNetworkNotices[key];
    clearWalletDerivedState();
    render();
  });
  window.ethereum.on('accountsChanged', (accounts = []) => {
    resetWalletConnectionCache();
    walletDisconnected = false;
    window.sessionStorage.removeItem('curveyield.euler.walletDisconnected');
    setConnectedWalletAccount(accounts?.[0] || '');
    walletConnectionLoaded = true;
    render();
  });
}
Promise.all([hydrateLiveMetrics(), hydrateApyState()]).then(() => {
  render();
  refreshApyOnce();
  refreshLiveMetricsOnce();
});

