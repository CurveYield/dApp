export const MAINNET_CHAIN_ID = 1;
export const MAINNET_RPC_URLS = [
  'https://ethereum.publicnode.com',
  'https://eth.drpc.org',
  'https://rpc.mevblocker.io',
  'https://eth-mainnet.public.blastapi.io',
  'https://ethereum-rpc.publicnode.com',
  'https://mainnet.gateway.tenderly.co',
  'https://eth-pokt.nodies.app',
  'https://eth.api.onfinality.io/public',
  'https://ethereum.rpc.thirdweb.com',
  'https://nodes.mewapi.io/rpc/eth',
];
export const ARBITRUM_CHAIN_ID = 42161;
export const ARBITRUM_RPC_URLS = [
  'https://arb1.arbitrum.io/rpc',
  'https://arbitrum-one.publicnode.com',
  'https://arb-pokt.nodies.app',
  'https://arbitrum-one-rpc.publicnode.com',
  'https://arbitrum-one.public.blastapi.io',
  'https://arbitrum.gateway.tenderly.co',
  'https://arbitrum.rpc.thirdweb.com',
  'https://arbitrum-one-public.nodies.app',
  'https://arb.leorpc.com/?api_key=FREE',
  'https://g.w.lavanet.xyz:443/gateway/arb1/rpc-http/f7ee0000000000000000000000000000',
];

export const EVC_ADDRESS = '0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383';
export const ACCOUNT_STATUS_CHECK_TOPIC = '0x889a4d4628b31342e420737e2aeb45387087570710d26239aa8a5f13d3e829d4';
export const CONTROLLER_STATUS_TOPIC = '0x9919d437ee612d4ec7bba88a7d9bc4fc36a0a23608ad6259252711a46b708af9';
export const COLLATERAL_STATUS_TOPIC = '0xf022705c827017c972043d1984cfddc7958c9f4685b4d9ce8bd68696f4381cd2';
export const LIQUIDATION_RISK_STORAGE_KEY = 'curveyield.euler.liquidationRisk.v1';

export const LIABILITY_VAULTS = [
  { label: 'asdCRV / scrvUSD', collateral: 'asdCRV', debt: 'scrvUSD', address: '0xe45C513dD473138d095221E0f923634F18795db0' },
  { label: 'aCRV / scrvUSD', collateral: 'aCRV', debt: 'scrvUSD', address: '0xa264e81dF3C81953eEbae182441811e5CE894632' },
  { label: 'st-yCRV / scrvUSD', collateral: 'st-yCRV', debt: 'scrvUSD', address: '0x5b1E4F55B71eeD2bdb283B630fcdC064fB69e8D0' },
  { label: 'yvCurve-yYB / scrvUSD', collateral: 'yvCurve-yYB', debt: 'scrvUSD', address: '0x64D3aF907DEb5E58b3300977977B6B134d4005Ec' },
  { label: 'ybcrvUSD / scrvUSD', collateral: 'ybcrvUSD', debt: 'scrvUSD', address: '0xffBFC21fA9F3ee0B35B45F272fF83B315D5B5680' },
].map((vault) => ({ ...vault, address: vault.address.toLowerCase() }));

const ARBITRUM_LIABILITY_VAULTS = [
  {
    label: 'asdCRV / crvUSD',
    collateral: 'asdCRV',
    debt: 'crvUSD',
    collateralVault: '0x2E93b06831301d0B6a3F0a7257cA0336fA717F02',
    address: '0xbea90e53c938d815F01cD46Ce493c5B66f2dB632',
  },
  {
    label: 'xETH / crvUSD',
    collateral: 'xETH',
    debt: 'crvUSD',
    collateralVault: '0xe3c721aD080EA841bda981B518ac21b66431C420',
    address: '0xaCEe8EFF71a03d31076160C351d14B849768B4E1',
  },
].map((vault) => ({
  ...vault,
  address: vault.address.toLowerCase(),
  collateralVault: vault.collateralVault.toLowerCase(),
}));

