import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(sourceDir, '..');
const workflowRoot = existsSync(join(repoRoot, '.github', 'workflows', 'refresh-live-metrics.yml')) ? repoRoot : join(repoRoot, '..');
const mainSource = readFileSync(join(sourceDir, 'main.js'), 'utf8');
const eulerLiveSource = readFileSync(join(sourceDir, 'eulerLive.js'), 'utf8');
const defillamaSource = readFileSync(join(sourceDir, 'defillama.js'), 'utf8');
const pagesSource = readFileSync(join(sourceDir, 'config', 'pages.js'), 'utf8');
const assetsSource = readFileSync(join(sourceDir, 'config', 'assets.js'), 'utf8');
const liquidationRiskSource = readFileSync(join(sourceDir, 'liquidationRisk.js'), 'utf8');
const stylesSource = readFileSync(join(sourceDir, 'styles.css'), 'utf8');
const cacheConfigSource = readFileSync(join(repoRoot, 'public', 'data', 'live-metrics-cache-config.json'), 'utf8');
const refreshWorkflowSource = readFileSync(join(workflowRoot, '.github', 'workflows', 'refresh-live-metrics.yml'), 'utf8');
const refreshScriptSource = readFileSync(join(workflowRoot, 'tools', 'refresh-live-metrics-cache.mjs'), 'utf8');
const routeAuditSource = readFileSync(join(repoRoot, 'tools', 'route-audit-cdp.cjs'), 'utf8');

test('portfolio UI does not show heuristic APY/ROE or Unknown placeholders', () => {
  assert.equal(mainSource.includes('computedEarnSupplyApy(page)'), false);
  assert.equal(mainSource.includes('positionNetApy('), false);
  assert.equal(mainSource.includes('positionRoe('), false);
  assert.equal(mainSource.includes('risk-unknown">Unknown'), false);
});

test('position and token views reuse live market APY and price formatters', () => {
  assert.equal(mainSource.includes("currentSupplyApyTotal(market)"), true);
  assert.equal(mainSource.includes("`$${contractValue(page, 'price')}`"), false);
  assert.equal(mainSource.includes('dollarDisplay(collateralPrice)'), true);
});

test('live refresh loads market APYs before Earn vault APY weighting', () => {
  assert.equal(mainSource.includes('const refreshRank = { market: 0, earn: 1'), true);
  assert.equal(mainSource.includes('const activePageId = currentRoute().pageId'), true);
  assert.equal(mainSource.includes('livePages.sort((a, b) =>'), true);
});

test('Earn vault APY uses live allocation supply APYs and exposes market borrow APYs', () => {
  assert.equal(eulerLiveSource.includes('const earnSupplyApy = calculateWeightedEarnSupplyApy(earnAllocations, vault.totalAssets ?? 0n);'), true);
  assert.equal(eulerLiveSource.includes('supplyApy: earnSupplyApy,'), true);
  assert.equal(eulerLiveSource.includes('const borrowApy = interestRateRaw ? apyFromInterestRate'), true);
  assert.equal(eulerLiveSource.includes('const supplyApy = supplyApyFromBorrow'), true);
  assert.equal(mainSource.includes("supplyApy: allocation.supplyApy || (market ? contractValue(market, 'debtSupplyApy') : 'N/A')"), true);
  assert.equal(mainSource.includes("const liveBorrowApy = allocation?.borrowApy || contractValue(market, 'borrowApy')"), true);
  assert.equal(mainSource.includes('<small>Borrow APY</small><strong class=\"accent\">${exposureRowApy(page, row)}</strong>'), true);
});

test('Earn allocation conversion retries missing RPC batch results', () => {
  assert.equal(eulerLiveSource.includes('allocationAssetsByIndex'), true);
  assert.equal(eulerLiveSource.includes('if (!raw) raw = await safeEthCall(entry.call.to, entry.call.data'), true);
  assert.equal(eulerLiveSource.includes('resilientEthBatch(shareCalls, rpcUrl, 2, page.chainId)'), true);
  assert.equal(eulerLiveSource.includes('resilientEthBatch(configCalls, rpcUrl, 2, page.chainId)'), true);
});

