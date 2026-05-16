import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const mainSource = readFileSync(join(sourceDir, 'main.js'), 'utf8');
const eulerLiveSource = readFileSync(join(sourceDir, 'eulerLive.js'), 'utf8');

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
});

test('volatile live metrics are not hydrated from stale persisted snapshots', () => {
  assert.equal(mainSource.includes('const LIVE_METRICS_MAX_AGE_MS = 30_000'), true);
  assert.equal(mainSource.includes('freshLiveMetricsOnly(remote)'), true);
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