export const LIQUIDATION_CHAINS = {
  ethereum: {
    id: 'ethereum',
    chainId: MAINNET_CHAIN_ID,
    label: 'Ethereum',
    evcAddress: EVC_ADDRESS,
    explorerBaseUrl: 'https://etherscan.io',
    rpcUrls: MAINNET_RPC_URLS,
    liabilityVaults: LIABILITY_VAULTS,
  },
  arbitrum: {
    id: 'arbitrum',
    chainId: ARBITRUM_CHAIN_ID,
    label: 'Arbitrum',
    evcAddress: '0x6302ef0F34100CDDFb5489fbcB6eE1AA95CD1066',
    explorerBaseUrl: 'https://arbiscan.io',
    rpcUrls: ARBITRUM_RPC_URLS,
    earnVault: '0x0396784d22a631C608708AFB63dd4E40b56bFe78',
    liquidator: '0x081b0c3cBC1131c2f46DFFcFFbb27Fc765008FC4',
    liabilityVaults: ARBITRUM_LIABILITY_VAULTS,
  },
};

const SELECTORS = {
  accountLiquidity: '0xa824bf67',
  asset: '0x38d52e0f',
  debtOf: '0xd283e75f',
  decimals: '0x313ce567',
  getAccountOwner: '0x442b172c',
  getCollaterals: '0xa4d25d1e',
};

export const DEFAULT_LOOKBACK_BLOCKS = 5000;
export const MANUAL_LOOKBACK_BLOCKS = 50000;
const LOG_CHUNK_SIZE = 5000;
const rpcCursors = new Map();

function controllersForChain(chainConfig) {
  return new Set((chainConfig?.liabilityVaults || []).map((vault) => normalizeAddress(vault.address)));
}

function chainById(chainId) {
  return Object.values(LIQUIDATION_CHAINS).find((chain) => chain.chainId === Number(chainId)) || LIQUIDATION_CHAINS.ethereum;
}

export function normalizeAddress(address) {
  return String(address || '').toLowerCase();
}

function strip0x(value) {
  return String(value || '').replace(/^0x/i, '');
}

function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function encodeAddress(address) {
  return strip0x(address).toLowerCase().padStart(64, '0');
}

function encodeCall(selector, args = []) {
  return `${selector}${args.join('')}`;
}

function decodeUint(hex, index = 0) {
  const clean = strip0x(hex);
  const word = clean.slice(index * 64, index * 64 + 64);
  return word ? BigInt(`0x${word}`) : 0n;
}

function decodeAddressWord(hex, index = 0) {
  const clean = strip0x(hex);
  const word = clean.slice(index * 64, index * 64 + 64);
  return `0x${word.slice(24)}`.toLowerCase();
}

function decodeAddressArray(hex) {
  const clean = strip0x(hex);
  if (clean.length < 128) return [];
  const offsetWords = Number(decodeUint(hex, 0) / 32n);
  const length = Number(decodeUint(hex, offsetWords));
  return Array.from({ length }, (_, index) => decodeAddressWord(hex, offsetWords + 1 + index));
}

export function padTopicAddress(address) {
  return `0x${encodeAddress(address)}`;
}

function addressFromTopic(topic) {
  return `0x${strip0x(topic).slice(24)}`.toLowerCase();
}

function hexBlockToNumber(blockNumber) {
  return Number.parseInt(String(blockNumber || '0x0'), 16);
}

function eventBool(data) {
  return decodeUint(data, 0) !== 0n;
}

export function classifyHealth(score) {
  if (score < 1) return { label: 'Liquidatable', className: 'danger' };
  if (score < 1.05) return { label: 'High risk', className: 'warning' };
  if (score < 1.1) return { label: 'Watch', className: 'watch' };
  return { label: 'Healthy', className: 'healthy' };
}

export function healthScoreFromValues(collateralValue, liabilityValue) {
  const collateral = BigInt(collateralValue || 0n);
  const liability = BigInt(liabilityValue || 0n);
  if (liability === 0n) return Infinity;
  return Number((collateral * 10000n) / liability) / 10000;
}

export function decodeAccountLiquidity(hex) {
  const collateralValue = decodeUint(hex, 0);
  const liabilityValue = decodeUint(hex, 1);
  return {
    collateralValue,
    liabilityValue,
    healthScore: healthScoreFromValues(collateralValue, liabilityValue),
  };
}