test('live metric snapshots hydrate long enough to work as last-good shared cache', () => {
  assert.equal(mainSource.includes('const LIVE_METRICS_MAX_AGE_MS = 86_400_000'), true);
  assert.equal(mainSource.includes('bundled,'), true);
  assert.equal(mainSource.includes('remote: freshLiveMetricsOnly(remote)'), true);
  assert.equal(mainSource.includes('freshLiveMetricsOnly(local)'), true);
});

test('successful live metric snapshots are wired to a shared remote cache writer', () => {
  assert.equal(mainSource.includes('loadLiveMetricsRemoteConfig'), true);
  assert.equal(mainSource.includes('publishRemoteLiveMetrics'), true);
  assert.equal(mainSource.includes('scheduleRemoteLiveMetricsPublish();'), true);
  assert.equal(mainSource.includes('if (!liveMetricsRemoteConfig?.writeUrl) return;'), true);
  assert.equal(mainSource.includes('publishRemoteLiveMetrics(window.fetch.bind(window), window.localStorage, liveMetrics, liveMetricsRemoteConfig)'), true);
});

test('shared live metrics cache is refreshed by GitHub cron instead of browser writes', () => {
  assert.equal(cacheConfigSource.includes('https://raw.githubusercontent.com/CurveYield/dApp/main/public/data/live-metrics-cache.json'), true);
  assert.equal(cacheConfigSource.includes('"writeUrl": ""'), true);
  assert.equal(refreshWorkflowSource.includes("cron: '0 */2 * * *'"), true);
  assert.equal(refreshWorkflowSource.includes('node tools/refresh-live-metrics-cache.mjs'), true);
  assert.equal(refreshWorkflowSource.includes('public/data/live-metrics-cache.json'), true);
  assert.equal(refreshWorkflowSource.includes('github-actions[bot]'), true);
  assert.equal(refreshScriptSource.includes("new URL('../public/data/live-metrics-cache.json', import.meta.url)"), true);
});

test('debt token pages use contract-derived debt token price for dollar values', () => {
  assert.equal(eulerLiveSource.includes('debtPrice:'), true);
  assert.equal(mainSource.includes("const debtPrice = contractValue(page, 'debtPrice') || '$1.00';"), true);
  assert.equal(mainSource.includes("pageTokenValueMetric(page, 'availableLiquidity', debtPrice, '$0')"), true);
});

test('collateral token pages use contract-derived collateral USD price for dollar values', () => {
  assert.equal(eulerLiveSource.includes('collateralPrice:'), true);
  assert.equal(mainSource.includes("const collateralPrice = contractValue(page, 'collateralPrice') || contractValue(page, 'price');"), true);
  assert.equal(mainSource.includes("tokenUnitsToDollarMetric(totalSupply, collateralPrice, '$0')"), true);
});

test('wallet header uses live provider state instead of hardcoded wallet text', () => {
  assert.equal(mainSource.includes('0x9f2B...E288'), false);
  assert.equal(mainSource.includes('function renderWalletControl()'), true);
  assert.equal(mainSource.includes('data-wallet-connect'), true);
  assert.equal(mainSource.includes('data-wallet-change'), true);
  assert.equal(mainSource.includes('clearWalletDerivedState()'), true);
});

test('wallet header keeps the original pill format instead of adding a custom menu layout', () => {
  assert.equal(mainSource.includes('class="wallet-menu"'), false);
  assert.equal(mainSource.includes('wallet-menu-panel'), false);
  assert.equal(stylesSource.includes('.wallet-menu'), false);
  assert.equal(mainSource.includes('class="pill address"'), true);
});

test('market pair detail page keeps live Euler pair-level sections only', () => {
  const marketStart = mainSource.indexOf('function renderMarket(page)');
  const marketEnd = mainSource.indexOf('function renderEarn(page)');
  const renderMarketSource = mainSource.slice(marketStart, marketEnd);
  for (const label of ['Overview', 'Oracles']) {
    assert.equal(renderMarketSource.includes(`renderCard('${label}'`), true, `${label} card missing from pair page`);
  }
  for (const label of ['Statistics', 'Risk parameters', 'Collateral exposure', 'Interest rate model', 'Addresses']) {
    assert.equal(renderMarketSource.includes(`renderCard('${label}'`), false, `${label} belongs on token subpages, not the pair page`);
  }
  assert.equal(renderMarketSource.includes('button class="disabled-action-tab" disabled'), true);
});

