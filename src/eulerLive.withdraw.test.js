import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMarketDepositBorrowBatchCalldata,
  buildPositionCollateralWithdrawBatchCalldata,
  ethCall,
  formatTokenAmount,
} from './eulerLive.js';

test('encodes collateral withdraw as the successful Euler EVC batch transaction', () => {
  const actual = buildPositionCollateralWithdrawBatchCalldata({
    collateralVault: '0x6Ae345Ab8b8Bcf31949fF020670036D2184d2452',
    positionAccount: '0x9F2B20A772246960810045905b7DACcF960eE28d',
    receiver: '0x9f2B20A772246960810045905B7daccf960eE288',
    amount: 1000000000000000000n,
  }).toLowerCase();

  assert.equal(actual, '0xc16ae7a40000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000006ae345ab8b8bcf31949ff020670036d2184d24520000000000000000000000009f2b20a772246960810045905b7daccf960ee28d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000064b460af940000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000009f2b20a772246960810045905b7daccf960ee2880000000000000000000000009f2b20a772246960810045905b7daccf960ee28d00000000000000000000000000000000000000000000000000000000');
});

test('encodes new market deposit from wallet into selected Euler subaccount', () => {
  const wallet = '0x9f2B20A772246960810045905B7daccf960eE288';
  const subaccount = '0x9f2B20A772246960810045905b7DACcF960eE28f';
  const collateralVault = '0x8df8031519d47D09CdaC9F64e12277403753101f';
  const debtVault = '0xffBFC21fA9F3ee0B35B45F272fF83B315D5B5680';
  const evc = '0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383';
  const amount = 100000000000000000n;
  const actual = buildMarketDepositBorrowBatchCalldata({
    account: subaccount,
    collateralSourceAccount: wallet,
    collateralVault,
    debtVault,
    evc,
    collateralAmount: amount,
    borrowAmount: 0n,
    borrowReceiver: wallet,
  }).toLowerCase();

  const encodedWallet = wallet.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const encodedSubaccount = subaccount.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const encodedAmount = amount.toString(16).padStart(64, '0');

  assert.equal(actual.includes(encodedWallet), true);
  assert.equal(actual.includes(`6e553f65${encodedAmount}${encodedSubaccount}`), true);
});

test('encodes standalone collateral supply from wallet into existing Euler account', () => {
  const wallet = '0x9f2B20A772246960810045905B7daccf960eE288';
  const position = '0x9f2B20A772246960810045905b7DACcF960eE28a';
  const collateralVault = '0x006e2989B00f2bfe070502B1fE0F5Ae8a007e3a2';
  const debtVault = '0xa264e81dF3C81953eEbae182441811e5CE894632';
  const evc = '0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383';
  const amount = 100000000000000000n;
  const actual = buildMarketDepositBorrowBatchCalldata({
    account: position,
    collateralSourceAccount: wallet,
    collateralVault,
    debtVault,
    evc,
    collateralAmount: amount,
    borrowAmount: 0n,
    borrowReceiver: wallet,
  }).toLowerCase();

  const encodedWallet = wallet.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const encodedPosition = position.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const encodedAmount = amount.toString(16).padStart(64, '0');

  assert.equal(actual.includes(encodedWallet), true);
  assert.equal(actual.includes(`6e553f65${encodedAmount}${encodedPosition}`), true);
});

test('formats tiny nonzero wallet action amounts without rounding to zero', () => {
  assert.equal(formatTokenAmount(1_000_000_000_000n, 18, 4), '0.000001');
  assert.equal(formatTokenAmount(0n, 18, 4), '0.0000');
  assert.equal(formatTokenAmount(2_500_000_000_000_000_000n, 18, 4), '2.5000');
});

test('falls back to connected wallet eth_call when public RPC fetch fails on matching chain', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const calls = [];
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  globalThis.window = {
    ethereum: {
      request: async ({ method, params }) => {
        calls.push({ method, params });
        if (method === 'eth_chainId') return '0x1';
        if (method === 'eth_call') return '0x' + '2a'.padStart(64, '0');
        throw new Error(`Unexpected wallet method ${method}`);
      },
    },
  };

  try {
    const result = await ethCall(
      '0x0000000000000000000000000000000000000001',
      '0x70a08231' + '0'.repeat(64),
      null,
      'ethereum',
    );
    assert.equal(result, '0x' + '2a'.padStart(64, '0'));
    assert.equal(calls.some((call) => call.method === 'eth_call'), true);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});