export function parseEvcLog(log, chainConfig = LIQUIDATION_CHAINS.ethereum) {
  const topic0 = normalizeAddress(log.topics?.[0]);
  const blockNumber = hexBlockToNumber(log.blockNumber);
  const controllers = controllersForChain(chainConfig);
  const chainFields = { chainId: chainConfig.chainId, chainLabel: chainConfig.label };
  if (topic0 === ACCOUNT_STATUS_CHECK_TOPIC) {
    const account = addressFromTopic(log.topics[1]);
    const controller = addressFromTopic(log.topics[2]);
    if (!controllers.has(controller)) return null;
    return { type: 'account-status', ...chainFields, account, controller, blockNumber };
  }
  if (topic0 === CONTROLLER_STATUS_TOPIC) {
    const account = addressFromTopic(log.topics[1]);
    const controller = addressFromTopic(log.topics[2]);
    if (!controllers.has(controller)) return null;
    return { type: 'controller-status', ...chainFields, account, controller, enabled: eventBool(log.data), blockNumber };
  }
  if (topic0 === COLLATERAL_STATUS_TOPIC) {
    return {
      type: 'collateral-status',
      ...chainFields,
      account: addressFromTopic(log.topics[1]),
      collateral: addressFromTopic(log.topics[2]),
      enabled: eventBool(log.data),
      blockNumber,
    };
  }
  return null;
}

export function candidateKey(chainId, account, controller) {
  if (arguments.length === 2) return `${MAINNET_CHAIN_ID}:${normalizeAddress(chainId)}:${normalizeAddress(account)}`;
  return `${Number(chainId)}:${normalizeAddress(account)}:${normalizeAddress(controller)}`;
}

export function mergeLiquidationLog(state, log, chainConfig = LIQUIDATION_CHAINS.ethereum) {
  const parsed = parseEvcLog(log, chainConfig);
  if (!parsed) return state;
  const next = {
    ...state,
    candidates: { ...(state.candidates || {}) },
    collaterals: { ...(state.collaterals || {}) },
    lastScannedBlock: Math.max(state.lastScannedBlock || 0, parsed.blockNumber || 0),
    lastScannedBlocks: { ...(state.lastScannedBlocks || {}) },
  };
  next.lastScannedBlocks[parsed.chainId] = Math.max(
    Number(next.lastScannedBlocks[parsed.chainId] || 0),
    parsed.blockNumber || 0,
  );
  if (parsed.type === 'account-status' || parsed.type === 'controller-status') {
    const key = candidateKey(parsed.chainId, parsed.account, parsed.controller);
    const existing = next.candidates[key] || {};
    if (parsed.type === 'controller-status' && !parsed.enabled) {
      delete next.candidates[key];
      return next;
    }
    next.candidates[key] = {
      ...existing,
      chainId: parsed.chainId,
      chainLabel: parsed.chainLabel,
      account: parsed.account,
      controller: parsed.controller,
      lastAccountStatusCheckBlock: parsed.type === 'account-status'
        ? Math.max(existing.lastAccountStatusCheckBlock || 0, parsed.blockNumber)
        : existing.lastAccountStatusCheckBlock || 0,
      lastControllerStatusBlock: parsed.type === 'controller-status'
        ? Math.max(existing.lastControllerStatusBlock || 0, parsed.blockNumber)
        : existing.lastControllerStatusBlock || 0,
    };
  }
  if (parsed.type === 'collateral-status') {
    const collateralKey = candidateKey(parsed.chainId, parsed.account, 'collaterals');
    const current = new Set(next.collaterals[collateralKey] || []);
    if (parsed.enabled) current.add(parsed.collateral);
    else current.delete(parsed.collateral);
    next.collaterals[collateralKey] = [...current];
  }
  return next;
}

export function readStoredLiquidationState(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      candidates: parsed.candidates || {},
      collaterals: parsed.collaterals || {},
      lastScannedBlock: parsed.lastScannedBlock || 0,
      lastScannedBlocks: parsed.lastScannedBlocks || (parsed.lastScannedBlock ? { [MAINNET_CHAIN_ID]: parsed.lastScannedBlock } : {}),
      rows: parsed.rows || [],
    };
  } catch {
    return { candidates: {}, collaterals: {}, lastScannedBlock: 0, lastScannedBlocks: {}, rows: [] };
  }
}

function nextRpcUrl(chainConfig) {
  const urls = chainConfig.rpcUrls || [];
  const cursor = rpcCursors.get(chainConfig.chainId) || 0;
  const url = urls[cursor % urls.length];
  rpcCursors.set(chainConfig.chainId, cursor + 1);
  return url;
}

async function chainRpc(chainConfig, method, params) {
  let lastError;
  for (let attempt = 0; attempt < chainConfig.rpcUrls.length; attempt += 1) {
    const url = nextRpcUrl(chainConfig);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const body = await response.json();
      if (body.error) throw new Error(body.error.message || 'RPC error');
      return body.result;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`All ${chainConfig.label} RPC connections failed.`);
}

