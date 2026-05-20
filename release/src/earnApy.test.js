import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateWeightedEarnSupplyApy } from './eulerLive.js';

test('calculates Earn vault APY from live market allocation weights', () => {
  assert.equal(calculateWeightedEarnSupplyApy([
    { allocationAssets: 1000n * 10n ** 18n, supplyApy: '10.00%' },
    { allocationAssets: 3000n * 10n ** 18n, supplyApy: '20.00%' },
  ]), '17.50%');
});

test('omits zero-allocation unresolved market APYs from Earn vault APY', () => {
  assert.equal(calculateWeightedEarnSupplyApy([
    { allocationAssets: 0n, supplyApy: 'N/A' },
    { allocationAssets: 4000n * 10n ** 18n, supplyApy: '12.34%' },
    { allocationAssets: 0n, supplyApy: '99.00%' },
  ]), '12.34%');
});

test('does not fake Earn APY when an allocated market APY is unresolved', () => {
  assert.equal(calculateWeightedEarnSupplyApy([
    { allocationAssets: 1000n * 10n ** 18n, supplyApy: 'N/A' },
    { allocationAssets: 4000n * 10n ** 18n, supplyApy: '12.34%' },
  ]), 'N/A');
});

test('does not treat missing allocated market APY as zero', () => {
  assert.equal(calculateWeightedEarnSupplyApy([
    { allocationAssetsRaw: (1000n * 10n ** 18n).toString() },
  ]), 'N/A');
});

test('accounts for idle Earn vault assets when weighting APY', () => {
  assert.equal(calculateWeightedEarnSupplyApy([
    { allocationAssets: 500n * 10n ** 18n, supplyApy: '20.00%' },
  ], 1000n * 10n ** 18n), '10.00%');
});
