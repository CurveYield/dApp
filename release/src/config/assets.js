export const CHAINS = [
  {
    id: 'ethereum',
    label: 'Ethereum Mainnet',
    shortLabel: 'Ethereum',
    logo: './assets/logos/ethereum.svg?v=2026-05-08-eth-logo-balanced',
    defaultPageId: 'earn-scrvusd',
  },
  {
    id: 'arbitrum',
    label: 'Arbitrum',
    shortLabel: 'Arbitrum',
    logo: './assets/logos/arbitrum.svg',
    defaultPageId: 'arb-market-asdcrv-crvusd',
  },
  {
    id: 'base',
    label: 'Base',
    shortLabel: 'Base',
    logo: './assets/logos/base.svg?v=2026-05-08-base-visible',
    defaultPageId: 'ipor-crvusd-lp-vault',
  },
];

export const TOKEN_LOGOS = {
  asdCRV: './assets/logos/asdcrv.png',
  aCRV: './assets/logos/acrv.png',
  crvUSD: './assets/logos/crvusd.jpg',
  scrvUSD: './assets/logos/scrvusd.png',
  cyCRV: './assets/logos/cycrv.png',
  'cy-crvUSD': './assets/logos/curveyield-512.png',
  'st-yCRV': './assets/logos/stycrv.png',
  'yvCurve-yYB': './assets/logos/yyblp.png',
  CurveYield: './assets/logos/curveyield.png',
  CurveYield512: './assets/logos/curveyield-512.png',
  Base: './assets/logos/base.svg?v=2026-05-08-base-visible',
};

export const TOKEN_ACTIONS = {
  asdCRV: {
    vaultUrl: 'https://concentrator.aladdin.club/vaults/',
    underlyingByChain: {
      ethereum: '0x62b9c7356a2dc64a1969e19c23e4f579f9810aa7',
      arbitrum: '0x11cdb42b0eb46d95f990bedd4695a6e3fa034978',
    },
  },
  aCRV: {
    vaultUrl: 'https://concentrator.aladdin.club/vaults/',
    underlyingByChain: {
      ethereum: '0x62b9c7356a2dc64a1969e19c23e4f579f9810aa7',
    },
  },
  'st-yCRV': {
    vaultUrl: 'https://ycrv.yearn.fi/app/deposit',
    underlyingByChain: {
      ethereum: '0x62b9c7356a2dc64a1969e19c23e4f579f9810aa7',
    },
  },
  'yvCurve-yYB': {
    vaultUrl: 'https://yearn.fi/vaults/1/0x0844C227b892be5d7c837000C096f64bFc316c2d',
    underlyingByChain: {
      ethereum: '0x0844C227b892be5d7c837000C096f64bFc316c2d',
    },
  },
  YBcrvUSD: {
    vaultUrl: 'https://app.beefy.finance/vault/curve-crvusd-yb',
    underlyingByChain: {
      ethereum: '0xf939e0a03fb07f59a73314e73794be0e57ac1b4e',
    },
  },
  scrvUSD: {
    vaultUrl: '#/earn-scrvusd',
    underlyingByChain: {
      ethereum: '0xf939e0a03fb07f59a73314e73794be0e57ac1b4e',
    },
  },
  'cy-crvUSD': {
    vaultUrl: '#/ipor-crvusd-lp-vault',
    underlyingByChain: {
      ethereum: '0xE31Aa86e21e420d03E52AaA06C349BDC525a664F',
    },
  },
  crvUSD: {
    vaultUrl: null,
    underlyingByChain: {
      ethereum: '0xf939e0a03fb07f59a73314e73794be0e57ac1b4e',
      arbitrum: '0x498bf2b1e120fed3ad3d42ea2165e9b73f99c1e5',
    },
  },
};

export function getChainById(id) {
  return CHAINS.find((chain) => chain.id === id) || CHAINS[0];
}
