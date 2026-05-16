import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const mainSource = readFileSync(join(sourceDir, 'main.js'), 'utf8');
const eulerLiveSource = readFileSync(join(sourceDir, 'eulerLive.js'), 'utf8');
const stylesSource = readFileSync(join(sourceDir, 'styles.css'), 'utf8');

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

test('Earn vault APY uses the same borrower-paid APY shown on market pages', () => {
  assert.equal(mainSource.includes("supplyApy: market ? contractValue(market, 'borrowApy') : 'N/A'"), true);
  assert.equal(mainSource.includes("const liveBorrowApy = contractValue(market, 'borrowApy')"), true);
  assert.equal(mainSource.includes('<small>Borrow APY</small><strong class=\"accent\">${exposureRowApy(page, row)}</strong>'), true);
});

test('Earn allocation conversion retries missing RPC batch results', () => {
  assert.equal(eulerLiveSource.includes('allocationAssetsByIndex'), true);
  assert.equal(eulerLiveSource.includes('if (!raw) raw = await safeEthCall(entry.call.to, entry.call.data'), true);
  assert.equal(eulerLiveSource.includes('resilientEthBatch(shareCalls, rpcUrl, 2, page.chainId)'), true);
  assert.equal(eulerLiveSource.includes('resilientEthBatch(configCalls, rpcUrl, 2, page.chainId)'), true);
});

test('volatile live metrics are not hydrated from stale persisted snapshots', () => {
  assert.equal(mainSource.includes('const LIVE_METRICS_MAX_AGE_MS = 30_000'), true);
  assert.equal(mainSource.includes('bundled,'), true);
  assert.equal(mainSource.includes('...freshLiveMetricsOnly(remote)'), true);
  assert.equal(mainSource.includes('freshLiveMetricsOnly(local)'), true);
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

test('market pair detail page includes Euler-style information sections', () => {
  const marketStart = mainSource.indexOf('function renderMarket(page)');
  const marketEnd = mainSource.indexOf('function renderEarn(page)');
  const renderMarketSource = mainSource.slice(marketStart, marketEnd);
  for (const label of ['Statistics', 'Risk parameters', 'Collateral exposure', 'Interest rate model', 'Addresses']) {
    assert.equal(renderMarketSource.includes(`renderCard('${label}'`), true, `${label} card missing from pair page`);
  }
  assert.equal(renderMarketSource.includes('button class="disabled-action-tab" disabled'), true);
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
