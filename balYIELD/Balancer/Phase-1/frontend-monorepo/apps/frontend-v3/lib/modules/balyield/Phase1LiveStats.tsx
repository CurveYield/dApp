'use client'

import { SimpleGrid } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { createPublicClient, formatUnits, http } from 'viem'
import { base } from 'viem/chains'
import { baseRpcUrl, phase1Pool } from './phase1.config'
import { BalYieldStat } from './components/BalYieldStat'

const rateProviderAbi = [
  {
    inputs: [],
    name: 'getRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const wrapperAbi = [
  {
    inputs: [],
    name: 'getAssetPricePerFullShare',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const poolAbi = [
  {
    inputs: [],
    name: 'getAmplificationParameter',
    outputs: [
      { internalType: 'uint256', name: 'value', type: 'uint256' },
      { internalType: 'bool', name: 'isUpdating', type: 'bool' },
      { internalType: 'uint256', name: 'precision', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const vaultAbi = [
  {
    inputs: [{ internalType: 'address', name: 'pool', type: 'address' }],
    name: 'getStaticSwapFeePercentage',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'pool', type: 'address' }],
    name: 'isPoolInitialized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const client = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
})

type LiveStats = {
  amp?: string
  initialized?: string
  pps?: string
  rate?: string
  swapFee?: string
}

export function Phase1LiveStats() {
  const [stats, setStats] = useState<LiveStats>({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [rate, pps, amp, swapFee, initialized] = await Promise.all([
        client.readContract({
          abi: rateProviderAbi,
          address: phase1Pool.rateProvider,
          functionName: 'getRate',
        }),
        client.readContract({
          abi: wrapperAbi,
          address: phase1Pool.wrapper,
          functionName: 'getAssetPricePerFullShare',
        }),
        client.readContract({
          abi: poolAbi,
          address: phase1Pool.pool,
          functionName: 'getAmplificationParameter',
        }),
        client.readContract({
          abi: vaultAbi,
          address: phase1Pool.vault,
          args: [phase1Pool.pool],
          functionName: 'getStaticSwapFeePercentage',
        }),
        client.readContract({
          abi: vaultAbi,
          address: phase1Pool.vault,
          args: [phase1Pool.pool],
          functionName: 'isPoolInitialized',
        }),
      ])

      if (!cancelled) {
        setStats({
          amp: (amp[0] / amp[2]).toString(),
          initialized: initialized ? 'Yes' : 'No',
          pps: Number(formatUnits(pps, 18)).toFixed(6),
          rate: Number(formatUnits(rate, 18)).toFixed(6),
          swapFee: `${(Number(swapFee) / 1e16).toFixed(2)}%`,
        })
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setStats({ initialized: 'RPC unavailable' })
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SimpleGrid columns={2} gap="md" mb="lg">
      <BalYieldStat label="Protocol" value="balYIELD V3" />
      <BalYieldStat label="Network" value={phase1Pool.chainLabel} />
      <BalYieldStat label="Pool type" value={phase1Pool.type} />
      <BalYieldStat label="Initialized" value={stats.initialized || '-'} />
      <BalYieldStat label="Swap fee" value={stats.swapFee || phase1Pool.swapFee} />
      <BalYieldStat label="Amplification" value={stats.amp || phase1Pool.amp} />
      <BalYieldStat label="Rate" value={stats.rate || '-'} />
      <BalYieldStat label="Wrapper PPS" value={stats.pps || '-'} />
    </SimpleGrid>
  )
}
