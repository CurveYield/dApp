'use client'

import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  HStack,
  Heading,
  Image,
  Input,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { useState } from 'react'
import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  http,
  parseUnits,
  type Address,
} from 'viem'
import { base } from 'viem/chains'
import { baseRpcUrl, phase1Pool, phase1Tokens } from './phase1.config'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

const routerAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'contract IERC20', name: 'tokenIn', type: 'address' },
      { internalType: 'contract IERC20', name: 'tokenOut', type: 'address' },
      { internalType: 'uint256', name: 'exactAmountIn', type: 'uint256' },
      { internalType: 'address', name: 'sender', type: 'address' },
      { internalType: 'bytes', name: 'userData', type: 'bytes' },
    ],
    name: 'querySwapSingleTokenExactIn',
    outputs: [{ internalType: 'uint256', name: 'amountCalculated', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'contract IERC20', name: 'tokenIn', type: 'address' },
      { internalType: 'contract IERC20', name: 'tokenOut', type: 'address' },
      { internalType: 'uint256', name: 'exactAmountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'minAmountOut', type: 'uint256' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'bool', name: 'wethIsEth', type: 'bool' },
      { internalType: 'bytes', name: 'userData', type: 'bytes' },
    ],
    name: 'swapSingleTokenExactIn',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

const erc20Abi = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const permit2Abi = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const maxUint160 = (1n << 160n) - 1n
type SwapSymbol = 'CRV' | 'cyCRV'

const client = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
})