test('collateral APY path keeps existing collateral intrinsic APY combination', () => {
  assert.equal(mainSource.includes("return combinedSupplyApy(contractValue(page, 'supplyApy'), intrinsicApyFor(page.chainId, page.collateral));"), true);
  assert.equal(mainSource.includes("suppliedAsset = page.type === 'market' ? page.collateral : page.asset"), true);
  assert.equal(mainSource.includes("total: combinedSupplyApy(lending, intrinsic)"), true);
});

test('Euler borrow and IRM rates use compounded SPY APY without changing collateral APYs', () => {
  assert.equal(eulerLiveSource.includes('export function apyFromInterestRate(rate)'), true);
  assert.equal(eulerLiveSource.includes('const borrowApy = apyFromInterestRate(debtVault.interestRate);'), true);
  assert.equal(eulerLiveSource.includes('irmBaseRate: apyFromInterestRate(base)'), true);
  assert.equal(eulerLiveSource.includes('const rateAtKink = base + (firstSlope * kinkValue);'), true);
  assert.equal(eulerLiveSource.includes('const maxRate = rateAtKink + (secondSlope * (UINT32_MAX - kinkValue));'), true);
  assert.equal(eulerLiveSource.includes('irmRateAtKink: apyFromInterestRate(rateAtKink)'), true);
  assert.equal(eulerLiveSource.includes('irmMaxRate: apyFromInterestRate(maxRate)'), true);
});

test('Euler risk caps and risk manager are read from live vault configuration', () => {
  assert.equal(eulerLiveSource.includes("governorAdmin: '0x6ce98c29'"), true);
  assert.equal(eulerLiveSource.includes("dToken: '0xd9d7858a'"), true);
  assert.equal(eulerLiveSource.includes('{ to: debtVaultAddress, data: SELECTORS.governorAdmin }'), true);
  assert.equal(eulerLiveSource.includes('{ to: debtVaultAddress, data: SELECTORS.dToken }'), true);
  assert.equal(eulerLiveSource.includes('riskManager: governorRaw ? decodeAddress(governorRaw) : null'), true);
  assert.equal(eulerLiveSource.includes('debtTokenAddress: debtTokenRaw ? decodeAddress(debtTokenRaw) : null'), true);
  assert.equal(eulerLiveSource.includes('formatOptionalResolvedUsdCap(supplyCapRaw, debtVault.decimals, debtUsdPriceRaw, debtVault.totalSupply)'), true);
  assert.equal(eulerLiveSource.includes('formatOptionalResolvedUsdCap(collateralSupplyCapRaw, collateralVault.decimals, collateralUsdPriceRaw, collateralVault.totalSupply)'), true);
  assert.equal(eulerLiveSource.includes('formatOptionalResolvedUsdCap(borrowCapRaw, debtVault.decimals, debtUsdPriceRaw, debtVault.totalBorrows)'), true);
  assert.equal(mainSource.includes("return contractValue(page, 'riskManager') || '';"), true);
  assert.equal(mainSource.includes("const debtTokenAddress = contractAddressValue(page, 'debtTokenAddress') || actionVault;"), true);
});

test('explore page keeps functional search without inactive filter controls', () => {
  assert.equal(mainSource.includes('placeholder="Search by asset, market, curator..."'), true);
  assert.equal(mainSource.includes('data-explore-search'), true);
  assert.equal(mainSource.includes('data-explore-filter'), false);
  assert.equal(stylesSource.includes('explore-filter-group'), false);
});

test('portfolio tabs use Euler naming for deposits and hide rewards', () => {
  const portfolioStart = mainSource.indexOf('function renderPortfolio(page)');
  const portfolioEnd = mainSource.indexOf('function selectedPositionForMarket');
  const renderPortfolioSource = mainSource.slice(portfolioStart, portfolioEnd);
  assert.equal(renderPortfolioSource.includes('Deposits'), true);
  assert.equal(renderPortfolioSource.includes('Savings'), false);
  assert.equal(renderPortfolioSource.includes('Rewards'), false);
});

test('portfolio action max buttons reuse Euler max-link styling', () => {
  const actionStart = mainSource.indexOf('function renderPortfolioAction(page)');
  const actionEnd = mainSource.indexOf('function currentSupplyApyTotal(page)');
  const renderPortfolioActionSource = mainSource.slice(actionStart, actionEnd);
  assert.equal(renderPortfolioActionSource.includes('<button type="button" data-fill-max'), false);
  assert.equal(renderPortfolioActionSource.includes('<button class="max-link" type="button" data-fill-max'), true);
  assert.equal(renderPortfolioActionSource.includes('<b>Max</b>'), true);
});