async function chainEthCall(chainConfig, to, data) {
  return chainRpc(chainConfig, 'eth_call', [{ to, data }, 'latest']);
}

async function chainGetLogs(chainConfig, filter) {
  return chainRpc(chainConfig, 'eth_getLogs', [filter]);
}

async function latestBlockNumber(chainConfig) {
  return hexBlockToNumber(await chainRpc(chainConfig, 'eth_blockNumber', []));
}

function blockHex(number) {
  return `0x${Math.max(0, number).toString(16)}`;
}

async function scanLogsForTopic(chainConfig, { topic0, topic2, fromBlock, toBlock }) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_SIZE) {
    const end = Math.min(toBlock, start + LOG_CHUNK_SIZE - 1);
    logs.push(...await chainGetLogs(chainConfig, {
      address: chainConfig.evcAddress,
      fromBlock: blockHex(start),
      toBlock: blockHex(end),
      topics: topic2 ? [topic0, null, topic2] : [topic0],
    }));
  }
  return logs;
}

export function boundedScanRange({ previousBlock = 0, latestBlock = 0, lookbackBlocks = DEFAULT_LOOKBACK_BLOCKS }) {
  const previous = Number(previousBlock || 0);
  const latest = Number(latestBlock || 0);
  const lookbackStart = Math.max(0, latest - Number(lookbackBlocks || DEFAULT_LOOKBACK_BLOCKS));
  const fromBlock = previous ? Math.max(previous + 1, lookbackStart) : lookbackStart;
  return { fromBlock, toBlock: latest };
}

async function discoverLogsForChain(state, chainConfig, latestBlock, lookbackBlocks = DEFAULT_LOOKBACK_BLOCKS) {
  const lastScannedBlocks = state.lastScannedBlocks || {};
  const previousBlock = Number(lastScannedBlocks[chainConfig.chainId] || 0);
  const { fromBlock } = boundedScanRange({ previousBlock, latestBlock, lookbackBlocks });
  if (fromBlock > latestBlock) return state;
  let next = state;
  for (const vault of chainConfig.liabilityVaults) {
    const controllerTopic = padTopicAddress(vault.address);
    const logs = [
      ...await scanLogsForTopic(chainConfig, { topic0: ACCOUNT_STATUS_CHECK_TOPIC, topic2: controllerTopic, fromBlock, toBlock: latestBlock }),
      ...await scanLogsForTopic(chainConfig, { topic0: CONTROLLER_STATUS_TOPIC, topic2: controllerTopic, fromBlock, toBlock: latestBlock }),
    ];
    for (const log of logs) next = mergeLiquidationLog(next, log, chainConfig);
  }
  const collateralLogs = await scanLogsForTopic(chainConfig, { topic0: COLLATERAL_STATUS_TOPIC, fromBlock, toBlock: latestBlock });
  for (const log of collateralLogs) next = mergeLiquidationLog(next, log, chainConfig);
  return {
    ...next,
    lastScannedBlock: chainConfig.chainId === MAINNET_CHAIN_ID ? latestBlock : next.lastScannedBlock || 0,
    lastScannedBlocks: { ...(next.lastScannedBlocks || {}), [chainConfig.chainId]: latestBlock },
  };
}

function vaultMeta(chainConfig, address) {
  return (chainConfig.liabilityVaults || []).find((vault) => vault.address === normalizeAddress(address));
}

function formatUnits(value, decimals, precision = 4) {
  const amount = BigInt(value || 0n);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  const scaled = (fraction * (10n ** BigInt(precision))) / base;
  return `${whole}.${scaled.toString().padStart(precision, '0')}`;
}