export function Phase1SwapPage() {
  const [amount, setAmount] = useState('0.01')
  const [account, setAccount] = useState<Address>()
  const [tokenInSymbol, setTokenInSymbol] = useState<SwapSymbol>('CRV')
  const [quote, setQuote] = useState('')
  const [quoteRaw, setQuoteRaw] = useState<bigint>()
  const [isBusy, setIsBusy] = useState(false)
  const [status, setStatus] = useState('')
  const toast = useToast()
  const tokenOutSymbol: SwapSymbol = tokenInSymbol === 'CRV' ? 'cyCRV' : 'CRV'
  const tokenIn = phase1Tokens[tokenInSymbol]
  const tokenOut = phase1Tokens[tokenOutSymbol]

  async function connect() {
    if (!window.ethereum) throw new Error('No injected wallet found')
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as Address[]
    setAccount(accounts[0])
    return accounts[0]
  }

  async function preview(senderOverride?: Address) {
    setIsBusy(true)
    try {
      const sender = senderOverride || account || (await connect())
      const exactAmountIn = parseUnits(amount || '0', tokenIn.decimals)
      const result = await client.readContract({
        abi: routerAbi,
        address: phase1Pool.router,
        args: [
          phase1Pool.pool,
          tokenIn.address,
          tokenOut.address,
          exactAmountIn,
          sender,
          '0x',
        ],
        functionName: 'querySwapSingleTokenExactIn',
      })
      setQuoteRaw(result)
      setQuote(formatUnits(result, tokenOut.decimals))
      return result
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Quote failed' })
      return undefined
    } finally {
      setIsBusy(false)
    }
  }

  async function waitForHash(hash: unknown) {
    if (typeof hash !== 'string') throw new Error('Wallet did not return a transaction hash')
    await client.waitForTransactionReceipt({ hash: hash as `0x${string}` })
    return hash
  }

  async function ensureApprovals(sender: Address, exactAmountIn: bigint) {
    setStatus(`Checking ${tokenInSymbol} approval to Permit2`)
    const tokenAllowance = await client.readContract({
      abi: erc20Abi,
      address: tokenIn.address,
      args: [sender, phase1Pool.permit2],
      functionName: 'allowance',
    })

    if (tokenAllowance < exactAmountIn) {
      setStatus(`Approving Permit2 to spend ${tokenInSymbol}`)
      const approvePermit2Data = encodeFunctionData({
        abi: erc20Abi,
        args: [phase1Pool.permit2, exactAmountIn],
        functionName: 'approve',
      })
      await waitForHash(
        await window.ethereum?.request({
          method: 'eth_sendTransaction',
          params: [{ data: approvePermit2Data, from: sender, to: tokenIn.address }],
        })
      )
    }

    setStatus('Checking Balancer router approval in Permit2')
    const permit2AllowanceData = encodeFunctionData({
      abi: permit2Abi,
      args: [sender, tokenIn.address, phase1Pool.router],
      functionName: 'allowance',
    })
    const permit2AllowanceRaw = await client.call({
      data: permit2AllowanceData,
      to: phase1Pool.permit2,
    })
    const [permit2Amount, permit2Expiration] = decodeFunctionResult({
      abi: permit2Abi,
      data: permit2AllowanceRaw.data || '0x',
      functionName: 'allowance',
    })

    const now = BigInt(Math.floor(Date.now() / 1000))
    if (permit2Amount < exactAmountIn || BigInt(permit2Expiration) <= now + 900n) {
      setStatus('Approving Balancer router in Permit2')
      const approveRouterData = encodeFunctionData({
        abi: permit2Abi,
        args: [
          tokenIn.address,
          phase1Pool.router,
          maxUint160,
          Number(now + 60n * 60n * 24n * 30n),
        ],
        functionName: 'approve',
      })
      await waitForHash(
        await window.ethereum?.request({
          method: 'eth_sendTransaction',
          params: [{ data: approveRouterData, from: sender, to: phase1Pool.permit2 }],
        })
      )
    }
  }

  async function swap() {
    setIsBusy(true)
    try {
      if (!window.ethereum) throw new Error('No injected wallet found')
      const sender = account || (await connect())
      const exactAmountIn = parseUnits(amount || '0', tokenIn.decimals)
      await ensureApprovals(sender, exactAmountIn)
      setStatus('Refreshing quote')
      const freshQuote = (await preview(sender)) || quoteRaw
      if (!freshQuote || freshQuote === 0n) throw new Error('Quote returned zero')
      const minAmountOut = (freshQuote * 995n) / 1000n
      const data = encodeFunctionData({
        abi: routerAbi,
        args: [
          phase1Pool.pool,
          tokenIn.address,
          tokenOut.address,
          exactAmountIn,
          minAmountOut,
          BigInt(Math.floor(Date.now() / 1000) + 900),
          false,
          '0x',
        ],
        functionName: 'swapSingleTokenExactIn',
      })

      setStatus('Sending swap')
      const hash = await waitForHash(
        await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ data, from: sender, to: phase1Pool.router }],
        })
      )
      toast({ status: 'success', title: `Swap confirmed: ${hash.slice(0, 10)}...` })
      setStatus('')
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Swap failed' })
      setStatus('')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Container maxW="container.md" pb={{ base: 'md', md: 'xl' }} pt={{ base: '96px', md: '104px' }}>
      <Card>
        <CardBody>
          <Stack gap="md">
            <HStack justify="space-between">
              <Heading color="font.highlight" size="lg">
                Swap
              </Heading>
              <Button onClick={connect} variant="secondary">
                {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect'}
              </Button>
            </HStack>

            <SwapBox amount={amount} label="From" onChange={setAmount} symbol={tokenInSymbol} />
            <Box
              alignSelf="center"
              as="button"
              bg="background.level3"
              borderRadius="full"
              onClick={() => {
                setTokenInSymbol(tokenOutSymbol)
                setQuote('')
                setQuoteRaw(undefined)
              }}
              px="md"
              py="sm"
            >
              v
            </Box>
            <SwapBox amount={quote} label="To" onChange={() => undefined} readOnly symbol={tokenOutSymbol} />

            <Button isLoading={isBusy} onClick={() => preview()} size="lg" variant="primary">
              Preview swap
            </Button>
            <Button isLoading={isBusy} onClick={swap} size="lg" variant="secondary">
              Swap with wallet
            </Button>
            {status ? (
              <Text color="font.secondary" fontSize="sm">
                {status}
              </Text>
            ) : null}

            <Stack color="font.secondary" fontSize="sm">
              <HStack justify="space-between">
                <Text>Pool</Text>
                <Text>{phase1Pool.symbol}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text>Swap fee</Text>
                <Text>{phase1Pool.swapFee}</Text>
              </HStack>
            </Stack>
          </Stack>
        </CardBody>
      </Card>
    </Container>
  )
}

function SwapBox({
  amount,
  label,
  onChange,
  readOnly,
  symbol,
}: {
  amount: string
  label: string
  onChange: (value: string) => void
  readOnly?: boolean
  symbol: SwapSymbol
}) {
  const token = phase1Tokens[symbol]

  return (
    <Box bg="background.level2" borderRadius="md" p="md">
      <Text color="font.secondary" fontSize="sm" fontWeight="bold" mb="sm">
        {label}
      </Text>
      <HStack>
        <Input
          border="0"
          fontSize="3xl"
          fontWeight="bold"
          onChange={event => onChange(event.target.value)}
          readOnly={readOnly}
          value={amount}
        />
        <Button leftIcon={<Image alt="" borderRadius="full" boxSize="22px" src={token.logo} />}>
          {symbol}
        </Button>
      </HStack>
    </Box>
  )
}