test('portfolio action widgets use Euler primary button and full-width single action row', () => {
  const actionStart = mainSource.indexOf('function renderPortfolioAction(page)');
  const actionEnd = mainSource.indexOf('function currentSupplyApyTotal(page)');
  const renderPortfolioActionSource = mainSource.slice(actionStart, actionEnd);
  assert.equal(renderPortfolioActionSource.includes('class="primary-btn"'), false);
  assert.equal(renderPortfolioActionSource.includes('class="accept" data-live-repay'), true);
  assert.equal(renderPortfolioActionSource.includes('class="tx-row single-action-row"'), true);
  assert.equal(stylesSource.includes('.single-action-row'), true);
});

test('IPOR is reachable from the brand menu but removed from the top Euler nav', () => {
  const headerStart = mainSource.indexOf('function renderHeader(page)');
  const headerEnd = mainSource.indexOf('function renderExploreGraph');
  const renderHeaderSource = mainSource.slice(headerStart, headerEnd);
  const navStart = renderHeaderSource.indexOf('<nav class="main-nav"');
  const navEnd = renderHeaderSource.indexOf('</nav>', navStart);
  const mainNavSource = renderHeaderSource.slice(navStart, navEnd);
  assert.equal(renderHeaderSource.includes('href="#/ipor-crvusd-lp-vault"'), true);
  assert.equal(mainNavSource.includes('IPOR'), false);
});

test('homepage routes to a compact IPOR vault list with requested columns and rows', () => {
  assert.equal(pagesSource.includes("id: 'fusion-vaults'"), true);
  assert.equal(pagesSource.includes("export const DEFAULT_PAGE_ID = 'home';"), true);
  assert.equal(mainSource.includes('function renderCurveYieldHome'), true);
  assert.equal(mainSource.includes("if (page.type === 'home')"), true);
  assert.equal(mainSource.includes('cy-scrvUSD Euler Vault & Markets'), true);
  assert.equal(pagesSource.includes("type: 'ipor-vault-list'"), true);
  assert.equal(mainSource.includes('<span>IPOR Vaults</span>'), true);
  assert.equal(mainSource.includes('href="#/fusion-vaults"'), true);
  assert.equal(mainSource.includes('function renderIporVaultList(page)'), true);
  assert.equal(mainSource.includes('<span>Chain / Asset</span><span>Vault Name / Strategy</span><span>APY</span><span>TVM</span>'), true);
  assert.equal(mainSource.includes('Atomist'), false);
  assert.equal(mainSource.includes('<span>Incentives</span>'), false);
  assert.equal(pagesSource.includes('CurveYield crvUSD'), true);
  assert.equal(pagesSource.includes('CurveYield CRV'), true);
  assert.equal(pagesSource.includes('18%'), true);
  assert.equal(pagesSource.includes('$1,229'), true);
  assert.equal(pagesSource.includes("logo: './assets/logos/cycrv.png'"), true);
});

test('homepage landing layout uses viewport-safe dynamic sizing', () => {
  const homeSpanRule = stylesSource.match(/\.cy-home-actions span\s*\{[\s\S]*?\}/)?.[0] ?? '';
  assert.equal(stylesSource.includes('min-height: 100svh'), true);
  assert.equal(stylesSource.includes('width: clamp(84px, 18svh, 180px)'), true);
  assert.equal(stylesSource.includes('font-size: clamp(34px, 8svh, 72px)'), true);
  assert.equal(stylesSource.includes('min-height: clamp(48px, 8svh, 78px)'), true);
  assert.equal(homeSpanRule.includes('white-space: nowrap'), false);
});

test('route audit includes screen-size samples for major page designs', () => {
  assert.equal(routeAuditSource.includes('const VIEWPORT_SAMPLES'), true);
  assert.equal(routeAuditSource.includes('const DESIGN_SAMPLE_ROUTES'), true);
  for (const route of ['home', 'fusion-vaults', 'ipor-cycrv-base-vault', 'explore', 'portfolio', 'earn-scrvusd', 'market-1', 'market-1/collateral', 'portfolio-borrow-market-1-0']) {
    assert.equal(routeAuditSource.includes(`'${route}'`), true);
  }
  for (const sample of ['desktop', 'short-laptop', 'mobile']) {
    assert.equal(routeAuditSource.includes(`name: '${sample}'`), true);
  }
});

