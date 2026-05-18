import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPoolYieldApys, poolYieldKey } from './defillama.js';

test('extracts configured pool yields by exact DeFiLlama pool id', () => {
  const rows = {
    data: [
      { pool: 'ignored', project: 'curve-dex', chain: 'Ethereum', symbol: 'OUSD-CRVUSD', apy: 99 },
      {
        pool: 'aeb52bc8-2eb0-49d9-8571-28290c39a182',
        project: 'stake-dao',
        chain: 'Ethereum',
        symbol: 'OUSD-CRVUSD',
        apyBase: 0.33,
        apyReward: 14.67,
      },
    ],
  };
  const source = {
    id: 'stakedao-ousd-crvusd',
    pool: 'aeb52bc8-2eb0-49d9-8571-28290c39a182',
  };

  const values = extractPoolYieldApys(rows, [source]);

  assert.equal(values[poolYieldKey(source)].formatted, '15.00%');
  assert.equal(values[poolYieldKey(source)].project, 'stake-dao');
});
