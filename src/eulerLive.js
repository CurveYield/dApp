export const ETHEREUM_CHAIN_HEX = '0x1';
export const ETHEREUM_RPC_URL = 'https://ethereum.publicnode.com';
export const ETHEREUM_RPC_URLS = [
  ETHEREUM_RPC_URL,
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
export const ARBITRUM_CHAIN_HEX = '0xa4b1';
export const ARBITRUM_RPC_URL = 'https://arb1.arbitrum.io/rpc';
export const ARBITRUM_RPC_URLS = [
  ARBITRUM_RPC_URL,
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
export const BASE_CHAIN_HEX = '0x2105';
export const BASE_RPC_URL = 'https://mainnet.base.org';
export const BASE_RPC_URLS = [
  BASE_RPC_URL,
  'https://base.publicnode.com',
  'https://base-rpc.publicnode.com',
  'https://base.drpc.org',
  'https://base.llamarpc.com',
  'https://1rpc.io/base',
  'https://base.meowrpc.com',
  'https://base.gateway.tenderly.co',
  'https://base.api.onfinality.io/public',
  'https://base.rpc.subquery.network/public',
];
export const MAX_UINT256 = (1n << 256n) - 1n;
export const USD_UNIT_OF_ACCOUNT = '0x0000000000000000000000000000000000000348';
const UINT32_MAX = 4294967295n;
const CHAIN_CONFIGS = {
  ethereum: {
    chainHex: ETHEREUM_CHAIN_HEX,
    chainName: 'Ethereum Mainnet',
    rpcUrls: ETHEREUM_RPC_URLS,
    explorerUrls: ['https://etherscan.io'],
  },
  arbitrum: {
    chainHex: ARBITRUM_CHAIN_HEX,
    chainName: 'Arbitrum One',
    rpcUrls: ARBITRUM_RPC_URLS,
    explorerUrls: ['https://arbiscan.io'],
  },
  base: {
    chainHex: BASE_CHAIN_HEX,
    chainName: 'Base',
    rpcUrls: BASE_RPC_URLS,
    explorerUrls: ['https://basescan.org'],
  },
};

const SELECTORS = {
  allowance: '0xdd62ed3e',
  accountLiquidity: '0xa824bf67',
  approve: '0x095ea7b3',
  asset: '0x38d52e0f',
  balanceOf: '0x70a08231',
  borrow: '0x4b3fd148',
  caps: '0x18e22d98',
  cash: '0x961be391',
  convertToAssets: '0x07a2d13a',
  decimals: '0x313ce567',
  deposit: '0x6e553f65',
  debtOf: '0xd283e75f',
  evc: '0xa70354a1',
  fee: '0xddca3f43',
  irmBaseRate: '0x1f68f20a',
  irmKink: '0xfd2da339',
  irmSlope1: '0xa62b75a8',
  irmSlope2: '0xd0134cb7',
  interestRate: '0x7c3a00fd',
  interestFee: '0xa75df498',
  interestRateModel: '0xf3fdb15a',
  earnConfig: '0x0e68ec95',
  expectedSupplyAssets: '0x6623b575',
  feeRecipient: '0x46904840',
  feeReceiver: '0xb3f00674',
  hookConfig: '0xcf349b7d',
  ltvBorrow: '0xbf58094d',
  ltvFull: '0x33708d0c',
  ltvLiquidation: '0xaf5aaeeb',
  maxWithdraw: '0xce96cb77',
  totalAssets: '0x01e1d114',
  totalBorrows: '0x47bd3718',
  totalSupply: '0x18160ddd',
  oracle: '0x7dc0d1d0',
  repay: '0xacb70815',
  unitOfAccount: '0x3e833364',
  withdraw: '0xb460af94',
  getQuote: '0xae68676c',
  evcBatch: '0xc16ae7a4',
  enableCollateral: '0xd44fee5a',
  enableController: '0xc368516c',
  getCollaterals: '0xa4d25d1e',
  getControllers: '0xfd6046d7',
  isCollateralEnabled: '0x9e716d58',
  isControllerEnabled: '0x47cfdac4',
  disableCollateral: '0xe920e8e0',
  liquidate: '0x366b7faa',
};

function strip0x(value) {
  return String(value || '').replace(/^0x/i, '');
}

export function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

export function encodeUint8(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 255) {
    throw new Error('Market number must be between 0 and 255.');
  }
  return encodeUint(BigInt(number));
}

export function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim());
}

export function assertConfiguredAddress(address, label = 'Contract') {
  const normalized = String(address || '').trim();
  if (!isAddress(normalized)) throw new Error(`${label} address is not configured for this page.`);
  return normalized;
}

export function encodeAddress(address) {
  assertConfiguredAddress(address);
  return strip0x(address).toLowerCase().padStart(64, '0');
}

export function encodeCall(selector, args = []) {
  return `${selector}${args.join('')}`;
}

function stripData(value, label = 'data') {
  const normalized = String(value || '').trim();
  if (!/^0x([0-9a-fA-F]{2})*$/.test(normalized)) throw new Error(`Invalid ${label}.`);
  return strip0x(normalized).toLowerCase();
}

function encodeBytes(data, label = 'data') {
  const clean = stripData(data, label);
  const byteLength = clean.length / 2;
  const paddedLength = Math.ceil(clean.length / 64) * 64;
  return `${encodeUint(byteLength)}${clean.padEnd(paddedLength, '0')}`;
}

function encodeBatchItem(item) {
  const data = item.data ?? '0x';
  return [
    encodeAddress(item.targetContract),
    encodeAddress(item.onBehalfOfAccount || '0x0000000000000000000000000000000000000000'),
    encodeUint(item.value ?? 0n),
    encodeUint(128n),
    encodeBytes(data, 'batch item data'),
  ].join('');
}

export function encodeEvcBatch(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('EVC batch requires at least one item.');
  const encodedItems = items.map(encodeBatchItem);
  let cursor = 32n * BigInt(encodedItems.length);
  const offsets = [];
  for (const encoded of encodedItems) {
    offsets.push(encodeUint(cursor));
    cursor += BigInt(encoded.length / 2);
  }
  return encodeCall(SELECTORS.evcBatch, [
    encodeUint(32n),
    encodeUint(BigInt(encodedItems.length)),
    offsets.join(''),
    encodedItems.join(''),
  ]);
}

export function buildPositionCollateralWithdrawBatchCalldata({
  collateralVault,
  positionAccount,
  receiver,
  amount,
}) {
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  assertConfiguredAddress(positionAccount, 'Position account');
  assertConfiguredAddress(receiver, 'Receiver');
  const withdrawData = encodeCall(SELECTORS.withdraw, [
    encodeUint(amount),
    encodeAddress(receiver),
    encodeAddress(positionAccount),
  ]);
  return encodeEvcBatch([{
    targetContract: collateralVault,
    onBehalfOfAccount: positionAccount,
    value: 0n,
    data: withdrawData,
  }]);
}

function numericChainId(chainId = 'arbitrum') {
  if (String(chainId) === '1' || chainId === 'ethereum') return '1';
  if (String(chainId) === '42161' || chainId === 'arbitrum') return '42161';
  if (String(chainId) === '8453' || chainId === 'base') return '8453';
  throw new Error('Multiply is not configured for this chain.');
}

export function buildEulerSwapQuoteUrl({
  chainId = 'arbitrum',
  tokenIn,
  tokenOut,
  receiver,
  vaultIn,
  account,
  amount,
  deadline,
  slippage = '0.5',
}) {
  assertConfiguredAddress(tokenIn, 'Borrow token');
  assertConfiguredAddress(tokenOut, 'Collateral token');
  assertConfiguredAddress(receiver, 'Collateral vault');
  assertConfiguredAddress(vaultIn, 'Debt vault');
  assertConfiguredAddress(account, 'Wallet');
  const params = new URLSearchParams({
    chainId: numericChainId(chainId),
    tokenIn,
    tokenOut,
    receiver,
    vaultIn,
    origin: account,
    accountIn: account,
    accountOut: account,
    amount: BigInt(amount).toString(),
    targetDebt: '0',
    currentDebt: '0',
    swapperMode: '0',
    slippage: String(slippage),
    deadline: String(deadline),
    isRepay: 'false',
  });
  return `https://swap.euler.finance/swap?${params.toString()}`;
}

export function buildMultiplyBatchCalldata({
  owner,
  evc,
  debtVault,
  collateralVault,
  borrowAmount,
  swapperAddress,
  swapperData,
  verifierAddress,
  verifierData,
  collateralEnabled = true,
  controllerEnabled = true,
}) {
  assertConfiguredAddress(owner, 'Wallet');
  assertConfiguredAddress(evc, 'EVC');
  assertConfiguredAddress(debtVault, 'Debt vault');
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  assertConfiguredAddress(swapperAddress, 'Euler swapper');
  assertConfiguredAddress(verifierAddress, 'Euler verifier');
  const items = [];
  if (!collateralEnabled) {
    items.push({
      targetContract: evc,
      onBehalfOfAccount: owner,
      value: 0n,
      data: encodeCall(SELECTORS.enableCollateral, [encodeAddress(owner), encodeAddress(collateralVault)]),
    });
  }
  if (!controllerEnabled) {
    items.push({
      targetContract: evc,
      onBehalfOfAccount: owner,
      value: 0n,
      data: encodeCall(SELECTORS.enableController, [encodeAddress(owner), encodeAddress(debtVault)]),
    });
  }
  items.push(
    {
      targetContract: debtVault,
      onBehalfOfAccount: owner,
      value: 0n,
      data: encodeCall(SELECTORS.borrow, [encodeUint(borrowAmount), encodeAddress(swapperAddress)]),
    },
    {
      targetContract: swapperAddress,
      onBehalfOfAccount: owner,
      value: 0n,
      data: swapperData,
    },
    {
      targetContract: verifierAddress,
      onBehalfOfAccount: owner,
      value: 0n,
      data: verifierData,
    },
  );
  return encodeEvcBatch(items);
}

function buildMarketDepositBorrowBatchItems({
  account,
  collateralSourceAccount = account,
  collateralVault,
  debtVault,
  evc,
  collateralAmount = 0n,
  borrowAmount = 0n,
  borrowReceiver,
  collateralEnabled = true,
  controllerEnabled = true,
}) {
  assertConfiguredAddress(account, 'Euler account');
  assertConfiguredAddress(collateralSourceAccount, 'Collateral source account');
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  assertConfiguredAddress(debtVault, 'Debt vault');
  assertConfiguredAddress(evc, 'EVC');
  const items = [];
  if (BigInt(collateralAmount || 0n) > 0n) {
    items.push({
      targetContract: collateralVault,
      onBehalfOfAccount: collateralSourceAccount,
      value: 0n,
      data: encodeCall(SELECTORS.deposit, [encodeUint(collateralAmount), encodeAddress(account)]),
    });
  }
  if (!controllerEnabled) {
    items.push({
      targetContract: evc,
      onBehalfOfAccount: '0x0000000000000000000000000000000000000000',
      value: 0n,
      data: encodeCall(SELECTORS.enableController, [encodeAddress(account), encodeAddress(debtVault)]),
    });
  }
  if (!collateralEnabled) {
    items.push({
      targetContract: evc,
      onBehalfOfAccount: '0x0000000000000000000000000000000000000000',
      value: 0n,
      data: encodeCall(SELECTORS.enableCollateral, [encodeAddress(account), encodeAddress(collateralVault)]),
    });
  }
  if (BigInt(borrowAmount || 0n) > 0n) {
    assertConfiguredAddress(borrowReceiver, 'Borrow receiver');
    items.push({
      targetContract: debtVault,
      onBehalfOfAccount: account,
      value: 0n,
      data: encodeCall(SELECTORS.borrow, [encodeUint(borrowAmount), encodeAddress(borrowReceiver)]),
    });
  }
  if (items.length === 0) throw new Error('No Euler market operation is needed.');
  return items;
}

export function buildMarketDepositBorrowBatchCalldata(args) {
  return encodeEvcBatch(buildMarketDepositBorrowBatchItems(args));
}

export function encodeBalanceOfCalldata(owner) {
  if (!isAddress(owner)) throw new Error('Enter a valid wallet address.');
  return encodeCall(SELECTORS.balanceOf, [encodeAddress(owner)]);
}

export function encodeMaxWithdrawCalldata(owner) {
  if (!isAddress(owner)) throw new Error('Enter a valid wallet address.');
  return encodeCall(SELECTORS.maxWithdraw, [encodeAddress(owner)]);
}

