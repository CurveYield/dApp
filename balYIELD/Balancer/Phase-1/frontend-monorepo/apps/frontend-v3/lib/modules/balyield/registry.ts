import registry from '../../../public/data/balyield-pools.json'

export type BalYieldRegistry = typeof registry
export type BalYieldPool = BalYieldRegistry['pools'][number]
export type BalYieldToken = BalYieldRegistry['tokens'][keyof BalYieldRegistry['tokens']]

export const balYieldRegistry = registry

export function getPhase1Pool() {
  return balYieldRegistry.pools[0]
}

export function getToken(tokenId: string) {
  const token = balYieldRegistry.tokens[tokenId as keyof typeof balYieldRegistry.tokens]
  if (!token) throw new Error(`Unknown balYIELD token: ${tokenId}`)
  return token
}

export function getPoolTokens(pool: BalYieldPool) {
  return pool.tokens.map(getToken)
}