function formatUsd(value) {
  const amount = Number(value || 0n) / 1e18;
  if (!Number.isFinite(amount)) return '$0.00';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`;
  return `$${amount.toFixed(2)}`;
}

async function readCandidateLive(candidate, collaterals, latestBlock, chainConfig) {
  const controller = candidate.controller;
  const meta = vaultMeta(chainConfig, controller);
  const [liquidityRaw, ownerRaw, collateralsRaw, debtRaw, assetRaw] = await Promise.all([
    chainEthCall(chainConfig, controller, encodeCall(SELECTORS.accountLiquidity, [encodeAddress(candidate.account), encodeUint(1n)])),
    chainEthCall(chainConfig, chainConfig.evcAddress, encodeCall(SELECTORS.getAccountOwner, [encodeAddress(candidate.account)])).catch(() => null),
    chainEthCall(chainConfig, chainConfig.evcAddress, encodeCall(SELECTORS.getCollaterals, [encodeAddress(candidate.account)])).catch(() => null),
    chainEthCall(chainConfig, controller, encodeCall(SELECTORS.debtOf, [encodeAddress(candidate.account)])).catch(() => null),
    chainEthCall(chainConfig, controller, SELECTORS.asset).catch(() => null),
  ]);
  const decimalsRaw = assetRaw ? await chainEthCall(chainConfig, decodeAddressWord(assetRaw), SELECTORS.decimals).catch(() => null) : null;
  const liquidity = decodeAccountLiquidity(liquidityRaw);
  const health = classifyHealth(liquidity.healthScore);
  const liveCollaterals = collateralsRaw ? decodeAddressArray(collateralsRaw) : collaterals;
  const debtDecimals = decimalsRaw ? Number(decodeUint(decimalsRaw)) : 18;
  const debt = debtRaw ? `${formatUnits(decodeUint(debtRaw), debtDecimals, 4)} ${meta?.debt || 'asset'}` : 'Pending';
  return {
    chainId: chainConfig.chainId,
    chain: chainConfig.label,
    explorerBaseUrl: chainConfig.explorerBaseUrl,
    account: candidate.account,
    owner: ownerRaw ? decodeAddressWord(ownerRaw) : '',
    controller,
    marketLabel: meta?.label || 'Unknown market',
    collaterals: liveCollaterals,
    debt,
    collateralValue: formatUsd(liquidity.collateralValue),
    liabilityValue: formatUsd(liquidity.liabilityValue),
    healthScore: Number.isFinite(liquidity.healthScore) ? liquidity.healthScore.toFixed(4) : '∞',
    status: health.label,
    statusClass: health.className,
    lastCheckedBlock: latestBlock,
    lastAccountStatusCheckBlock: candidate.lastAccountStatusCheckBlock || 0,
  };
}

export async function refreshLiquidationRiskDashboard(state, { includeHealthy = false, maxCandidates = 80, chainIds = null, scanMode = 'recent' } = {}) {
  const chainConfigs = Object.values(LIQUIDATION_CHAINS)
    .filter((chainConfig) => !chainIds || chainIds.map(Number).includes(chainConfig.chainId));
  const latestBlocks = {};
  let indexed = readStoredLiquidationState(JSON.stringify(state));
  for (const chainConfig of chainConfigs) {
    const latestBlock = await latestBlockNumber(chainConfig);
    latestBlocks[chainConfig.chainId] = latestBlock;
    indexed = await discoverLogsForChain(indexed, chainConfig, latestBlock, scanMode === 'manual' ? MANUAL_LOOKBACK_BLOCKS : DEFAULT_LOOKBACK_BLOCKS);
  }
  const candidates = Object.values(indexed.candidates || {})
    .filter((candidate) => !chainIds || chainIds.map(Number).includes(Number(candidate.chainId || MAINNET_CHAIN_ID)))
    .sort((a, b) => (b.lastAccountStatusCheckBlock || 0) - (a.lastAccountStatusCheckBlock || 0))
    .slice(0, maxCandidates);
  const rows = [];
  for (const candidate of candidates) {
    const chainConfig = chainById(candidate.chainId || MAINNET_CHAIN_ID);
    const latestBlock = latestBlocks[chainConfig.chainId] || indexed.lastScannedBlocks?.[chainConfig.chainId] || 0;
    const collateralKey = candidateKey(chainConfig.chainId, candidate.account, 'collaterals');
    try {
      const row = await readCandidateLive(candidate, indexed.collaterals?.[collateralKey] || [], latestBlock, chainConfig);
      if (includeHealthy || row.status !== 'Healthy') rows.push(row);
    } catch {
      rows.push({
        ...candidate,
        chainId: chainConfig.chainId,
        chain: chainConfig.label,
        explorerBaseUrl: chainConfig.explorerBaseUrl,
        owner: '',
        marketLabel: vaultMeta(chainConfig, candidate.controller)?.label || 'Unknown market',
        collaterals: indexed.collaterals?.[collateralKey] || [],
        debt: 'Pending',
        collateralValue: 'Pending',
        liabilityValue: 'Pending',
        healthScore: 'Pending',
        status: 'Refresh failed',
        statusClass: 'unknown',
        lastCheckedBlock: latestBlock,
        lastAccountStatusCheckBlock: candidate.lastAccountStatusCheckBlock || 0,
      });
    }
  }
  return { ...indexed, rows, updatedAt: Date.now() };
}