export function encodeDebtOfCalldata(owner) {
  if (!isAddress(owner)) throw new Error('Enter a valid wallet address.');
  return encodeCall(SELECTORS.debtOf, [encodeAddress(owner)]);
}

export function encodeAccountLiquidityCalldata(owner, liquidation = false) {
  if (!isAddress(owner)) throw new Error('Enter a valid wallet address.');
  return encodeCall(SELECTORS.accountLiquidity, [encodeAddress(owner), encodeUint(liquidation ? 1n : 0n)]);
}

export function encodeFeeCalldata() {
  return SELECTORS.fee;
}

export function decodeUint(hex) {
  return decodeUintWord(hex, 0);
}

export function decodeUintWord(hex, index = 0) {
  const clean = strip0x(hex);
  if (!clean) return 0n;
  const start = index * 64;
  const word = clean.slice(start, start + 64);
  if (!word) return 0n;
  return BigInt(`0x${word}`);
}

export function decodeAddress(hex) {
  const clean = strip0x(hex).slice(24, 64);
  return `0x${clean}`;
}

function decodeAddressArray(hex) {
  const clean = strip0x(hex);
  if (clean.length < 128) return [];
  const offset = Number(BigInt(`0x${clean.slice(0, 64) || '0'}`));
  const lengthStart = offset * 2;
  if (!Number.isFinite(offset) || clean.length < lengthStart + 64) return [];
  const length = Number(BigInt(`0x${clean.slice(lengthStart, lengthStart + 64) || '0'}`));
  if (!Number.isFinite(length) || length < 0 || length > 64) return [];
  const values = [];
  for (let index = 0; index < length; index += 1) {
    const start = lengthStart + 64 + index * 64;
    if (clean.length < start + 64) break;
    values.push(`0x${clean.slice(start + 24, start + 64)}`.toLowerCase());
  }
  return values;
}

