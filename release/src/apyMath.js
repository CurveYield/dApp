export function parseApyPercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace('%', '').trim());
  return Number.isFinite(number) ? number : null;
}

export function formatApyPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0.00%';
  return `${(Math.round((number + 1e-9) * 100) / 100).toFixed(2)}%`;
}

export function combinedSupplyApy(marketSupplyApy, intrinsicAssetApy) {
  const market = parseApyPercent(marketSupplyApy);
  const intrinsic = parseApyPercent(intrinsicAssetApy);

  if (market === null && intrinsic === null) return marketSupplyApy || intrinsicAssetApy || '0.00%';
  return formatApyPercent((market || 0) + (intrinsic || 0));
}

export function netApyFromSupplyAndBorrow(totalSupplyApy, borrowApy) {
  const supply = parseApyPercent(totalSupplyApy);
  const borrow = parseApyPercent(borrowApy);
  return formatApyPercent((supply || 0) - (borrow || 0));
}

export function maxRoeFromSupplyBorrowAndMultiplier(totalSupplyApy, borrowApy, maxMultiplier) {
  const supply = parseApyPercent(totalSupplyApy);
  const borrow = parseApyPercent(borrowApy);
  const multiplier = Number(String(maxMultiplier || '').replace('x', '').trim());
  if (supply === null || borrow === null || !Number.isFinite(multiplier)) return 'Loading...';
  return formatApyPercent(supply + ((supply - borrow) * Math.max(0, multiplier - 1)));
}