test('CRV vault list row opens a Base IPOR-style detail page', () => {
  assert.equal(pagesSource.includes("id: 'ipor-cycrv-base-vault'"), true);
  assert.equal(pagesSource.includes('0xc329b45591be3e728d64b7c5475de9e698baeff6'), true);
  assert.equal(pagesSource.includes("chainId: 'base'"), true);
  assert.equal(pagesSource.includes("title: 'Staked CurveYield CRV'"), true);
  assert.equal(pagesSource.includes("asset: 'cyCRV'"), true);
  assert.equal(pagesSource.includes("externalUrl: 'https://app.ipor.io/fusion/base/0xc329b45591be3e728d64b7c5475de9e698baeff6'"), true);
  assert.equal(pagesSource.includes("href: '#/ipor-cycrv-base-vault'"), true);
  assert.equal(pagesSource.includes("withdrawalLabel: 'Withdraw: Scheduled (12 hours)'"), true);
  assert.equal(pagesSource.includes("totalValueManaged: '1,214.89'"), true);
  assert.equal(pagesSource.includes("totalValueLocked: '1,213.89'"), true);
  assert.equal(pagesSource.includes("capacityRemaining: '4,598 cyCRV left before reaching maximum capacity'"), true);
  assert.equal(pagesSource.includes("depositsLabel: 'Deposits: 5,199 cyCRV'"), true);
  assert.equal(pagesSource.includes("maxCapacityLabel: 'Max capacity: 9,797 cyCRV'"), true);
  assert.equal(mainSource.includes('THIS VAULT IS UNVERIFIED.'), false);
  assert.equal(mainSource.includes('PROCEED AT YOUR OWN RISK.'), false);
  assert.equal(mainSource.includes('page.marketRows'), true);
  assert.equal(pagesSource.includes('Switch to Base'), true);
});

test('IPOR vault pages and list rows use live metric keys before configured fallbacks', () => {
  assert.equal(pagesSource.includes("valueDisplaySource: 'ipor-page'"), true);
  assert.equal(eulerLiveSource.includes('totalAssetsUnit'), true);
  assert.equal(eulerLiveSource.includes('totalLockedUnit'), true);
  assert.equal(pagesSource.includes('capacityMaxTokens'), true);
  assert.equal(eulerLiveSource.includes('capacityRemaining'), true);
  assert.equal(mainSource.includes('live.totalValueManaged'), true);
  assert.equal(mainSource.includes('live.totalAssetsUnit'), true);
  assert.equal(mainSource.includes('sourceLive.totalValueManaged'), true);
});

test('Base cyCRV IPOR vault prices live units through the IPOR price oracle middleware', () => {
  assert.equal(eulerLiveSource.includes('RPC_REQUEST_TIMEOUT_MS'), true);
  assert.equal(eulerLiveSource.includes('AbortController'), true);
  assert.equal(eulerLiveSource.includes('getPriceOracleMiddleware'), true);
  assert.equal(eulerLiveSource.includes('getAssetPrice'), true);
  assert.equal(eulerLiveSource.includes('readIporAssetUsdValue'), true);
  assert.equal(eulerLiveSource.includes('assetUsdPrice'), true);
  assert.equal(eulerLiveSource.includes('assetUsdPriceDecimals'), true);
  assert.equal(eulerLiveSource.includes('formatUsdDisplay'), true);
  assert.equal(eulerLiveSource.includes('totalValueManaged: liveUsdValue ||'), true);
  assert.equal(eulerLiveSource.includes('totalValueLocked: liveUsdLocked ||'), true);
});

test('Base cyCRV IPOR vault reads live allocation balances from IPOR market IDs', () => {
  assert.equal(pagesSource.includes("marketId: '11'"), true);
  assert.equal(pagesSource.includes('allocationChart: false'), true);
  assert.equal(pagesSource.includes('remainderOfTotal: true'), true);
  assert.equal(eulerLiveSource.includes('totalAssetsInMarket'), true);
  assert.equal(eulerLiveSource.includes('readIporMarketAllocations'), true);
  assert.equal(eulerLiveSource.includes('allocationHistory'), true);
  assert.equal(mainSource.includes('live.marketRows || page.marketRows'), true);
  assert.equal(mainSource.includes('live.allocationHistory'), true);
});