export function parseUnits(value, decimals) {
  const raw = String(value || '').trim().replace(/\s/g, '');
  const normalized = raw.includes('.') ? raw.replace(/,/g, '') : raw.replace(',', '.');
  if (!/^\d*(?:\.\d*)?$/.test(normalized)) {
    throw new Error('Enter a valid numeric amount.');
  }
  const [wholeRaw, fractionRaw = ''] = normalized.split('.');
  const whole = wholeRaw || '0';
  const fraction = fractionRaw.slice(0, decimals).padEnd(decimals, '0');
  return BigInt(`${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0');
}

export function formatUnits(value, decimals, precision = 2) {
  const amount = BigInt(value || 0);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  const scaled = (fraction * (10n ** BigInt(precision))) / base;
  return `${whole}.${scaled.toString().padStart(precision, '0')}`;
}

export function formatTokenAmount(value, decimals, preferredPrecision = 4) {
  const amount = BigInt(value || 0);
  if (amount === 0n) return formatUnits(0n, decimals, preferredPrecision);
  const base = 10n ** BigInt(decimals);
  if (amount >= base) return formatUnits(amount, decimals, preferredPrecision);
  let precision = preferredPrecision;
  while (precision < 10) {
    const scaled = (amount * (10n ** BigInt(precision))) / base;
    if (scaled > 0n) return formatUnits(amount, decimals, precision);
    precision += 2;
  }
  return formatUnits(amount, decimals, precision);
}

export function formatPercentFromBps(value) {
  const number = Number(value || 0n) / 100;
  return `${number.toFixed(2)}%`;
}

export function formatMaxMultiplierFromBps(value) {
  const bps = Number(value || 0n);
  if (!Number.isFinite(bps) || bps >= 10000) return 'Loading...';
  return `${(10000 / (10000 - bps)).toFixed(2)}x`;
}

export function formatUtilization(totalBorrows, totalAssets) {
  const borrows = BigInt(totalBorrows || 0);
  const assets = BigInt(totalAssets || 0);
  if (assets === 0n) return '0.00%';
  return `${(Number((borrows * 10000n) / assets) / 100).toFixed(2)}%`;
}

export function resolveAmountCap(rawCap) {
  const cap = Number(rawCap || 0);
  if (cap === 0) return null;
  const exponent = BigInt(cap & 63);
  const mantissa = BigInt(cap >> 6);
  return (10n ** exponent) * mantissa / 100n;
}

export function formatResolvedCap(rawCap, decimals) {
  const resolved = resolveAmountCap(rawCap);
  if (resolved === null) return '∞';
  return formatUnits(resolved, decimals, 2);
}

export function formatOptionalResolvedCap(rawCap, decimals) {
  if (rawCap === null || rawCap === undefined) return 'Loading...';
  return formatResolvedCap(rawCap, decimals);
}

export function formatShareExchangeRate({ convertRaw, totalAssets, totalSupply, decimals, shareDecimals = decimals }) {
  if (convertRaw) return formatUnits(decodeUint(convertRaw), decimals, 6);
  const assets = BigInt(totalAssets || 0n);
  const shares = BigInt(totalSupply || 0n);
  if (shares === 0n) return '1.000000';
  return formatUnits((assets * (10n ** BigInt(shareDecimals))) / shares, decimals, 6);
}

export function supplyApyFromBorrow({ borrowApy, utilization, interestFee }) {
  const borrow = percentNumber(borrowApy);
  const util = percentNumber(utilization) / 100;
  const fee = Number(interestFee || 0n) / 10000;
  return `${(borrow * util * (1 - fee)).toFixed(2)}%`;
}

function percentToBps(value) {
  const normalized = String(value ?? '').replace('%', '').trim();
  if (!normalized) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return BigInt(Math.round(number * 100));
}

function rawAmountToBigInt(value) {
  if (typeof value === 'bigint') return value;
  try {
    return BigInt(value || 0);
  } catch {
    return 0n;
  }
}

export function calculateWeightedEarnSupplyApy(rows, totalAssets = 0n) {
  if (!Array.isArray(rows) || rows.length === 0) return 'N/A';
  let weightedBps = 0n;
  let allocated = 0n;
  for (const row of rows) {
    const assets = rawAmountToBigInt(row.allocationAssets ?? row.allocationAssetsRaw ?? 0n);
    if (assets <= 0n) continue;
    const bps = percentToBps(row.supplyApy);
    if (bps === null) return 'N/A';
    allocated += assets;
    weightedBps += assets * bps;
  }
  if (allocated === 0n) return '0.00%';
  const total = rawAmountToBigInt(totalAssets);
  const denominator = total > allocated ? total : allocated;
  const resultBps = weightedBps / denominator;
  return `${(Number(resultBps) / 100).toFixed(2)}%`;
}

export function formatWadPercent(value) {
  const number = Number(value || 0n) / 1e18 * 100;
  return `${number.toFixed(2)}%`;
}

export function formatUint32Percent(value) {
  const raw = BigInt(value || 0n);
  if (raw === 0n) return '0.00%';
  return `${((Number(raw) / Number(UINT32_MAX)) * 100).toFixed(2)}%`;
}

export function aprFromInterestRate(rate) {
  const number = Number(rate || 0n);
  if (!Number.isFinite(number) || number === 0) return '0.00%';
  const secondsPerYear = 31536000;
  return `${((number * secondsPerYear) / 1e27 * 100).toFixed(2)}%`;
}

export function formatIrmMetrics({ baseRate, slope1, slope2, kink }) {
  const base = BigInt(baseRate || 0n);
  const firstSlope = BigInt(slope1 || 0n);
  const secondSlope = BigInt(slope2 || 0n);
  return {
    irmBaseRate: aprFromInterestRate(base),
    irmRateAtKink: aprFromInterestRate(base + firstSlope),
    irmMaxRate: aprFromInterestRate(base + firstSlope + secondSlope),
    irmKink: formatUint32Percent(BigInt(kink || 0n)),
  };
}

function percentNumber(value) {
  const number = Number(String(value || '0').replace('%', ''));
  return Number.isFinite(number) ? number : 0;
}

export function netApyFromRates(supplyApy, borrowApy) {
  return `${(percentNumber(supplyApy) - percentNumber(borrowApy)).toFixed(2)}%`;
}

export function calculateBorrowCapacityRaw({ collateralValue, liabilityValue, debtQuote, debtDecimals, cash }) {
  const collateral = BigInt(collateralValue || 0n);
  const liability = BigInt(liabilityValue || 0n);
  const quote = BigInt(debtQuote || 0n);
  const availableCash = BigInt(cash || 0n);
  if (collateral <= liability || quote <= 0n) return 0n;
  const unitLiquidity = collateral - liability;
  const borrowable = (unitLiquidity * (10n ** BigInt(debtDecimals))) / quote;
  return borrowable < availableCash ? borrowable : availableCash;
}

export function accountLtvWarning({ collateralValue, debtValue, ltvBps, liquidationLtvBps }) {
  const collateral = BigInt(collateralValue || 0n);
  const debt = BigInt(debtValue || 0n);
  const liquidation = BigInt(liquidationLtvBps || 0n);
  if (liquidation === 0n) return 'This market is not configured for borrowing yet.';
  if (collateral === 0n && debt === 0n) return 'No open borrow position detected.';
  if (debt === 0n) return 'No outstanding debt detected.';
  if (collateral === 0n) return 'Position has debt and no detected collateral.';
  return BigInt(ltvBps || 0n) >= liquidation * 9n / 10n
    ? 'Warning: this position is close to liquidation.'
    : 'Position has a healthy liquidation buffer.';
}

const rpcCursors = new Map();
const rpcHealthByChain = new Map();

export function createRpcHealthTracker(urls) {
  return {
    urls: [...urls],
    stats: new Map(urls.map((url) => [url, {
      url,
      successes: 0,
      failures: 0,
      latencyMs: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      cooldownUntil: 0,
      lastError: '',
    }])),
    lastSelectedUrl: '',
  };
}

function rpcHealthForChain(chainId = 'arbitrum') {
  if (!rpcHealthByChain.has(chainId)) {
    rpcHealthByChain.set(chainId, createRpcHealthTracker(rpcUrlsForChain(chainId)));
  }
  return rpcHealthByChain.get(chainId);
}

export function recordRpcSuccess(tracker, url, latencyMs = 0, now = Date.now()) {
  const stat = tracker.stats.get(url);
  if (!stat) return;
  stat.successes += 1;
  stat.latencyMs = stat.latencyMs === null ? latencyMs : Math.round((stat.latencyMs * 0.7) + (latencyMs * 0.3));
  stat.lastSuccessAt = now;
  stat.cooldownUntil = 0;
  stat.lastError = '';
}

export function recordRpcFailure(tracker, url, error, now = Date.now()) {
  const stat = tracker.stats.get(url);
  if (!stat) return;
  stat.failures += 1;
  stat.lastFailureAt = now;
  stat.lastError = error?.message || String(error || 'RPC error');
  const transientPenalty = /too many requests|rate|timeout|fetch failed|network|429/i.test(stat.lastError) ? 15000 : 5000;
  stat.cooldownUntil = now + Math.min(60000, transientPenalty * Math.min(4, stat.failures));
}

function rpcScore(stat, now = Date.now()) {
  if (stat.cooldownUntil > now) return Number.POSITIVE_INFINITY;
  return (stat.failures * 3000) + (stat.latencyMs ?? 750);
}

export function selectHealthyRpcUrl(tracker, now = Date.now()) {
  const ordered = tracker.urls
    .map((url, index) => ({ url, index, stat: tracker.stats.get(url), score: rpcScore(tracker.stats.get(url), now) }))
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const selected = ordered[0]?.url || tracker.urls[0];
  tracker.lastSelectedUrl = selected;
  return selected;
}

export function rpcDiagnosticsSnapshot(tracker = null, now = Date.now()) {
  const snapshot = (item) => item.urls.map((url) => {
    const stat = item.stats.get(url);
    return {
      url,
      successes: stat.successes,
      failures: stat.failures,
      latencyMs: stat.latencyMs,
      lastSuccessAt: stat.lastSuccessAt,
      lastFailureAt: stat.lastFailureAt,
      cooldownMs: Math.max(0, stat.cooldownUntil - now),
      lastError: stat.lastError,
      active: item.lastSelectedUrl === url,
    };
  });
  if (tracker) return snapshot(tracker);
  return Object.fromEntries(Object.keys(CHAIN_CONFIGS).map((chainId) => [chainId, snapshot(rpcHealthForChain(chainId))]));
}

export function activeRpcUrlForChain(chainId = 'arbitrum') {
  const tracker = rpcHealthForChain(chainId);
  return tracker.lastSelectedUrl || selectHealthyRpcUrl(tracker);
}

function rpcUrlsForChain(chainId = 'arbitrum') {
  return CHAIN_CONFIGS[chainId]?.rpcUrls || ARBITRUM_RPC_URLS;
}

function nextRpcUrl(rpcUrl, chainId = 'arbitrum') {
  if (rpcUrl) return rpcUrl;
  const tracker = rpcHealthForChain(chainId);
  const healthyUrl = selectHealthyRpcUrl(tracker);
  const urls = tracker.urls;
  const cursor = rpcCursors.get(chainId) || 0;
  const url = healthyUrl || urls[cursor % urls.length];
  rpcCursors.set(chainId, cursor + 1);
  return url;
}

async function rpcCall(rpcUrl, method, params, chainId = 'arbitrum') {
  let lastError;
  const attempts = rpcUrl ? 1 : rpcUrlsForChain(chainId).length;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const url = nextRpcUrl(rpcUrl, chainId);
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const body = await response.json();
      if (body.error) {
        const error = new Error(body.error.message || 'RPC error');
        error.data = body.error.data;
        error.code = body.error.code;
        throw error;
      }
      if (!rpcUrl) recordRpcSuccess(rpcHealthForChain(chainId), url, Date.now() - startedAt);
      return body.result;
    } catch (error) {
      if (!rpcUrl) recordRpcFailure(rpcHealthForChain(chainId), url, error);
      lastError = error;
    }
  }
  throw lastError || new Error('RPC error');
}

async function rpcBatch(calls, rpcUrl, chainId = 'arbitrum') {
  let lastError;
  const attempts = rpcUrl ? 1 : rpcUrlsForChain(chainId).length;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const url = nextRpcUrl(rpcUrl, chainId);
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(calls.map((call, index) => ({
          jsonrpc: '2.0',
          id: index + 1,
          method: 'eth_call',
          params: [{ to: call.to, data: call.data }, 'latest'],
        }))),
      });
      const body = await response.json();
      if (!Array.isArray(body)) throw new Error('Invalid RPC batch response');
      const results = new Map(body.map((item) => [item.id - 1, item.error ? null : item.result]));
      if (!rpcUrl) recordRpcSuccess(rpcHealthForChain(chainId), url, Date.now() - startedAt);
      return calls.map((_, index) => results.get(index) || null);
    } catch (error) {
      if (!rpcUrl) recordRpcFailure(rpcHealthForChain(chainId), url, error);
      lastError = error;
    }
  }
  throw lastError || new Error('RPC batch error');
}

export async function ethCall(to, data, rpcUrl = null, chainId = 'arbitrum') {
  assertConfiguredAddress(to);
  return rpcCall(rpcUrl, 'eth_call', [{ to, data }, 'latest'], chainId);
}

async function safeEthCall(to, data, rpcUrl, retries = 2, chainId = 'arbitrum') {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await ethCall(to, data, rpcUrl, chainId);
    } catch (error) {
      if (attempt === retries || !/too many requests|rate|timeout|fetch failed|network|429/i.test(error?.message || '')) return null;
      await new Promise((resolve) => globalThis.setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  return null;
}

async function safeEthBatch(calls, rpcUrl, retries = 2, chainId = 'arbitrum') {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const results = await rpcBatch(calls, rpcUrl, chainId);
      if (results.every((result) => result !== null) || attempt === retries) return results;
      throw new Error('RPC batch returned partial null results');
    } catch (error) {
      if (attempt === retries || !/too many requests|rate|timeout|fetch failed|network|429/i.test(error?.message || '')) {
        return calls.map(() => null);
      }
      await new Promise((resolve) => globalThis.setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  return calls.map(() => null);
}

async function resilientEthBatch(calls, rpcUrl, retries = 2, chainId = 'arbitrum') {
  const results = await safeEthBatch(calls, rpcUrl, retries, chainId);
  if (results.every((result) => result !== null)) return results;
  return Promise.all(results.map(async (result, index) => {
    if (result !== null) return result;
    return safeEthCall(calls[index].to, calls[index].data, rpcUrl, retries, chainId);
  }));
}

function eulerAccountCandidates(owner, count = 16) {
  assertConfiguredAddress(owner, 'Wallet');
  const clean = strip0x(owner).toLowerCase();
  const prefix = clean.slice(0, -2);
  const baseByte = Number.parseInt(clean.slice(-2), 16);
  return Array.from({ length: count }, (_, index) => {
    const nextByte = ((baseByte + index) & 0xff).toString(16).padStart(2, '0');
    return `0x${prefix}${nextByte}`;
  });
}

async function selectVaultAccount({ vault, owner, chainId = 'arbitrum' }) {
  const candidates = eulerAccountCandidates(owner);
  const calls = candidates.flatMap((account) => ([
    { to: vault, data: encodeBalanceOfCalldata(account) },
    { to: vault, data: encodeMaxWithdrawCalldata(account) },
  ]));
  const results = await resilientEthBatch(calls, null, 1, chainId);
  let selected = {
    account: owner,
    shareRaw: 0n,
    maxWithdrawRaw: 0n,
  };
  for (let index = 0; index < candidates.length; index += 1) {
    const shareRaw = decodeUint(results[index * 2]);
    const maxWithdrawRaw = decodeUint(results[index * 2 + 1]);
    if (candidates[index].toLowerCase() === owner.toLowerCase()) {
      selected = { account: candidates[index], shareRaw, maxWithdrawRaw };
    }
    if (shareRaw > 0n || maxWithdrawRaw > 0n) {
      return { account: candidates[index], shareRaw, maxWithdrawRaw };
    }
  }
  return selected;
}

async function selectMarketAccount({ collateralVault, debtVault, owner, chainId = 'arbitrum' }) {
  const candidates = eulerAccountCandidates(owner);
  const calls = candidates.flatMap((account) => ([
    { to: collateralVault, data: encodeBalanceOfCalldata(account) },
    { to: debtVault, data: encodeDebtOfCalldata(account) },
  ]));
  const results = await resilientEthBatch(calls, null, 1, chainId);
  let selected = {
    account: owner,
    collateralSharesRaw: 0n,
    debtRaw: 0n,
  };
  for (let index = 0; index < candidates.length; index += 1) {
    const collateralSharesRaw = decodeUint(results[index * 2]);
    const debtRaw = decodeUint(results[index * 2 + 1]);
    if (candidates[index].toLowerCase() === owner.toLowerCase()) {
      selected = { account: candidates[index], collateralSharesRaw, debtRaw };
    }
    if (collateralSharesRaw > 0n || debtRaw > 0n) {
      return { account: candidates[index], collateralSharesRaw, debtRaw };
    }
  }
  return selected;
}

async function selectMarketDepositAccount({ collateralVault, debtVault, owner, chainId = 'arbitrum' }) {
  const evc = await readEvc(debtVault, chainId);
  const candidates = eulerAccountCandidates(owner);
  const calls = candidates.flatMap((account) => ([
    { to: collateralVault, data: encodeBalanceOfCalldata(account) },
    { to: debtVault, data: encodeDebtOfCalldata(account) },
    { to: evc, data: encodeCall(SELECTORS.getControllers, [encodeAddress(account)]) },
    { to: evc, data: encodeCall(SELECTORS.getCollaterals, [encodeAddress(account)]) },
  ]));
  const results = await resilientEthBatch(calls, null, 1, chainId);
  let firstEmpty = '';
  let ownerEmpty = false;
  for (let index = 0; index < candidates.length; index += 1) {
    const account = candidates[index];
    const collateralSharesRaw = decodeUint(results[index * 4]);
    const debtRaw = decodeUint(results[index * 4 + 1]);
    const controllers = decodeAddressArray(results[index * 4 + 2]);
    const collaterals = decodeAddressArray(results[index * 4 + 3]);
    const targetPosition = collateralSharesRaw > 0n || debtRaw > 0n
      || controllers.includes(debtVault.toLowerCase())
      || collaterals.includes(collateralVault.toLowerCase());
    if (targetPosition) return { account, shareRaw: collateralSharesRaw, evc };
    const empty = controllers.length === 0 && collaterals.length === 0 && collateralSharesRaw === 0n && debtRaw === 0n;
    if (account.toLowerCase() === owner.toLowerCase()) ownerEmpty = empty;
    if (!firstEmpty && empty) firstEmpty = account;
  }
  if (ownerEmpty) return { account: owner, shareRaw: 0n, evc };
  return { account: firstEmpty || owner, shareRaw: 0n, evc };
}

export async function readVaultAsset(vault, rpcUrl, chainId = 'arbitrum') {
  assertConfiguredAddress(vault, 'Vault');
  const result = await ethCall(vault, SELECTORS.asset, rpcUrl, chainId);
  return decodeAddress(result);
}

export async function readDecimals(token, rpcUrl, chainId = 'arbitrum') {
  assertConfiguredAddress(token, 'Token');
  const result = await ethCall(token, SELECTORS.decimals, rpcUrl, chainId);
  return Number(decodeUint(result));
}

export async function readAllowance(token, owner, spender, chainId = 'arbitrum') {
  assertConfiguredAddress(token, 'Token');
  assertConfiguredAddress(owner, 'Owner');
  assertConfiguredAddress(spender, 'Spender');
  const data = encodeCall(SELECTORS.allowance, [encodeAddress(owner), encodeAddress(spender)]);
  return decodeUint(await ethCall(token, data, null, chainId));
}

export async function getConnectedWalletAccount() {
  if (!window.ethereum) return '';
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return accounts?.[0] || '';
}

export function resetWalletConnectionCache() {
  walletAccountRequest = null;
  walletAccountRequested = false;
  cachedWalletAccount = null;
  walletNetworkRequest = null;
  walletNetworkRequestChain = null;
}

export async function requestWalletAccount({ forcePermission = false } = {}) {
  if (!window.ethereum) throw new Error('No wallet found.');
  if (forcePermission && window.ethereum.request) {
    try {
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
    } catch (error) {
      if (!/wallet_requestPermissions|unsupported|does not exist/i.test(error?.message || '')) throw error;
    }
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  cachedWalletAccount = accounts?.[0] || null;
  walletAccountRequested = Boolean(cachedWalletAccount);
  if (!cachedWalletAccount) throw new Error('Wallet did not return an account.');
  return cachedWalletAccount;
}

export async function readTokenBalance(token, owner, chainId = 'arbitrum') {
  assertConfiguredAddress(token, 'Token');
  assertConfiguredAddress(owner, 'Owner');
  return decodeUint(await ethCall(token, encodeBalanceOfCalldata(owner), null, chainId));
}

export function buildPreflightTransactionRequest({ from, to, data }) {
  return {
    method: 'eth_estimateGas',
    params: [{ from, to, data }],
  };
}

const EULER_CUSTOM_ERRORS = {
  '0x9f428ac4': 'Insufficient allowance. Approve token spending first.',
  '0xf077d877': 'The vault does not currently have enough available liquidity for this withdrawal. Try a smaller amount.',
  '0x304fad62': 'The entered asset amount is larger than the vault can process for this account.',
  '0x73748093': 'Insufficient EVault share balance for this withdrawal.',
  '0xdac9cb7d': 'Insufficient debt for this repayment.',
  '0x74f36063': 'The vault rejected the transaction because it is already processing another operation.',
  '0x750f8817': 'This operation is disabled on the vault.',
  '0xb53a01cc': 'The account has outstanding debt. Repay debt before this operation.',
  '0xb2be531b': 'Repay amount is greater than the account debt.',
  '0x13790bf0': 'Borrowing controller is not enabled for this account.',
  '0x9b559a75': 'Collateral is not enabled for this account.',
  '0x370f9b38': 'The vault rejected one of the transaction addresses.',
  '0x6081f51b': 'Enter an asset amount greater than 0.',
  '0xca0985cf': 'Enter a share amount greater than 0.',
  '0x08e2ce17': 'Wallet is not authorized for this Euler account.',
  '0xf0991feb': 'Euler account check is not authorized for this wallet.',
  '0xfea48513': 'This vault does not support that operation.',
  '0x2082e200': 'The vault returned an empty custom error.',
  '0x9af486d3': 'Borrow cap configuration rejected the transaction.',
  '0xaeb1b8c6': 'Supply cap configuration rejected the transaction.',
  '0x9b314d55': 'This collateral vault is not accepted by the market.',
  '0x34373fbc': 'Euler account liquidity check failed. Reduce the withdrawal or repay debt first.',
  '0x43855d0f': 'No liability was found for this account.',
  '0x6d588708': 'This vault is not enabled as a controller for the account.',
  '0xcf4d8f28': 'Vault fee configuration rejected the transaction.',
  '0x426073f2': 'Supply cap would be exceeded.',
  '0x6ef90ef1': 'Borrow cap would be exceeded.',
  '0x89563211': 'This collateral asset is not configured for the selected market.',
  '0x5b923371': 'No price oracle is configured for this market.',
  '0xc9e70637': 'The vault rejected the asset receiver address.',
  '0x9b441636': 'The vault rejected the share owner address.',
  '0xa8af73b4': 'The vault rejected the share receiver address.',
  '0x458cbc27': 'Borrow would exceed the market max LTV.',
  '0xd36283e7': 'Transaction would breach the liquidation LTV.',
  '0xd0ccf7a0': 'This hook target is not configured for the vault.',
  '0x9773bb71': 'Collateral token transfer failed. Check that the wallet holding the token is the account funding the Euler deposit and that the wallet has enough token balance.',
  '0xe07f2e6b': 'Wallet is not authorized in the Euler Vault Connector.',
  '0x8133abd1': 'Euler Vault Connector rejected an invalid address.',
  '0xf1be4519': 'Euler controller check failed for this account.',
  '0x38ae747c': 'Euler Vault Connector returned an empty custom error.',
};

function firstHexData(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/0x[0-9a-fA-F]{8,}/);
    return match?.[0] || '';
  }
  if (typeof value !== 'object') return '';
  const direct = firstHexData(value.data)
    || firstHexData(value.result)
    || firstHexData(value.error)
    || firstHexData(value.info)
    || firstHexData(value.cause)
    || firstHexData(value.body)
    || firstHexData(value.message);
  if (direct) return direct;
  for (const item of Object.values(value)) {
    const nested = firstHexData(item);
    if (nested) return nested;
  }
  return '';
}

function decodeAbiString(data) {
  const clean = strip0x(data);
  if (!clean.startsWith('08c379a0') || clean.length < 136) return '';
  try {
    const byteLength = Number(BigInt(`0x${clean.slice(72, 136)}`));
    const textHex = clean.slice(136, 136 + byteLength * 2);
    const bytes = textHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [];
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
}

export function decodeEulerTransactionError(error) {
  const data = firstHexData(error);
  if (!data) return '';
  const selector = data.slice(0, 10).toLowerCase();
  const reason = decodeAbiString(data);
  if (reason) return reason;
  if (selector === '0x4e487b71') return 'Contract panic. The vault rejected the transaction before execution.';
  return EULER_CUSTOM_ERRORS[selector] || `Euler custom error ${selector}.`;
}

export function normalizeTransactionError(error) {
  const message = error?.message || String(error || 'Transaction failed');
  const decoded = decodeEulerTransactionError(error);
  if (decoded) return decoded;
  if (/not configured|hex string has length 0|want 40 for common\.Address|invalid argument 0/i.test(message)) return 'Contract address is not configured for this page.';
  if (/user rejected|user denied|rejected the request|4001/i.test(message)) return 'Wallet rejected the transaction.';
  if (/insufficient funds|insufficient balance/i.test(message)) return 'Insufficient balance for this transaction.';
  if (/allowance/i.test(message)) return 'Insufficient allowance. Approve token spending first.';
  if (/cap exceeded|supply cap|borrow cap/i.test(message)) return 'Market cap would be exceeded.';
  if (/account liquidity|insufficient collateral|health|liquidation/i.test(message)) return 'Account health check failed. Reduce the withdrawal or repay debt first.';
  if (/chain|network|unsupported/i.test(message)) return 'Wrong network. Switch your wallet to the page network.';
  if (/too many requests|rate|timeout|fetch failed|network|429/i.test(message)) return 'RPC degraded. The app will retry with another endpoint.';
  if (/execution reverted:\s*ed:?$/i.test(message)) return 'Euler rejected the transaction, but the wallet/RPC only returned short code "ed" instead of the full custom-error selector. Refresh live balances, try a smaller amount, and check the wallet details for the full revert data.';
  if (/execution reverted|revert|call exception/i.test(message)) return `Contract reverted: ${message.replace(/^.*?(execution reverted|revert|call exception)[: ]*/i, '').slice(0, 180)}`;
  return message;
}

export function formatGasEstimate(gasHex) {
  if (!gasHex) return 'unknown gas';
  return `${BigInt(gasHex).toLocaleString()} gas`;
}

export async function preflightTransaction(to, data, from) {
  assertConfiguredAddress(to);
  assertConfiguredAddress(from, 'Wallet');
  try {
    await window.ethereum.request({ method: 'eth_call', params: [{ from, to, data }, 'latest'] });
    const gas = await window.ethereum.request(buildPreflightTransactionRequest({ from, to, data }));
    return { gas, formattedGas: formatGasEstimate(gas) };
  } catch (error) {
    throw new Error(`Transaction preflight failed: ${normalizeTransactionError(error)}`);
  }
}

export async function sendTransaction(to, data, from, { onPreflight, label = 'Transaction' } = {}) {
  assertConfiguredAddress(to);
  assertConfiguredAddress(from, 'Wallet');
  const preflight = await preflightTransaction(to, data, from);
  onPreflight?.({ ...preflight, label });
  try {
    return await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from, to, data }],
    });
  } catch (error) {
    throw new Error(normalizeTransactionError(error));
  }
}

export async function waitForTransaction(hash) {
  if (!hash) return null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const receipt = await window.ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    });
    if (receipt) return receipt;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 2000));
  }
  throw new Error('Transaction was submitted but not confirmed yet.');
}

export async function ensureArbitrumWallet() {
  return ensureWallet('arbitrum');
}

export async function getWalletChainHex() {
  if (!window.ethereum) throw new Error('No wallet found.');
  return window.ethereum.request({ method: 'eth_chainId' });
}

export function walletChainHexFor(chainId = 'arbitrum') {
  return (CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS.arbitrum).chainHex;
}

let walletAccountRequest = null;
let walletAccountRequested = false;
let cachedWalletAccount = null;
let walletNetworkRequest = null;
let walletNetworkRequestChain = null;

async function getWalletAccount() {
  if (!window.ethereum) throw new Error('No wallet found.');
  const connectedAccounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(() => []);
  if (connectedAccounts?.[0]) {
    cachedWalletAccount = connectedAccounts[0];
    return cachedWalletAccount;
  }
  if (cachedWalletAccount) return cachedWalletAccount;
  if (walletAccountRequest) return walletAccountRequest;
  if (walletAccountRequested) {
    throw new Error('Wallet is not connected. Connect this site in your wallet, then retry.');
  }
  walletAccountRequested = true;
  walletAccountRequest = window.ethereum.request({ method: 'eth_requestAccounts' })
    .then((accounts) => {
      cachedWalletAccount = accounts?.[0] || null;
      if (!cachedWalletAccount) throw new Error('Wallet did not return an account.');
      return cachedWalletAccount;
    })
    .finally(() => {
      walletAccountRequest = null;
    });
  return walletAccountRequest;
}

export async function switchWalletNetwork(chainId = 'arbitrum') {
  if (!window.ethereum) throw new Error('No wallet found.');
  const chainConfig = CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS.arbitrum;
  const activeChain = await window.ethereum.request({ method: 'eth_chainId' }).catch(() => null);
  if (String(activeChain || '').toLowerCase() === chainConfig.chainHex.toLowerCase()) {
    return chainConfig.chainHex;
  }
  if (walletNetworkRequest && walletNetworkRequestChain === chainConfig.chainHex) {
    return walletNetworkRequest;
  }
  walletNetworkRequestChain = chainConfig.chainHex;
  walletNetworkRequest = (async () => {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainConfig.chainHex }] });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainConfig.chainHex,
        chainName: chainConfig.chainName,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: chainConfig.rpcUrls,
        blockExplorerUrls: chainConfig.explorerUrls,
      }],
    });
  }
  return chainConfig.chainHex;
  })().finally(() => {
    walletNetworkRequest = null;
    walletNetworkRequestChain = null;
  });
  return walletNetworkRequest;
}

export async function ensureWallet(chainId = 'arbitrum') {
  await switchWalletNetwork(chainId);
  return getWalletAccount();
}

export async function approveIfNeeded({ token, owner, spender, amount, chainId = 'arbitrum' }) {
  assertConfiguredAddress(token, 'Token');
  assertConfiguredAddress(owner, 'Owner');
  assertConfiguredAddress(spender, 'Spender');
  const allowance = await readAllowance(token, owner, spender, chainId);
  if (allowance >= amount) return null;
  const hash = await sendTransaction(
    token,
    encodeCall(SELECTORS.approve, [encodeAddress(spender), encodeUint(MAX_UINT256)]),
    owner,
  );
  await waitForTransaction(hash);
  return hash;
}

export async function depositToVault({ vault, amountText, onTransactionStep, onPreflight, chainId = 'arbitrum', marketDebtVault = '', positionAccount = '' }) {
  assertConfiguredAddress(vault, 'Vault');
  const owner = await ensureWallet(chainId);
  if (positionAccount) assertConfiguredAddress(positionAccount, 'Position account');
  const token = await readVaultAsset(vault, null, chainId);
  const decimals = await readDecimals(token, null, chainId);
  const amount = parseUnits(amountText, decimals);
  if (amount <= 0n) throw new Error('Enter an amount greater than 0.');
  const selected = positionAccount && marketDebtVault
    ? { account: positionAccount, shareRaw: 0n, evc: await readEvc(marketDebtVault, chainId) }
    : marketDebtVault
    ? await selectMarketDepositAccount({ collateralVault: vault, debtVault: marketDebtVault, owner, chainId })
    : await selectVaultAccount({ vault, owner, chainId });
  const receiver = selected.shareRaw > 0n ? selected.account : owner;
  const finalReceiver = marketDebtVault ? selected.account : receiver;
  const allowance = await readAllowance(token, owner, vault, chainId);
  const needsApproval = allowance < amount;
  const marketCollateralEnabled = marketDebtVault
    ? await isCollateralEnabled({ evc: selected.evc, owner, account: finalReceiver, collateralVault: vault, chainId })
    : true;
  const total = (needsApproval ? 1 : 0) + 1 + (marketCollateralEnabled ? 0 : 1);
  let step = 1;
  if (needsApproval) {
    onTransactionStep?.({ index: step, total, label: 'Approve token spend' });
    const approveHash = await sendTransaction(
      token,
      encodeCall(SELECTORS.approve, [encodeAddress(vault), encodeUint(MAX_UINT256)]),
      owner,
      { onPreflight, label: 'Approve token spend' },
    );
    await waitForTransaction(approveHash);
    step += 1;
  }
  if (marketDebtVault) {
    onTransactionStep?.({ index: step, total, label: 'Deposit collateral' });
    const hash = await sendTransaction(
      selected.evc,
      encodeEvcBatch(buildMarketDepositBorrowBatchItems({
        account: finalReceiver,
        collateralSourceAccount: owner,
        collateralVault: vault,
        debtVault: marketDebtVault,
        evc: selected.evc,
        collateralAmount: amount,
        collateralEnabled: marketCollateralEnabled,
        controllerEnabled: true,
      })),
      owner,
      { onPreflight, label: marketCollateralEnabled ? 'Deposit collateral' : 'Deposit and enable collateral' },
    );
    return hash;
  }
  onTransactionStep?.({ index: step, total, label: 'Deposit assets' });
  return sendTransaction(
    vault,
    encodeCall(SELECTORS.deposit, [encodeUint(amount), encodeAddress(finalReceiver)]),
    owner,
    { onPreflight, label: 'Deposit assets' },
  );
}

export async function fetchVaultWalletBalance({ vault, chainId = 'arbitrum' }) {
  assertConfiguredAddress(vault, 'Vault');
  const owner = await getConnectedWalletAccount();
  if (!owner) return null;
  const token = await readVaultAsset(vault, null, chainId);
  const decimals = await readDecimals(token, null, chainId);
  const raw = await readTokenBalance(token, owner, chainId);
  return {
    owner,
    token,
    decimals,
    raw,
    formatted: formatTokenAmount(raw, decimals, 4),
  };
}

export async function fetchVaultWithdrawCapacity({ vault, marketDebtVault = '', chainId = 'arbitrum', ownerOnly = false }) {
  assertConfiguredAddress(vault, 'Vault');
  const owner = await getConnectedWalletAccount();
  if (!owner) return null;
  const token = await readVaultAsset(vault, null, chainId);
  const decimals = await readDecimals(token, null, chainId);
  const selected = ownerOnly
    ? {
      account: owner,
      shareRaw: decodeUint(await walletCall(vault, encodeBalanceOfCalldata(owner), chainId).catch(() => '0x0')),
      maxWithdrawRaw: decodeUint(await walletCall(vault, encodeMaxWithdrawCalldata(owner), chainId).catch(() => '0x0')),
    }
    : marketDebtVault
    ? await selectMarketAccount({ collateralVault: vault, debtVault: marketDebtVault, owner, chainId })
    : await selectVaultAccount({ vault, owner, chainId });
  const account = selected.account;
  const shareRaw = selected.shareRaw ?? selected.collateralSharesRaw ?? 0n;
  const maxWithdrawRaw = selected.maxWithdrawRaw ?? decodeUint(await walletCall(vault, encodeMaxWithdrawCalldata(account), chainId).catch(() => '0x0'));
  const suppliedRaw = shareRaw > 0n
    ? decodeUint(await walletCall(vault, encodeCall(SELECTORS.convertToAssets, [encodeUint(shareRaw)]), chainId))
    : 0n;
  const isSubaccount = account.toLowerCase() !== owner.toLowerCase();
  const raw = marketDebtVault ? maxWithdrawRaw : (maxWithdrawRaw === 0n && suppliedRaw > 0n ? suppliedRaw : maxWithdrawRaw);
  return {
    owner,
    account,
    isSubaccount,
    token,
    decimals,
    raw,
    shareRaw,
    suppliedRaw,
    formatted: formatTokenAmount(raw, decimals, 4),
    suppliedFormatted: formatTokenAmount(suppliedRaw, decimals, 4),
  };
}

function formatUsdValue(value) {
  const raw = BigInt(value || 0n);
  const sign = raw < 0n ? '-' : '';
  const absolute = raw < 0n ? -raw : raw;
  return `${sign}$${formatUnits(absolute, 18, 2)}`;
}

function formatHealthScore({ ltvBps, liquidationLtvBps }) {
  if (!ltvBps || ltvBps <= 0n || !liquidationLtvBps) return '---';
  return (Number(liquidationLtvBps) / Number(ltvBps)).toFixed(2);
}

async function readMarketPositionSnapshot({
  owner,
  account,
  collateralVault,
  debtVault,
  collateralAsset,
  debtAsset,
  collateralDecimals,
  debtDecimals,
  collateralSharesRaw,
  debtRaw,
  oracle,
  unit,
  borrowLtvBps,
  liquidationLtvBps,
  cashRaw,
  chainId,
}) {
  const [collateralAssetsRaw, maxWithdrawRaw, liquidityRaw, collateralQuoteRaw, debtQuoteRaw] = await Promise.all([
    collateralSharesRaw > 0n
      ? walletCall(collateralVault, encodeCall(SELECTORS.convertToAssets, [encodeUint(collateralSharesRaw)]), chainId).catch(() => '0x0')
      : Promise.resolve('0x0'),
    walletCall(collateralVault, encodeMaxWithdrawCalldata(account), chainId).catch(() => '0x0'),
    safeEthCall(debtVault, encodeAccountLiquidityCalldata(account), null, 1, chainId),
    walletCall(oracle, encodeCall(SELECTORS.getQuote, [
      encodeUint(10n ** BigInt(collateralDecimals)),
      encodeAddress(collateralAsset),
      encodeAddress(unit),
    ]), chainId),
    walletCall(oracle, encodeCall(SELECTORS.getQuote, [
      encodeUint(10n ** BigInt(debtDecimals)),
      encodeAddress(debtAsset),
      encodeAddress(unit),
    ]), chainId),
  ]);
  const collateralAssets = decodeUint(collateralAssetsRaw);
  const maxWithdraw = decodeUint(maxWithdrawRaw);
  const collateralQuote = decodeUint(collateralQuoteRaw);
  const debtQuote = decodeUint(debtQuoteRaw);
  const collateralValue = collateralAssets * collateralQuote / (10n ** BigInt(collateralDecimals));
  const debtValue = debtRaw * debtQuote / (10n ** BigInt(debtDecimals));
  const netAssetValue = collateralValue - debtValue;
  const ltvBps = collateralValue === 0n ? 0n : (debtValue * 10000n) / collateralValue;
  const liquidationPrice = debtValue > 0n && collateralAssets > 0n && liquidationLtvBps > 0n
    ? (debtValue * 10000n * (10n ** BigInt(collateralDecimals))) / (collateralAssets * liquidationLtvBps)
    : 0n;
  const borrowCapacityRaw = calculateBorrowCapacityRaw({
    collateralValue: liquidityRaw ? decodeUintWord(liquidityRaw, 0) : 0n,
    liabilityValue: liquidityRaw ? decodeUintWord(liquidityRaw, 1) : 0n,
    debtQuote,
    debtDecimals,
    cash: cashRaw,
  });
  const ltvNumber = Number(ltvBps) / 100;
  const liquidationNumber = Number(liquidationLtvBps || 0n) / 100;
  const ltvProgress = liquidationNumber > 0 ? Math.min(100, (ltvNumber / liquidationNumber) * 100) : 0;
  return {
    owner,
    account,
    isSubaccount: account.toLowerCase() !== owner.toLowerCase(),
    collateralShares: collateralSharesRaw,
    collateralAssets,
    debt: debtRaw,
    maxWithdraw,
    borrowCapacityRaw,
    collateralValue,
    debtValue,
    netAssetValue,
    collateralFormatted: formatTokenAmount(collateralAssets, collateralDecimals, 4),
    debtFormatted: formatTokenAmount(debtRaw, debtDecimals, 4),
    withdrawCapacityFormatted: formatTokenAmount(maxWithdraw, collateralDecimals, 4),
    borrowCapacityFormatted: formatTokenAmount(borrowCapacityRaw, debtDecimals, 4),
    collateralValueFormatted: formatUsdValue(collateralValue),
    debtValueFormatted: formatUsdValue(debtValue),
    netAssetValueFormatted: formatUsdValue(netAssetValue),
    collateralPriceFormatted: formatUsdValue(collateralQuote),
    collateralOraclePriceFormatted: formatUsdValue(collateralQuote),
    debtPriceFormatted: formatUsdValue(debtQuote),
    debtOraclePriceFormatted: formatUsdValue(debtQuote),
    liquidationPriceFormatted: liquidationPrice > 0n ? formatUsdValue(liquidationPrice) : 'N/A',
    ltv: `${ltvNumber.toFixed(2)}%`,
    ltvBps,
    borrowLtv: borrowLtvBps > 0n ? formatPercentFromBps(borrowLtvBps) : 'Not configured',
    liquidationLtv: liquidationLtvBps > 0n ? formatPercentFromBps(liquidationLtvBps) : 'Not configured',
    ltvPair: `${ltvNumber.toFixed(2)}/${liquidationNumber.toFixed(0)}%`,
    ltvProgress: ltvProgress.toFixed(2),
    healthScore: formatHealthScore({ ltvBps, liquidationLtvBps }),
    warning: accountLtvWarning({ collateralValue, debtValue, ltvBps, liquidationLtvBps }),
  };
}

export async function fetchMarketPositions({ debtVault, collateralVault, chainId = 'arbitrum', includeEmptyOwner = false }) {
  assertConfiguredAddress(debtVault, 'Debt vault');
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  const owner = await getConnectedWalletAccount();
  if (!owner) return [];
  const [collateralAsset, debtAsset, oracleRaw, unitRaw, borrowLtvRaw, liquidationLtvRaw, cashRaw] = await Promise.all([
    readVaultAsset(collateralVault, null, chainId),
    readVaultAsset(debtVault, null, chainId),
    walletCall(debtVault, SELECTORS.oracle, chainId),
    walletCall(debtVault, SELECTORS.unitOfAccount, chainId),
    walletCall(debtVault, encodeCall(SELECTORS.ltvBorrow, [encodeAddress(collateralVault)]), chainId),
    walletCall(debtVault, encodeCall(SELECTORS.ltvLiquidation, [encodeAddress(collateralVault)]), chainId),
    walletCall(debtVault, SELECTORS.cash, chainId),
  ]);
  const [collateralDecimals, debtDecimals] = await Promise.all([
    readDecimals(collateralAsset, null, chainId),
    readDecimals(debtAsset, null, chainId),
  ]);
  const candidates = eulerAccountCandidates(owner);
  const calls = candidates.flatMap((account) => ([
    { to: collateralVault, data: encodeBalanceOfCalldata(account) },
    { to: debtVault, data: encodeDebtOfCalldata(account) },
  ]));
  const results = await resilientEthBatch(calls, null, 1, chainId);
  const active = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const account = candidates[index];
    const collateralSharesRaw = decodeUint(results[index * 2]);
    const debtRaw = decodeUint(results[index * 2 + 1]);
    if (collateralSharesRaw > 0n || debtRaw > 0n || (includeEmptyOwner && account.toLowerCase() === owner.toLowerCase())) {
      active.push({ account, collateralSharesRaw, debtRaw });
    }
  }
  if (!active.length) return [];
  const common = {
    owner,
    collateralVault,
    debtVault,
    collateralAsset,
    debtAsset,
    collateralDecimals,
    debtDecimals,
    oracle: decodeAddress(oracleRaw),
    unit: decodeAddress(unitRaw),
    borrowLtvBps: decodeUint(borrowLtvRaw),
    liquidationLtvBps: decodeUint(liquidationLtvRaw),
    cashRaw: decodeUint(cashRaw),
    chainId,
  };
  return Promise.all(active.map((position) => readMarketPositionSnapshot({ ...common, ...position })));
}

export async function fetchVaultRepayCapacity({ debtVault, collateralVault = '', chainId = 'arbitrum' }) {
  assertConfiguredAddress(debtVault, 'Debt vault');
  const owner = await getConnectedWalletAccount();
  if (!owner) return null;
  const token = await readVaultAsset(debtVault, null, chainId);
  const decimals = await readDecimals(token, null, chainId);
  const selected = collateralVault
    ? await selectMarketAccount({ collateralVault, debtVault, owner, chainId })
    : { account: owner, debtRaw: decodeUint(await walletCall(debtVault, encodeDebtOfCalldata(owner), chainId)) };
  const [debtRaw, balanceRaw] = await Promise.all([
    Promise.resolve(`0x${encodeUint(selected.debtRaw || 0n)}`),
    walletCall(token, encodeBalanceOfCalldata(owner), chainId),
  ]);
  const debt = decodeUint(debtRaw);
  const balance = decodeUint(balanceRaw);
  const raw = debt < balance ? debt : balance;
  return {
    owner,
    account: selected.account,
    isSubaccount: selected.account.toLowerCase() !== owner.toLowerCase(),
    token,
    decimals,
    raw,
    debt,
    balance,
    formatted: formatTokenAmount(raw, decimals, 4),
  };
}

export async function fetchMarketBorrowCapacity({ debtVault, collateralVault = '', chainId = 'arbitrum' }) {
  assertConfiguredAddress(debtVault, 'Debt vault');
  if (collateralVault) assertConfiguredAddress(collateralVault, 'Collateral vault');
  const owner = await getConnectedWalletAccount();
  if (!owner) return null;
  const selected = collateralVault
    ? await selectMarketAccount({ collateralVault, debtVault, owner, chainId })
    : { account: owner };
  const [token, evc, unitRaw, oracleRaw, cashRaw] = await Promise.all([
    readVaultAsset(debtVault, null, chainId),
    readEvc(debtVault, chainId),
    walletCall(debtVault, SELECTORS.unitOfAccount, chainId),
    walletCall(debtVault, SELECTORS.oracle, chainId),
    walletCall(debtVault, SELECTORS.cash, chainId),
  ]);
  const [decimals, liquidityRaw] = await Promise.all([
    readDecimals(token, null, chainId),
    walletCall(debtVault, encodeAccountLiquidityCalldata(selected.account), chainId).catch((error) => {
      if (/not controller/i.test(decodeEulerTransactionError(error)) || error?.data === '0x6d588708') return null;
      throw error;
    }),
  ]);
  const unit = decodeAddress(unitRaw);
  const oracle = decodeAddress(oracleRaw);
  const debtQuoteRaw = await walletCall(oracle, encodeCall(SELECTORS.getQuote, [
    encodeUint(10n ** BigInt(decimals)),
    encodeAddress(token),
    encodeAddress(unit),
  ]), chainId);
  const raw = calculateBorrowCapacityRaw({
    collateralValue: liquidityRaw ? decodeUintWord(liquidityRaw, 0) : 0n,
    liabilityValue: liquidityRaw ? decodeUintWord(liquidityRaw, 1) : 0n,
    debtQuote: decodeUint(debtQuoteRaw),
    debtDecimals: decimals,
    cash: decodeUint(cashRaw),
  });
  return {
    owner,
    account: selected.account,
    isSubaccount: selected.account.toLowerCase() !== owner.toLowerCase(),
    token,
    evc,
    decimals,
    raw,
    formatted: formatTokenAmount(raw, decimals, 4),
  };
}

export async function fetchMarketAccountLtv({ debtVault, collateralVault, chainId = 'arbitrum' }) {
  assertConfiguredAddress(debtVault, 'Debt vault');
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  const owner = await getConnectedWalletAccount();
  if (!owner) return null;
  const [collateralAsset, debtAsset, oracleRaw, unitRaw, borrowLtvRaw, liquidationLtvRaw, cashRaw] = await Promise.all([
    readVaultAsset(collateralVault, null, chainId),
    readVaultAsset(debtVault, null, chainId),
    walletCall(debtVault, SELECTORS.oracle, chainId),
    walletCall(debtVault, SELECTORS.unitOfAccount, chainId),
    walletCall(debtVault, encodeCall(SELECTORS.ltvBorrow, [encodeAddress(collateralVault)]), chainId),
    walletCall(debtVault, encodeCall(SELECTORS.ltvLiquidation, [encodeAddress(collateralVault)]), chainId),
    walletCall(debtVault, SELECTORS.cash, chainId),
  ]);
  const [collateralDecimals, debtDecimals] = await Promise.all([
    readDecimals(collateralAsset, null, chainId),
    readDecimals(debtAsset, null, chainId),
  ]);
  const selected = await selectMarketAccount({ collateralVault, debtVault, owner, chainId });
  return readMarketPositionSnapshot({
    owner,
    account: selected.account,
    collateralVault,
    debtVault,
    collateralAsset,
    debtAsset,
    collateralDecimals,
    debtDecimals,
    collateralSharesRaw: selected.collateralSharesRaw || 0n,
    debtRaw: selected.debtRaw || 0n,
    oracle: decodeAddress(oracleRaw),
    unit: decodeAddress(unitRaw),
    borrowLtvBps: decodeUint(borrowLtvRaw),
    liquidationLtvBps: decodeUint(liquidationLtvRaw),
    cashRaw: decodeUint(cashRaw),
    chainId,
  });
}

export async function withdrawFromVault({ vault, marketDebtVault = '', amountText, onPreflight, chainId = 'arbitrum', useEvcBatch = true }) {
  assertConfiguredAddress(vault, 'Vault');
  const owner = await ensureWallet(chainId);
  const token = await readVaultAsset(vault, null, chainId);
  const decimals = await readDecimals(token, null, chainId);
  const amount = parseUnits(amountText, decimals);
  if (amount <= 0n) throw new Error('Enter an amount greater than 0.');
  const selected = marketDebtVault
    ? await selectMarketAccount({ collateralVault: vault, debtVault: marketDebtVault, owner, chainId })
    : await selectVaultAccount({ vault, owner, chainId });
  const account = selected.account;
  const shareRaw = selected.shareRaw ?? selected.collateralSharesRaw ?? 0n;
  const withdrawData = encodeCall(SELECTORS.withdraw, [encodeUint(amount), encodeAddress(owner), encodeAddress(account)]);
  const evc = useEvcBatch ? await readEvc(vault, chainId).catch(() => '') : '';
  if (evc) {
    return sendTransaction(
      evc,
      encodeEvcBatch([{ targetContract: vault, onBehalfOfAccount: account, value: 0n, data: withdrawData }]),
      owner,
      { onPreflight, label: 'Withdraw assets through Euler account' },
    );
  }
  return sendTransaction(
    vault,
    withdrawData,
    owner,
    { onPreflight, label: 'Withdraw assets' },
  );
}

export async function withdrawCollateralFromPosition({ collateralVault, debtVault, positionAccount = '', amountText, onPreflight, chainId = 'arbitrum' }) {
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  assertConfiguredAddress(debtVault, 'Debt vault');
  const owner = await ensureWallet(chainId);
  const token = await readVaultAsset(collateralVault, null, chainId);
  const decimals = await readDecimals(token, null, chainId);
  const amount = parseUnits(amountText, decimals);
  if (amount <= 0n) throw new Error('Enter an amount greater than 0.');
  if (positionAccount) assertConfiguredAddress(positionAccount, 'Position account');
  const selected = positionAccount
    ? { account: positionAccount }
    : await selectMarketAccount({ collateralVault, debtVault, owner, chainId });
  const account = selected.account;
  const evc = await readEvc(collateralVault, chainId);
  return sendTransaction(
    evc,
    buildPositionCollateralWithdrawBatchCalldata({
      collateralVault,
      positionAccount: account,
      receiver: owner,
      amount,
    }),
    owner,
    { onPreflight, label: 'Withdraw collateral from position' },
  );
}

async function readEvc(vault, chainId = 'arbitrum') {
  assertConfiguredAddress(vault, 'Vault');
  return decodeAddress(await ethCall(vault, SELECTORS.evc, null, chainId));
}

async function walletCall(to, data, chainId = 'arbitrum') {
  assertConfiguredAddress(to);
  return ethCall(to, data, null, chainId);
}

async function enableCollateralIfNeeded({ evc, owner, account = owner, collateralVault, chainId = 'arbitrum' }) {
  const enabled = decodeUint(await walletCall(
    evc,
    encodeCall(SELECTORS.isCollateralEnabled, [encodeAddress(account), encodeAddress(collateralVault)]),
    chainId,
  )) === 1n;
  if (enabled) return null;
  const hash = await sendTransaction(
    evc,
    encodeCall(SELECTORS.enableCollateral, [encodeAddress(account), encodeAddress(collateralVault)]),
    owner,
  );
  await waitForTransaction(hash);
  return hash;
}

async function isCollateralEnabled({ evc, owner, account = owner, collateralVault, chainId = 'arbitrum' }) {
  return decodeUint(await walletCall(
    evc,
    encodeCall(SELECTORS.isCollateralEnabled, [encodeAddress(account), encodeAddress(collateralVault)]),
    chainId,
  )) === 1n;
}

async function isControllerEnabled({ evc, owner, account = owner, controllerVault, chainId = 'arbitrum' }) {
  return decodeUint(await walletCall(
    evc,
    encodeCall(SELECTORS.isControllerEnabled, [encodeAddress(account), encodeAddress(controllerVault)]),
    chainId,
  )) === 1n;
}

async function enableControllerIfNeeded({ evc, owner, account = owner, controllerVault, chainId = 'arbitrum' }) {
  const enabled = decodeUint(await walletCall(
    evc,
    encodeCall(SELECTORS.isControllerEnabled, [encodeAddress(account), encodeAddress(controllerVault)]),
    chainId,
  )) === 1n;
  if (enabled) return null;
  const hash = await sendTransaction(
    evc,
    encodeCall(SELECTORS.enableController, [encodeAddress(account), encodeAddress(controllerVault)]),
    owner,
  );
  await waitForTransaction(hash);
  return hash;
}

export async function borrowFromMarket({ debtVault, collateralVault, amountText, collateralAmountText = '', onTransactionStep, onPreflight, chainId = 'arbitrum' }) {
  assertConfiguredAddress(debtVault, 'Debt vault');
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  const owner = await ensureWallet(chainId);
  const [token, collateralToken] = await Promise.all([
    readVaultAsset(debtVault, null, chainId),
    readVaultAsset(collateralVault, null, chainId),
  ]);
  const [decimals, collateralDecimals] = await Promise.all([
    readDecimals(token, null, chainId),
    readDecimals(collateralToken, null, chainId),
  ]);
  const amount = parseUnits(amountText, decimals);
  const collateralAmount = collateralAmountText ? parseUnits(collateralAmountText, collateralDecimals) : 0n;
  if (amount <= 0n) throw new Error('Enter an amount greater than 0.');
  if (collateralAmount <= 0n) throw new Error('Enter a collateral amount. Euler market borrow opens through the combined deposit-and-borrow flow.');
  const evc = await readEvc(debtVault, chainId);
  const selected = await selectMarketDepositAccount({ collateralVault, debtVault, owner, chainId });
  const account = selected.account;
  const [collateralEnabled, controllerEnabled] = await Promise.all([
    isCollateralEnabled({ evc, owner, account, collateralVault, chainId }),
    isControllerEnabled({ evc, owner, account, controllerVault: debtVault, chainId }),
  ]);
  const allowance = collateralAmount > 0n ? await readAllowance(collateralToken, owner, collateralVault, chainId) : MAX_UINT256;
  const needsApproval = collateralAmount > 0n && allowance < collateralAmount;
  const total = (needsApproval ? 1 : 0) + 1;
  let step = 1;
  if (needsApproval) {
    onTransactionStep?.({ index: step, total, label: 'Approve collateral spend' });
    const approveHash = await sendTransaction(
      collateralToken,
      encodeCall(SELECTORS.approve, [encodeAddress(collateralVault), encodeUint(MAX_UINT256)]),
      owner,
      { onPreflight, label: 'Approve collateral spend' },
    );
    await waitForTransaction(approveHash);
    step += 1;
  }
  onTransactionStep?.({ index: step, total, label: 'Deposit collateral and borrow' });
  return sendTransaction(
    evc,
    buildMarketDepositBorrowBatchCalldata({
      account,
      collateralSourceAccount: owner,
      collateralVault,
      debtVault,
      evc,
      collateralAmount,
      borrowAmount: amount,
      borrowReceiver: owner,
      collateralEnabled,
      controllerEnabled,
    }),
    owner,
    { onPreflight, label: 'Deposit collateral and borrow' },
  );
}

export async function borrowMoreFromPosition({ debtVault, collateralVault, otherCollateralVaults = [], positionAccount = '', amountText, onTransactionStep, onPreflight, chainId = 'arbitrum' }) {
  assertConfiguredAddress(debtVault, 'Debt vault');
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  const owner = await ensureWallet(chainId);
  if (positionAccount) assertConfiguredAddress(positionAccount, 'Position account');
  const token = await readVaultAsset(debtVault, null, chainId);
  const decimals = await readDecimals(token, null, chainId);
  const amount = parseUnits(amountText, decimals);
  if (amount <= 0n) throw new Error('Enter an amount greater than 0.');
  const evc = await readEvc(debtVault, chainId);
  const selected = positionAccount
    ? { account: positionAccount }
    : await selectMarketAccount({ collateralVault, debtVault, owner, chainId });
  const account = selected.account;
  const disableItems = otherCollateralVaults
    .filter((vault) => isAddress(vault) && vault.toLowerCase() !== collateralVault.toLowerCase())
    .map((vault) => ({
      targetContract: evc,
      onBehalfOfAccount: '0x0000000000000000000000000000000000000000',
      value: 0n,
      data: encodeCall(SELECTORS.disableCollateral, [encodeAddress(account), encodeAddress(vault)]),
    }));
  const items = [
    ...disableItems,
    {
      targetContract: debtVault,
      onBehalfOfAccount: account,
      value: 0n,
      data: encodeCall(SELECTORS.borrow, [encodeUint(amount), encodeAddress(owner)]),
    },
  ];
  onTransactionStep?.({ index: 1, total: 1, label: 'Borrow more from position' });
  return sendTransaction(
    evc,
    encodeEvcBatch(items),
    owner,
    { onPreflight, label: 'Borrow more from position' },
  );
}

async function fetchEulerSwapQuote(url) {
  const response = await fetch(url);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || !body?.success) {
    const detail = body?.error || body?.message || response.statusText || 'Euler quote failed';
    throw new Error(`Euler multiply quote failed: ${detail}`);
  }
  const data = body.data;
  if (!data?.swap?.swapperAddress || !data?.swap?.swapperData || !data?.verify?.verifierAddress || !data?.verify?.verifierData) {
    throw new Error('Euler multiply quote did not include swapper and verifier calldata.');
  }
  return data;
}

export async function multiplyMarket({
  debtVault,
  collateralVault,
  amountText,
  onTransactionStep,
  onPreflight,
  chainId = 'arbitrum',
}) {
  assertConfiguredAddress(debtVault, 'Debt vault');
  assertConfiguredAddress(collateralVault, 'Collateral vault');
  const owner = await ensureWallet(chainId);
  const [debtToken, collateralToken, evc] = await Promise.all([
    readVaultAsset(debtVault, null, chainId),
    readVaultAsset(collateralVault, null, chainId),
    readEvc(debtVault, chainId),
  ]);
  const decimals = await readDecimals(debtToken, null, chainId);
  const amount = parseUnits(amountText, decimals);
  if (amount <= 0n) throw new Error('Enter an amount greater than 0.');
  const [collateralEnabled, controllerEnabled] = await Promise.all([
    isCollateralEnabled({ evc, owner, collateralVault, chainId }),
    isControllerEnabled({ evc, owner, controllerVault: debtVault, chainId }),
  ]);
  onTransactionStep?.({ index: 1, total: 1, label: 'Multiply position' });
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const quote = await fetchEulerSwapQuote(buildEulerSwapQuoteUrl({
    chainId,
    tokenIn: debtToken,
    tokenOut: collateralToken,
    amount,
    receiver: collateralVault,
    vaultIn: debtVault,
    account: owner,
    deadline,
  }));
  const data = buildMultiplyBatchCalldata({
    owner,
    evc,
    debtVault,
    collateralVault,
    borrowAmount: amount,
    swapperAddress: quote.swap.swapperAddress,
    swapperData: quote.swap.swapperData,
    verifierAddress: quote.verify.verifierAddress,
    verifierData: quote.verify.verifierData,
    collateralEnabled,
    controllerEnabled,
  });
  return sendTransaction(
    evc,
    data,
    owner,
    { onPreflight, label: 'Multiply position' },
  );
}

export async function repayToMarket({ debtVault, collateralVault = '', positionAccount = '', amountText, onPreflight, chainId = 'arbitrum' }) {
  assertConfiguredAddress(debtVault, 'Debt vault');
  const owner = await ensureWallet(chainId);
  if (positionAccount) assertConfiguredAddress(positionAccount, 'Position account');
  const token = await readVaultAsset(debtVault, null, chainId);
  const decimals = await readDecimals(token, null, chainId);
  const amount = parseUnits(amountText, decimals);
  if (amount <= 0n) throw new Error('Enter an amount greater than 0.');
  const selected = positionAccount
    ? { account: positionAccount }
    : collateralVault
    ? await selectMarketAccount({ collateralVault, debtVault, owner, chainId })
    : { account: owner };
  const account = selected.account;
  await approveIfNeeded({ token, owner, spender: debtVault, amount, chainId });
  return sendTransaction(
    debtVault,
    encodeCall(SELECTORS.repay, [encodeUint(amount), encodeAddress(account)]),
    owner,
    { onPreflight, label: 'Repay debt' },
  );
}

export function encodeLiquidateCalldata({ borrower, marketNumber }) {
  const borrowerAddress = String(borrower || '').trim();
  if (!isAddress(borrowerAddress)) throw new Error('Enter a valid borrower address.');
  return encodeCall(SELECTORS.liquidate, [
    encodeAddress(borrowerAddress),
    encodeUint8(marketNumber),
  ]);
}

export async function executeLiquidation({ liquidator, borrower, marketNumber, chainId = 'arbitrum', onPreflight }) {
  if (!isAddress(liquidator)) throw new Error('Liquidator contract is not configured.');
  const owner = await ensureWallet(chainId);
  return sendTransaction(
    liquidator,
    encodeLiquidateCalldata({ borrower, marketNumber }),
    owner,
    { onPreflight, label: 'Liquidate account' },
  );
}

async function readVaultNumbers(vault, rpcUrl, chainId = 'arbitrum') {
  assertConfiguredAddress(vault, 'Vault');
  const asset = await readVaultAsset(vault, rpcUrl, chainId);
  const decimals = await readDecimals(asset, rpcUrl, chainId);
  let shareDecimals = decimals;
  try {
    shareDecimals = await readDecimals(vault, rpcUrl, chainId);
  } catch {
    shareDecimals = decimals;
  }
  let [totalAssets, totalSupply, totalBorrows, cash, interestRate] = await safeEthBatch([
    { to: vault, data: SELECTORS.totalAssets },
    { to: vault, data: SELECTORS.totalSupply },
    { to: vault, data: SELECTORS.totalBorrows },
    { to: vault, data: SELECTORS.cash },
    { to: vault, data: SELECTORS.interestRate },
  ], rpcUrl, 2, chainId);
  if (!totalAssets) totalAssets = await safeEthCall(vault, SELECTORS.totalAssets, rpcUrl, 2, chainId);
  if (!totalSupply) totalSupply = await safeEthCall(vault, SELECTORS.totalSupply, rpcUrl, 2, chainId);
  if (!totalBorrows) totalBorrows = await safeEthCall(vault, SELECTORS.totalBorrows, rpcUrl, 2, chainId);
  if (!cash) cash = await safeEthCall(vault, SELECTORS.cash, rpcUrl, 2, chainId);
  if (!interestRate) interestRate = await safeEthCall(vault, SELECTORS.interestRate, rpcUrl, 2, chainId);
  return {
    asset,
    decimals,
    shareDecimals,
    totalAssets: totalAssets ? decodeUint(totalAssets) : null,
    totalSupply: totalSupply ? decodeUint(totalSupply) : null,
    totalBorrows: totalBorrows ? decodeUint(totalBorrows) : null,
    cash: cash ? decodeUint(cash) : null,
    interestRate: interestRate ? decodeUint(interestRate) : 0n,
  };
}

async function readEarnAllocations(page, earnVault, assetDecimals, priceRaw, rpcUrl) {
  const rows = (page.exposures || []).filter((row) => row.debtVaultAddress || row.vaultAddress);
  if (rows.length === 0) return [];
  const vaultAddresses = rows.map((row) => row.debtVaultAddress || row.vaultAddress);
  const shareCalls = vaultAddresses.map((vaultAddress) => ({
    to: vaultAddress,
    data: encodeBalanceOfCalldata(earnVault),
  }));
  const configCalls = vaultAddresses.map((vaultAddress) => ({
    to: earnVault,
    data: encodeCall(SELECTORS.earnConfig, [encodeAddress(vaultAddress)]),
  }));
  const [shareResults, configResults] = await Promise.all([
    safeEthBatch(shareCalls, rpcUrl, 2, page.chainId),
    safeEthBatch(configCalls, rpcUrl, 2, page.chainId),
  ]);
  const assetCalls = vaultAddresses.map((vaultAddress, index) => {
    const shares = decodeUint(shareResults[index]);
    return shares > 0n
      ? { index, call: { to: vaultAddress, data: encodeCall(SELECTORS.convertToAssets, [encodeUint(shares)]) } }
      : null;
  }).filter(Boolean);
  const assetResults = assetCalls.length ? await safeEthBatch(assetCalls.map((entry) => entry.call), rpcUrl, 2, page.chainId) : [];
  const allocationAssetsByIndex = new Map();
  await Promise.all(assetCalls.map(async (entry, resultIndex) => {
    let raw = assetResults[resultIndex];
    if (!raw) raw = await safeEthCall(entry.call.to, entry.call.data, rpcUrl, 2, page.chainId);
    allocationAssetsByIndex.set(entry.index, raw ? decodeUint(raw) : 0n);
  }));
  const price = priceRaw ? decodeUint(priceRaw) : 0n;
  return rows.map((row, index) => {
    const shares = decodeUint(shareResults[index]);
    const allocationAssets = shares > 0n ? (allocationAssetsByIndex.get(index) || 0n) : 0n;
    const configRaw = configResults[index];
    const cap = configRaw ? decodeUintWord(configRaw, 1) : 0n;
    const enabled = configRaw ? decodeUintWord(configRaw, 2) !== 0n : false;
    const allocationValue = price > 0n
      ? (allocationAssets * price) / (10n ** BigInt(assetDecimals))
      : 0n;
    return {
      pageId: row.pageId || '',
      label: row.label || '',
      debtVaultAddress: vaultAddresses[index],
      allocationAssetsRaw: allocationAssets.toString(),
      allocation: formatUnits(allocationAssets, assetDecimals, 2),
      allocationValue: allocationValue > 0n ? formatUsdValue(allocationValue) : '$0.00',
      capRaw: cap.toString(),
      cap: cap > 0n ? formatUnits(cap, assetDecimals, 2) : '0.00',
      enabled,
    };
  });
}

async function quotePrice(page, collateralAsset, debtAsset, collateralDecimals, debtDecimals, rpcUrl, chainId = 'arbitrum') {
  const marketVault = page.debtVaultAddress || page.contractAddress;
  if (marketVault && collateralAsset && debtAsset) {
    const [oracleRaw, unitRaw] = await Promise.all([
      safeEthCall(marketVault, SELECTORS.oracle, rpcUrl, 2, chainId),
      safeEthCall(marketVault, SELECTORS.unitOfAccount, rpcUrl, 2, chainId),
    ]);
    const oracle = oracleRaw ? decodeAddress(oracleRaw) : page.routerAddress;
    const unit = unitRaw ? decodeAddress(unitRaw) : null;
    if (isAddress(oracle) && isAddress(unit)) {
      const inAmount = 10n ** BigInt(collateralDecimals);
      const oneDebt = 10n ** BigInt(debtDecimals);
      const [collateralQuoteRaw, debtQuoteRaw] = await Promise.all([
        safeEthCall(oracle, encodeCall(SELECTORS.getQuote, [
          encodeUint(inAmount),
          encodeAddress(collateralAsset),
          encodeAddress(unit),
        ]), rpcUrl, 2, chainId),
        safeEthCall(oracle, encodeCall(SELECTORS.getQuote, [
          encodeUint(oneDebt),
          encodeAddress(debtAsset),
          encodeAddress(unit),
        ]), rpcUrl, 2, chainId),
      ]);
      if (collateralQuoteRaw && debtQuoteRaw) {
        const collateralQuote = decodeUint(collateralQuoteRaw);
        const debtQuote = decodeUint(debtQuoteRaw);
        if (debtQuote > 0n) return formatUnits((collateralQuote * oneDebt) / debtQuote, debtDecimals, 4);
      }
    }
  }

  if (!page.routerAddress || !collateralAsset || !debtAsset) return null;
  const inAmount = 10n ** BigInt(collateralDecimals);
  const data = encodeCall(SELECTORS.getQuote, [
    encodeUint(inAmount),
    encodeAddress(collateralAsset),
    encodeAddress(debtAsset),
  ]);
  const result = await safeEthCall(page.routerAddress, data, rpcUrl, 2, chainId);
  if (!result) return null;
  return formatUnits(decodeUint(result), debtDecimals, 4);
}

export async function fetchLivePageMetrics(page, rpcUrl = null) {
  if (!['arbitrum', 'ethereum', 'base'].includes(page.chainId)) return null;
  rpcUrlsForChain(page.chainId);

  if (page.type === 'ipor-vault') {
    if (!page.contractAddress) return null;
    const vault = await readVaultNumbers(page.contractAddress, rpcUrl, page.chainId);
    return {
      assetAddress: vault.asset,
      totalSupply: vault.totalSupply === null ? page.totalSupply || '0.00' : formatUnits(vault.totalSupply, vault.shareDecimals, 2),
      totalAssets: vault.totalAssets === null ? page.totalAssets || '0.00' : formatUnits(vault.totalAssets, vault.decimals, 2),
      availableLiquidity: vault.totalAssets === null ? page.totalValueLocked || '0.00' : formatUnits(vault.totalAssets, vault.decimals, 2),
      supplyApy: page.strategyApr || '9.33%',
      performanceApy: page.strategyApr || '9.33%',
    };
  }

  if (page.type === 'earn') {
    if (!page.contractAddress) return null;
    const vault = await readVaultNumbers(page.contractAddress, rpcUrl, page.chainId);
    const priceAsset = page.priceAssetAddress || vault.asset;
    const priceDecimals = priceAsset.toLowerCase() === vault.asset.toLowerCase()
      ? vault.decimals
      : await readDecimals(priceAsset, rpcUrl, page.chainId);
    const [priceRaw, feeRaw, feeReceiverRaw] = await Promise.all([
      page.oracleAddress ? safeEthCall(page.oracleAddress, encodeCall(SELECTORS.getQuote, [
        encodeUint(10n ** BigInt(priceDecimals)),
        encodeAddress(priceAsset),
        encodeAddress(USD_UNIT_OF_ACCOUNT),
      ]), rpcUrl, 2, page.chainId) : null,
      safeEthCall(page.contractAddress, SELECTORS.fee, rpcUrl, 2, page.chainId),
      safeEthCall(page.contractAddress, SELECTORS.feeRecipient, rpcUrl, 2, page.chainId),
    ]);
    const earnAllocations = await readEarnAllocations(page, page.contractAddress, vault.decimals, priceRaw, rpcUrl);
    return {
      assetAddress: vault.asset,
      price: priceRaw ? `$${formatUnits(decodeUint(priceRaw), 18, 4)}` : 'Loading...',
      performanceFee: feeRaw ? formatWadPercent(decodeUint(feeRaw)) : (page.performanceFee || '0.00%'),
      totalSupply: vault.totalSupply === null ? 'Loading...' : formatUnits(vault.totalSupply, vault.shareDecimals, 2),
      totalAssets: vault.totalAssets === null ? 'Loading...' : formatUnits(vault.totalAssets, vault.decimals, 2),
      availableLiquidity: vault.totalAssets === null ? 'Loading...' : formatUnits(vault.totalAssets, vault.decimals, 2),
      totalAssetsRaw: vault.totalAssets === null ? '0' : vault.totalAssets.toString(),
      assetDecimals: vault.decimals,
      earnAllocations,
      supplyApy: 'N/A',
      feeReceiver: feeReceiverRaw ? decodeAddress(feeReceiverRaw) : null,
    };
  }

  const [collateralVault, debtVault] = await Promise.all([
    readVaultNumbers(page.collateralVaultAddress, rpcUrl, page.chainId),
    readVaultNumbers(page.debtVaultAddress || page.contractAddress, rpcUrl, page.chainId),
  ]);
  const debtVaultAddress = page.debtVaultAddress || page.contractAddress;
  let [borrowLtv, liquidationLtv, ltvFullRaw, capsRaw, collateralCapsRaw, convertRaw, collateralConvertRaw, feeReceiverRaw, interestFeeRaw, irmRaw, oracleRaw, unitRaw, hookRaw] = await safeEthBatch([
    { to: debtVaultAddress, data: encodeCall(SELECTORS.ltvBorrow, [encodeAddress(page.collateralVaultAddress)]) },
    { to: debtVaultAddress, data: encodeCall(SELECTORS.ltvLiquidation, [encodeAddress(page.collateralVaultAddress)]) },
    { to: debtVaultAddress, data: encodeCall(SELECTORS.ltvFull, [encodeAddress(page.collateralVaultAddress)]) },
    { to: debtVaultAddress, data: SELECTORS.caps },
    { to: page.collateralVaultAddress, data: SELECTORS.caps },
    { to: debtVaultAddress, data: encodeCall(SELECTORS.convertToAssets, [encodeUint(10n ** BigInt(debtVault.shareDecimals))]) },
    { to: page.collateralVaultAddress, data: encodeCall(SELECTORS.convertToAssets, [encodeUint(10n ** BigInt(collateralVault.shareDecimals))]) },
    { to: debtVaultAddress, data: SELECTORS.feeReceiver },
    { to: debtVaultAddress, data: SELECTORS.interestFee },
    { to: debtVaultAddress, data: SELECTORS.interestRateModel },
    { to: debtVaultAddress, data: SELECTORS.oracle },
    { to: debtVaultAddress, data: SELECTORS.unitOfAccount },
    { to: debtVaultAddress, data: SELECTORS.hookConfig },
  ], rpcUrl, 2, page.chainId);
  if (!borrowLtv) borrowLtv = await safeEthCall(debtVaultAddress, encodeCall(SELECTORS.ltvBorrow, [encodeAddress(page.collateralVaultAddress)]), rpcUrl, 2, page.chainId);
  if (!liquidationLtv) liquidationLtv = await safeEthCall(debtVaultAddress, encodeCall(SELECTORS.ltvLiquidation, [encodeAddress(page.collateralVaultAddress)]), rpcUrl, 2, page.chainId);
  if (!ltvFullRaw) ltvFullRaw = await safeEthCall(debtVaultAddress, encodeCall(SELECTORS.ltvFull, [encodeAddress(page.collateralVaultAddress)]), rpcUrl, 2, page.chainId);
  const borrowLtvValue = borrowLtv ? decodeUint(borrowLtv) : (ltvFullRaw ? decodeUintWord(ltvFullRaw, 0) : null);
  const liquidationLtvValue = liquidationLtv ? decodeUint(liquidationLtv) : (ltvFullRaw ? decodeUintWord(ltvFullRaw, 1) : null);
  if (!capsRaw) capsRaw = await safeEthCall(debtVaultAddress, SELECTORS.caps, rpcUrl, 2, page.chainId);
  if (!collateralCapsRaw) collateralCapsRaw = await safeEthCall(page.collateralVaultAddress, SELECTORS.caps, rpcUrl, 2, page.chainId);
  if (!convertRaw) convertRaw = await safeEthCall(debtVaultAddress, encodeCall(SELECTORS.convertToAssets, [encodeUint(10n ** BigInt(debtVault.shareDecimals))]), rpcUrl, 2, page.chainId);
  if (!collateralConvertRaw) collateralConvertRaw = await safeEthCall(page.collateralVaultAddress, encodeCall(SELECTORS.convertToAssets, [encodeUint(10n ** BigInt(collateralVault.shareDecimals))]), rpcUrl, 2, page.chainId);
  if (!feeReceiverRaw) feeReceiverRaw = await safeEthCall(debtVaultAddress, SELECTORS.feeReceiver, rpcUrl, 2, page.chainId);
  if (!interestFeeRaw) interestFeeRaw = await safeEthCall(debtVaultAddress, SELECTORS.interestFee, rpcUrl, 2, page.chainId);
  if (!irmRaw) irmRaw = await safeEthCall(debtVaultAddress, SELECTORS.interestRateModel, rpcUrl, 2, page.chainId);
  if (!oracleRaw) oracleRaw = await safeEthCall(debtVaultAddress, SELECTORS.oracle, rpcUrl, 2, page.chainId);
  if (!unitRaw) unitRaw = await safeEthCall(debtVaultAddress, SELECTORS.unitOfAccount, rpcUrl, 2, page.chainId);
  const price = await quotePrice(page, collateralVault.asset, debtVault.asset, collateralVault.decimals, debtVault.decimals, rpcUrl, page.chainId);
  const debtPriceRaw = oracleRaw && unitRaw ? await safeEthCall(decodeAddress(oracleRaw), encodeCall(SELECTORS.getQuote, [
    encodeUint(10n ** BigInt(debtVault.decimals)),
    encodeAddress(debtVault.asset),
    encodeAddress(decodeAddress(unitRaw)),
  ]), rpcUrl, 2, page.chainId) : null;

  const supplyApy = '0.00%';
  const borrowApy = aprFromInterestRate(debtVault.interestRate);
  const utilization = formatUtilization(debtVault.totalBorrows, debtVault.totalAssets);
  const interestFee = interestFeeRaw ? decodeUint(interestFeeRaw) : 0n;
  const debtSupplyApy = supplyApyFromBorrow({ borrowApy, utilization, interestFee });
  const supplyCapRaw = capsRaw ? decodeUintWord(capsRaw, 0) : null;
  const borrowCapRaw = capsRaw ? decodeUintWord(capsRaw, 1) : null;
  const collateralSupplyCapRaw = collateralCapsRaw ? decodeUintWord(collateralCapsRaw, 0) : null;
  const ltvConfigured = borrowLtvValue !== null && liquidationLtvValue !== null && (borrowLtvValue > 0n || liquidationLtvValue > 0n);
  const irmAddress = irmRaw ? decodeAddress(irmRaw) : page.irmAddress;
  const [irmBaseRaw, irmKinkRaw, irmSlope1Raw, irmSlope2Raw] = irmAddress ? await safeEthBatch([
    { to: irmAddress, data: SELECTORS.irmBaseRate },
    { to: irmAddress, data: SELECTORS.irmKink },
    { to: irmAddress, data: SELECTORS.irmSlope1 },
    { to: irmAddress, data: SELECTORS.irmSlope2 },
  ], rpcUrl, 2, page.chainId) : [];
  const irmMetrics = formatIrmMetrics({
    baseRate: irmBaseRaw ? decodeUint(irmBaseRaw) : 0n,
    kink: irmKinkRaw ? decodeUint(irmKinkRaw) : 0n,
    slope1: irmSlope1Raw ? decodeUint(irmSlope1Raw) : 0n,
    slope2: irmSlope2Raw ? decodeUint(irmSlope2Raw) : 0n,
  });

  return {
    collateralAssetAddress: collateralVault.asset,
    debtAssetAddress: debtVault.asset,
    price: price || 'Loading...',
    collateralPrice: debtPriceRaw && price ? `$${formatUnits((parseUnits(price, debtVault.decimals) * decodeUint(debtPriceRaw)) / (10n ** BigInt(debtVault.decimals)), 18, 4)}` : 'Loading...',
    debtPrice: debtPriceRaw ? `$${formatUnits(decodeUint(debtPriceRaw), 18, 4)}` : '$1.00',
    totalSupply: collateralVault.totalSupply === null ? 'Loading...' : formatUnits(collateralVault.totalSupply, collateralVault.shareDecimals, 2),
    collateralTotalSupply: collateralVault.totalSupply === null ? 'Loading...' : formatUnits(collateralVault.totalSupply, collateralVault.shareDecimals, 2),
    debtTotalSupply: debtVault.totalSupply === null ? 'Loading...' : formatUnits(debtVault.totalSupply, debtVault.shareDecimals, 2),
    totalBorrows: debtVault.totalBorrows === null ? 'Loading...' : formatUnits(debtVault.totalBorrows, debtVault.decimals, 2),
    availableLiquidity: debtVault.cash === null ? 'Loading...' : formatUnits(debtVault.cash, debtVault.decimals, 2),
    supplyApy,
    debtSupplyApy,
    borrowApy,
    netApy: netApyFromRates(supplyApy, borrowApy),
    utilization,
    supplyCap: ltvConfigured ? formatOptionalResolvedCap(supplyCapRaw, debtVault.decimals) : 'Not configured',
    collateralSupplyCap: ltvConfigured ? formatOptionalResolvedCap(collateralSupplyCapRaw, collateralVault.decimals) : 'Not configured',
    borrowCap: ltvConfigured ? formatOptionalResolvedCap(borrowCapRaw, debtVault.decimals) : 'Not configured',
    shareTokenExchangeRate: formatShareExchangeRate({ convertRaw, totalAssets: debtVault.totalAssets, totalSupply: debtVault.totalSupply, decimals: debtVault.decimals, shareDecimals: debtVault.shareDecimals }),
    collateralShareTokenExchangeRate: formatShareExchangeRate({ convertRaw: collateralConvertRaw, totalAssets: collateralVault.totalAssets, totalSupply: collateralVault.totalSupply, decimals: collateralVault.decimals, shareDecimals: collateralVault.shareDecimals }),
    interestFee: formatPercentFromBps(interestFee),
    feeReceiver: feeReceiverRaw ? decodeAddress(feeReceiverRaw) : null,
    oracleRouter: oracleRaw ? decodeAddress(oracleRaw) : page.routerAddress,
    unitOfAccount: unitRaw ? decodeAddress(unitRaw) : null,
    interestRateModel: irmAddress,
    ...irmMetrics,
    hookTarget: hookRaw ? decodeAddress(hookRaw) : null,
    maxRoe: '0.00%',
    maxLtv: ltvConfigured ? formatPercentFromBps(borrowLtvValue) : 'Not configured',
    maxMultiplier: formatMaxMultiplierFromBps(borrowLtvValue || 0n),
    liquidationLtv: ltvConfigured ? formatPercentFromBps(liquidationLtvValue) : 'Not configured',
  };
}
