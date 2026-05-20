import { parseApyPercent } from './apyMath.js?v=2026-05-07-prod-hardening';

export function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
}

export function ltvMarkerPercent(value, liquidationLtv) {
  const marker = parseApyPercent(value) ?? 0;
  const max = parseApyPercent(liquidationLtv) ?? 100;
  if (!max) return 0;
  return clampPercent((marker / max) * 100);
}

export function irmBorrowApyAtUtilization({ utilization, baseRate, rateAtKink, maxRate, kink }) {
  const util = clampPercent(utilization);
  const kinkPercent = clampPercent(parseApyPercent(kink) ?? 0);
  const base = parseApyPercent(baseRate) ?? 0;
  const kinkRate = parseApyPercent(rateAtKink) ?? base;
  const max = parseApyPercent(maxRate) ?? kinkRate;

  if (kinkPercent <= 0) return max;
  if (util <= kinkPercent) {
    return base + ((kinkRate - base) * util) / kinkPercent;
  }
  return kinkRate + ((max - kinkRate) * (util - kinkPercent)) / Math.max(1, 100 - kinkPercent);
}

export function kinkIrmChartPoints({
  baseRate,
  rateAtKink,
  maxRate,
  kink,
  width = 420,
  height = 220,
  padding = 24,
} = {}) {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const samples = Array.from({ length: 101 }, (_, utilization) => ({
    utilization,
    apy: irmBorrowApyAtUtilization({ utilization, baseRate, rateAtKink, maxRate, kink }),
  }));
  const apys = samples.map((point) => point.apy).filter(Number.isFinite);
  const dataMin = Math.min(...apys);
  const dataMax = Math.max(...apys);
  const spread = dataMax - dataMin;
  const domainPadding = spread > 0 ? spread * 0.12 : Math.max(1, dataMax * 0.25);
  const domainMin = spread > 0 ? Math.max(0, Math.min(dataMin, 0) - domainPadding) : Math.max(0, dataMin - domainPadding);
  const domainMax = Math.max(1, dataMax + domainPadding);
  const domain = Math.max(1, domainMax - domainMin);

  return samples.map(({ utilization, apy }) => {
    return {
      utilization,
      apy,
      x: padding + (utilization / 100) * usableWidth,
      y: padding + usableHeight - ((apy - domainMin) / domain) * usableHeight,
    };
  });
}