test('Base cyCRV IPOR vault reads the IPOR history API for live performance chart points', () => {
  assert.equal(eulerLiveSource.includes('IPOR_DATA_API_URL'), true);
  assert.equal(eulerLiveSource.includes('fetchIporVaultHistory'), true);
  assert.equal(eulerLiveSource.includes('/fusion/vaults-history/'), true);
  assert.equal(eulerLiveSource.includes('underlyingAssetApy'), true);
  assert.equal(eulerLiveSource.includes('buildIporPerformanceHistory'), true);
  assert.equal(eulerLiveSource.includes('performanceHistory'), true);
  assert.equal(mainSource.includes('live.performanceHistory'), true);
});

test('IPOR crvUSD page targets the Ethereum CurveYield vault route', () => {
  assert.equal(pagesSource.includes("chainId: 'ethereum'"), true);
  assert.equal(pagesSource.includes('0xE31Aa86e21e420d03E52AaA06C349BDC525a664F'), true);
  assert.equal(pagesSource.includes("shareSymbol: 'cy-crvUSD'"), true);
  assert.equal(pagesSource.includes('crvUSD -> Curve OUSD/crvUSD LP -> StakeDAO OUSD/crvUSD Vault'), true);
  assert.equal(pagesSource.includes('Stake DAO OUSD/crvUSD Vault'), true);
  assert.equal(pagesSource.includes('Curve OUSD/crvUSD'), true);
  assert.equal(mainSource.includes('${chainLogo} ${chain.shortLabel}'), true);
  assert.equal(mainSource.includes('${explorerLabel}'), true);
  assert.equal(mainSource.includes('Credit Markets<small>Effective Leverage 1.00x'), false);
  assert.equal(mainSource.includes('Curve 4poolUSD-f'), false);
  assert.equal(mainSource.includes('Withdraw: Scheduled (12 hours)'), false);
});

test('Euler markets remove Arbitrum xETH and add live scrvUSD cy-crvUSD market', () => {
  for (const source of [pagesSource, assetsSource, defillamaSource, liquidationRiskSource]) {
    assert.equal(source.includes('arb-market-xeth-crvusd'), false);
    assert.equal(source.includes('xETH/crvUSD'), false);
    assert.equal(source.includes('xETH / crvUSD'), false);
  }
  assert.equal(pagesSource.includes("title: 'cy-crvUSD/scrvUSD'"), true);
  assert.equal(pagesSource.includes("collateral: 'cy-crvUSD'"), true);
  assert.equal(pagesSource.includes("cyCrvUsdCollateralVault: '0x78b273f6ae8cc837951136b68ab10f980750e9d9'"), true);
  assert.equal(pagesSource.includes("cyCrvUsdMarketVault: '0x1ba05862e512306ce34bad9847a2c212b443f33e'"), true);
  assert.equal(pagesSource.includes("cyCrvUsdIrm: '0x7ad8e0a0688a9ba8acc20402abd6b528bd9181b8'"), true);
  assert.equal(assetsSource.includes("'cy-crvUSD': './assets/logos/curveyield-512.png'"), true);
  assert.equal(assetsSource.includes("ethereum: '0xE31Aa86e21e420d03E52AaA06C349BDC525a664F'"), true);
  assert.equal(defillamaSource.includes("'cy-crvUSD': { source: 'fixed', apy: 0 }"), true);
});

test('wallet cache can be reset after disconnect or account changes', () => {
  assert.equal(eulerLiveSource.includes('export function resetWalletConnectionCache()'), true);
  assert.equal(eulerLiveSource.includes('export async function requestWalletAccount'), true);
  assert.equal(mainSource.includes('resetWalletConnectionCache();'), true);
});

test('wallet position scans retry individual calls after failed RPC batches', () => {
  assert.equal(eulerLiveSource.includes('async function resilientEthBatch'), true);
  assert.equal(eulerLiveSource.includes('return safeEthCall(calls[index].to, calls[index].data'), true);
  assert.equal(eulerLiveSource.includes('const results = await resilientEthBatch(calls, null, 1, chainId);'), true);
});
