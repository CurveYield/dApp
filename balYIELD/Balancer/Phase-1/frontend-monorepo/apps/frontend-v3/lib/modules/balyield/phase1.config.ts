import { getPhase1Pool, getPoolTokens } from './registry'
import type { Address } from 'viem'

const pool = getPhase1Pool()
const tokens = getPoolTokens(pool)

export const phase1Pool = {
  ...pool,
  address: pool.address as Address,
  chainLabel: 'Base',
  factoryWrapper: pool.factoryWrapper as Address,
  pool: pool.address as Address,
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
  rateProvider: pool.rateProvider as Address,
  router: pool.router as Address,
  vault: pool.vault as Address,
  wrapper: pool.wrapper as Address,
} as const

export const phase1Tokens = {
  CRV: { ...tokens[0], address: tokens[0].address as Address },
  cyCRV: { ...tokens[1], address: tokens[1].address as Address },
  wscyCRV: { ...tokens[2], address: tokens[2].address as Address },
} as const

export const baseRpcUrl = 'https://base.drpc.org'
