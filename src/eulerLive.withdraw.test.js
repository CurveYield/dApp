import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMarketDepositBorrowBatchCalldata,
  buildPositionCollateralWithdrawBatchCalldata,
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
