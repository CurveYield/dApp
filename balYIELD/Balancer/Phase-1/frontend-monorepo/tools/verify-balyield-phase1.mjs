import registry from '../apps/frontend-v3/public/data/balyield-pools.json' with { type: 'json' }

const pool = registry.pools[0]
const tokenA = registry.tokens[pool.tokens[0]]
const tokenB = registry.tokens[pool.tokens[1]]

const selectors = {
  getStaticSwapFeePercentage: '0xb45090f9',
  isPoolInitialized: '0x532cec7c',
  querySwapSingleTokenExactIn: '0x3ebc54e5',
}

async function ethCall(to, data) {
  const response = await fetch(registry.chains.base.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ data, to }, 'latest'],
    }),
  })
  const json = await response.json()
  if (json.error) throw new Error(json.error.message)
  return json.result
}

function encAddress(address) {
  return address.toLowerCase().replace('0x', '').padStart(64, '0')
}

function encUint(value) {
  return BigInt(value).toString(16).padStart(64, '0')
}

function decodeUint(hex) {
  return BigInt(hex || '0x0')
}

function formatUnits(value, decimals, precision = 8) {
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  const fraction = (value % base).toString().padStart(decimals, '0').slice(0, precision)
  return `${whole}.${fraction}`.replace(/\.?0+$/, '')
}

async function quoteExactIn(tokenIn, tokenOut) {
  const amountIn = 10n ** BigInt(tokenIn.decimals)
  const quote = decodeUint(
    await ethCall(
      pool.router,
      selectors.querySwapSingleTokenExactIn +
        encAddress(pool.address) +
        encAddress(tokenIn.address) +
        encAddress(tokenOut.address) +
        encUint(amountIn) +
        encAddress('0x5d93c48460B61107C173861c3D902B4117A1d7b6') +
        encUint(6n * 32n) +
        encUint(0n)
    )
  )
  return {
    amountIn: `1 ${tokenIn.symbol}`,
    amountOut: `${formatUnits(quote, tokenOut.decimals)} ${tokenOut.symbol}`,
  }
}

const initialized = decodeUint(
  await ethCall(pool.vault, selectors.isPoolInitialized + encAddress(pool.address))
) === 1n
const swapFee = decodeUint(
  await ethCall(pool.vault, selectors.getStaticSwapFeePercentage + encAddress(pool.address))
)

console.log(
  JSON.stringify(
    {
      initialized,
      pool: pool.address,
      quotes: [await quoteExactIn(tokenA, tokenB), await quoteExactIn(tokenB, tokenA)],
      registryPools: registry.pools.length,
      swapFee: `${(Number(swapFee) / 1e16).toFixed(2)}%`,
    },
    null,
    2
  )
)
