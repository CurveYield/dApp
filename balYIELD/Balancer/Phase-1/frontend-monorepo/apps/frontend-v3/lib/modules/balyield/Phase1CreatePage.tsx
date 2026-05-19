'use client'

import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { createPublicClient, encodeFunctionData, http, parseUnits, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { baseRpcUrl, phase1Pool, phase1Tokens } from './phase1.config'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

const factoryWrapperAbi = [
  {
    inputs: [
      {
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          {
            components: [
              { name: 'token', type: 'address' },
              { name: 'tokenType', type: 'uint8' },
              { name: 'rateProvider', type: 'address' },
              { name: 'paysYieldFees', type: 'bool' },
            ],
            name: 'tokens',
            type: 'tuple[]',
          },
          { name: 'amplificationParameter', type: 'uint256' },
          {
            components: [
              { name: 'pauseManager', type: 'address' },
              { name: 'swapFeeManager', type: 'address' },
            ],
            name: 'roleManagers',
            type: 'tuple',
          },
          { name: 'swapFeePercentage', type: 'uint256' },
          { name: 'enableDonation', type: 'bool' },
          { name: 'salt', type: 'bytes32' },
        ],
        name: 'input',
        type: 'tuple',
      },
    ],
    name: 'computeStableSurgePoolAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          {
            components: [
              { name: 'token', type: 'address' },
              { name: 'tokenType', type: 'uint8' },
              { name: 'rateProvider', type: 'address' },
              { name: 'paysYieldFees', type: 'bool' },
            ],
            name: 'tokens',
            type: 'tuple[]',
          },
          { name: 'amplificationParameter', type: 'uint256' },
          {
            components: [
              { name: 'pauseManager', type: 'address' },
              { name: 'swapFeeManager', type: 'address' },
            ],
            name: 'roleManagers',
            type: 'tuple',
          },
          { name: 'swapFeePercentage', type: 'uint256' },
          { name: 'enableDonation', type: 'bool' },
          { name: 'salt', type: 'bytes32' },
        ],
        name: 'input',
        type: 'tuple',
      },
      {
        components: [
          { name: 'creatorController', type: 'address' },
          { name: 'creatorPayoutReceiver', type: 'address' },
          { name: 'partnerRevenueReceiver', type: 'address' },
          { name: 'expectedPool', type: 'address' },
          { name: 'splitterSalt', type: 'bytes32' },
          {
            components: [
              { name: 'creatorPersonalBps', type: 'uint16' },
              { name: 'creatorPermanentLiquidityBps', type: 'uint16' },
              { name: 'creatorArbBps', type: 'uint16' },
              { name: 'creatorPartnerRevenueBps', type: 'uint16' },
            ],
            name: 'creatorFeeConfig',
            type: 'tuple',
          },
          {
            components: [
              { name: 'protocolFeeBps', type: 'uint16' },
              { name: 'adminExtraPermanentPoLBps', type: 'uint16' },
              { name: 'adminPartnerRevenueBps', type: 'uint16' },
              { name: 'residualTreasuryWeight', type: 'uint16' },
              { name: 'residualArbWeight', type: 'uint16' },
              { name: 'residualOtherWeight', type: 'uint16' },
            ],
            name: 'adminFeeConfig',
            type: 'tuple',
          },
          {
            components: [
              { name: 'enabled', type: 'bool' },
              { name: 'targetPool', type: 'address' },
              { name: 'balYieldToken', type: 'address' },
              { name: 'balYieldSource', type: 'address' },
              { name: 'balYieldMatchBps', type: 'uint16' },
              { name: 'partnerToken', type: 'address' },
              { name: 'partnerTokenSource', type: 'address' },
              { name: 'partnerMatchBps', type: 'uint16' },
            ],
            name: 'partnerPoLConfig',
            type: 'tuple',
          },
        ],
        name: 'policy',
        type: 'tuple',
      },
    ],
    name: 'createStableSurgePool',
    outputs: [{ name: 'pool', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address
const client = createPublicClient({ chain: base, transport: http(baseRpcUrl) })

function randomBytes32(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}` as Hex
}

function feePercentToWad(percent: string) {
  return parseUnits(percent || '0', 18) / 100n
}

function toBps(value: string) {
  return Number.parseInt(value || '0', 10)
}

export function Phase1CreatePage() {
  const [account, setAccount] = useState<Address>()
  const [name, setName] = useState('balYIELD StableSurge Pool')
  const [symbol, setSymbol] = useState('balYIELD-SS')
  const [tokenA, setTokenA] = useState(phase1Tokens.CRV.address)
  const [tokenB, setTokenB] = useState(phase1Tokens.cyCRV.address)
  const [rateProviderB, setRateProviderB] = useState(zeroAddress)
  const [amp, setAmp] = useState('50000')
  const [swapFee, setSwapFee] = useState('0.14')
  const [creatorPersonalBps, setCreatorPersonalBps] = useState('0')
  const [creatorPermanentLiquidityBps, setCreatorPermanentLiquidityBps] = useState('0')
  const [creatorArbBps, setCreatorArbBps] = useState('0')
  const [creatorPartnerRevenueBps, setCreatorPartnerRevenueBps] = useState('0')
  const [creatorPayout, setCreatorPayout] = useState<Address>()
  const [partnerRevenueReceiver, setPartnerRevenueReceiver] = useState<Address>(zeroAddress)
  const [poolSalt, setPoolSalt] = useState<Hex>(randomBytes32())
  const [splitterSalt, setSplitterSalt] = useState<Hex>(randomBytes32())
  const [expectedPool, setExpectedPool] = useState<Address>()
  const [isBusy, setIsBusy] = useState(false)
  const toast = useToast()

  const stableInput = useMemo(
    () => ({
      amplificationParameter: BigInt(amp || '0'),
      enableDonation: false,
      name,
      roleManagers: {
        pauseManager: account || zeroAddress,
        swapFeeManager: account || zeroAddress,
      },
      salt: poolSalt,
      swapFeePercentage: feePercentToWad(swapFee),
      symbol,
      tokens: [
        {
          paysYieldFees: false,
          rateProvider: zeroAddress,
          token: tokenA as Address,
          tokenType: 0,
        },
        {
          paysYieldFees: false,
          rateProvider: rateProviderB as Address,
          token: tokenB as Address,
          tokenType: rateProviderB === zeroAddress ? 0 : 1,
        },
      ],
    }),
    [account, amp, name, poolSalt, rateProviderB, swapFee, symbol, tokenA, tokenB]
  )

  async function connect() {
    if (!window.ethereum) throw new Error('No injected wallet found')
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as Address[]
    setAccount(accounts[0])
    setCreatorPayout(accounts[0])
    return accounts[0]
  }

  async function computeExpectedPool() {
    setIsBusy(true)
    try {
      const pool = await client.readContract({
        abi: factoryWrapperAbi,
        address: phase1Pool.factoryWrapper,
        args: [stableInput],
        functionName: 'computeStableSurgePoolAddress',
      })
      setExpectedPool(pool)
      return pool
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Address preview failed' })
      return undefined
    } finally {
      setIsBusy(false)
    }
  }

  async function deploy() {
    setIsBusy(true)
    try {
      if (!window.ethereum) throw new Error('No injected wallet found')
      const sender = account || (await connect())
      const pool = expectedPool || (await computeExpectedPool())
      if (!pool) throw new Error('Expected pool address not computed')

      const policy = {
        adminFeeConfig: {
          adminExtraPermanentPoLBps: 0,
          adminPartnerRevenueBps: 0,
          protocolFeeBps: 0,
          residualArbWeight: 0,
          residualOtherWeight: 0,
          residualTreasuryWeight: 10000,
        },
        creatorController: sender,
        creatorFeeConfig: {
          creatorArbBps: toBps(creatorArbBps),
          creatorPartnerRevenueBps: toBps(creatorPartnerRevenueBps),
          creatorPermanentLiquidityBps: toBps(creatorPermanentLiquidityBps),
          creatorPersonalBps: toBps(creatorPersonalBps),
        },
        creatorPayoutReceiver: creatorPayout || sender,
        expectedPool: pool,
        partnerPoLConfig: {
          balYieldMatchBps: 0,
          balYieldSource: zeroAddress,
          balYieldToken: zeroAddress,
          enabled: false,
          partnerMatchBps: 0,
          partnerToken: zeroAddress,
          partnerTokenSource: zeroAddress,
          targetPool: zeroAddress,
        },
        partnerRevenueReceiver,
        splitterSalt,
      }

      const data = encodeFunctionData({
        abi: factoryWrapperAbi,
        args: [stableInput, policy],
        functionName: 'createStableSurgePool',
      })
      const hash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ data, from: sender, to: phase1Pool.factoryWrapper }],
      })) as string
      toast({ status: 'success', title: `Deployment sent: ${hash.slice(0, 10)}...` })
      setPoolSalt(randomBytes32())
      setSplitterSalt(randomBytes32())
      setExpectedPool(undefined)
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Deployment failed' })
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Container maxW="container.lg" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="lg">
        <HStack justify="space-between">
          <Heading color="font.highlight" size="lg">
            Create a balYIELD pool
          </Heading>
          <Button onClick={connect} variant="secondary">
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect'}
          </Button>
        </HStack>

        <Card>
          <CardBody>
            <Stack gap="md">
              <Heading size="md">StableSurge settings</Heading>
              <Grid gap="md" templateColumns={{ base: '1fr', md: '1fr 1fr' }}>
                <Field label="Pool name" onChange={setName} value={name} />
                <Field label="Pool symbol" onChange={setSymbol} value={symbol} />
                <Field label="Token A" onChange={value => setTokenA(value as Address)} value={tokenA} />
                <Field label="Token B" onChange={value => setTokenB(value as Address)} value={tokenB} />
                <Field label="Token B rate provider" onChange={value => setRateProviderB(value as Address)} value={rateProviderB} />
                <Field label="Amplification" onChange={setAmp} value={amp} />
                <Field label="Swap fee percent" onChange={setSwapFee} value={swapFee} />
              </Grid>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Stack gap="md">
              <Heading size="md">Creator fee policy</Heading>
              <Grid gap="md" templateColumns={{ base: '1fr', md: '1fr 1fr' }}>
                <Field label="Creator payout" onChange={value => setCreatorPayout(value as Address)} value={creatorPayout || ''} />
                <Field
                  label="Partner revenue receiver"
                  onChange={value => setPartnerRevenueReceiver(value as Address)}
                  value={partnerRevenueReceiver}
                />
                <Field label="Creator personal bps" onChange={setCreatorPersonalBps} value={creatorPersonalBps} />
                <Field
                  label="Creator permanent liquidity bps"
                  onChange={setCreatorPermanentLiquidityBps}
                  value={creatorPermanentLiquidityBps}
                />
                <Field label="Creator arb bps" onChange={setCreatorArbBps} value={creatorArbBps} />
                <Field label="Creator partner revenue bps" onChange={setCreatorPartnerRevenueBps} value={creatorPartnerRevenueBps} />
              </Grid>
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Stack gap="md">
              <HStack justify="space-between">
                <Button isLoading={isBusy} onClick={computeExpectedPool} variant="primary">
                  Preview address
                </Button>
                <Button isLoading={isBusy} onClick={deploy} variant="secondary">
                  Deploy pool
                </Button>
              </HStack>
              <Box bg="background.level2" borderRadius="md" p="md">
                <Text color="font.secondary" fontSize="sm">
                  Factory wrapper
                </Text>
                <Text>{phase1Pool.factoryWrapper}</Text>
                <Text color="font.secondary" fontSize="sm" mt="sm">
                  Expected pool
                </Text>
                <Text>{expectedPool || 'Preview required'}</Text>
              </Box>
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    </Container>
  )
}

function Field({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <FormControl>
      <FormLabel color="font.secondary" fontSize="sm">
        {label}
      </FormLabel>
      <Input onChange={event => onChange(event.target.value)} value={value} />
    </FormControl>
  )
}
