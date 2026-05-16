export const SIMULATION_STORAGE_KEY = 'curveyield.euler.simulation.v1';

const emptyState = () => ({
  acceptedTerms: {},
  positions: {},
});

export function readSimulationState(raw) {
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    return {
      acceptedTerms: parsed.acceptedTerms && typeof parsed.acceptedTerms === 'object' ? parsed.acceptedTerms : {},
      positions: parsed.positions && typeof parsed.positions === 'object' ? parsed.positions : {},
    };
  } catch {
    return emptyState();
  }
}

export function acceptTerms(state, pageId) {
  return {
    ...state,
    acceptedTerms: {
      ...state.acceptedTerms,
      [pageId]: true,
    },
  };
}

export function hasAcceptedTerms(state, pageId) {
  return Boolean(state.acceptedTerms?.[pageId]);
}

export function formatAmount(value) {
  const number = Number(value) || 0;
  if (number === 0) return '0.00';
  return number.toLocaleString('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
}

export function parseAmount(value) {
  const number = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function calculateLtv(supplied, borrowed, collateralPrice = 1) {
  const collateralValue = supplied * (parseAmount(collateralPrice) || 1);
  if (collateralValue <= 0 || borrowed <= 0) return 0;
  return Math.min(999, (borrowed / collateralValue) * 100);
}

export function applyMarketSimulation(state, input) {
  const current = state.positions[input.pageId] || {};
  const supplied = (Number(current.supplied) || 0) + parseAmount(input.collateralAmount);
  const borrowed = (Number(current.borrowed) || 0) + parseAmount(input.borrowAmount);
  const ltv = calculateLtv(supplied, borrowed, input.collateralPrice);

  return {
    ...state,
    acceptedTerms: {
      ...state.acceptedTerms,
      [input.pageId]: true,
    },
    positions: {
      ...state.positions,
      [input.pageId]: {
        type: 'market',
        collateralSymbol: input.collateralSymbol,
        debtSymbol: input.debtSymbol,
        supplied,
        borrowed,
        ltv,
      },
    },
  };
}

export function applyEarnSimulation(state, input) {
  const current = state.positions[input.pageId] || {};
  const supplied = (Number(current.supplied) || 0) + parseAmount(input.amount);

  return {
    ...state,
    acceptedTerms: {
      ...state.acceptedTerms,
      [input.pageId]: true,
    },
    positions: {
      ...state.positions,
      [input.pageId]: {
        type: 'earn',
        asset: input.asset,
        supplied,
      },
    },
  };
}
