import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadLiveMetricsRemoteConfig,
  loadRemoteLiveMetrics,
  mergeLiveMetricsSources,
  publishRemoteLiveMetrics,
} from './liveMetricsStore.js';

function storage(values = {}) {
  return {
    getItem(key) {
      return values[key] || '';
    },
  };
}

test('loads shared live metric cache config from bundled public config', async () => {
  const fetcher = async (url) => ({
    ok: url === './public/data/live-metrics-cache-config.json',
    async json() {
      return {
        readUrl: 'https://cache.example/live.json',
        writeUrl: 'https://cache.example/live',
        writeMethod: 'PUT',
      };
    },
  });

  assert.deepEqual(await loadLiveMetricsRemoteConfig(fetcher, storage()), {
    readUrl: 'https://cache.example/live.json',
    writeUrl: 'https://cache.example/live',
    writeMethod: 'PUT',
  });
});

test('loads remote live metrics from shared config without device-local setup', async () => {
  const fetcher = async (url) => ({
    ok: true,
    async json() {
      if (url === './public/data/live-metrics-cache-config.json') return { readUrl: 'https://cache.example/live.json' };
      assert.equal(url, 'https://cache.example/live.json');
      return { pages: { 'earn-scrvusd': { supplyApy: '32.99%', updatedAt: 123 } } };
    },
  });

  assert.deepEqual(await loadRemoteLiveMetrics(fetcher, storage()), {
    'earn-scrvusd': { supplyApy: '32.99%', updatedAt: 123 },
  });
});

test('publishes sanitized successful live metric snapshots to shared write endpoint', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return { ok: true };
  };

  const published = await publishRemoteLiveMetrics(fetcher, storage(), {
    'earn-scrvusd': {
      supplyApy: '32.99%',
      totalSupply: '273.16',
      empty: 'Loading...',
      updatedAt: 456,
    },
  }, {
    readUrl: '',
    writeUrl: 'https://cache.example/live',
    writeMethod: 'PUT',
  });

  assert.equal(published, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://cache.example/live');
  assert.equal(calls[0].options.method, 'PUT');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.pages['earn-scrvusd'].supplyApy, '32.99%');
  assert.equal('empty' in body.pages['earn-scrvusd'], false);
});

test('merges bundled, shared remote, and local live metrics by newest page timestamp', () => {
  assert.deepEqual(mergeLiveMetricsSources({
    bundled: { a: { value: 'bundled', updatedAt: 1 }, b: { value: 'bundled', updatedAt: 10 } },
    remote: { a: { value: 'remote', updatedAt: 2 }, b: { value: 'remote', updatedAt: 9 } },
    local: { a: { value: 'local', updatedAt: 3 } },
  }), {
    a: { value: 'local', updatedAt: 3 },
    b: { value: 'bundled', updatedAt: 10 },
  });
});
