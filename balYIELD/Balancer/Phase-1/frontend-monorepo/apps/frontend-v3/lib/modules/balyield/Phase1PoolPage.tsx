'use client'

import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Container,
  HStack,
  Heading,
  Image,
  Link,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import { phase1Pool, phase1Tokens } from './phase1.config'
import { BalYieldStat } from './components/BalYieldStat'
import { Phase1LiveStats } from './Phase1LiveStats'

export function Phase1PoolPage() {
  const tokens = Object.values(phase1Tokens)

  return (
    <Container maxW="container.xl" pb={{ base: 'md', md: 'xl' }} pt={{ base: '96px', md: '104px' }}>
      <Stack gap="lg">
        <HStack justify="space-between">
          <Box>
            <Heading color="font.highlight" size="2xl">
              Pools
            </Heading>
            <Text color="font.secondary" mt="sm">
              Base liquidity built from balYIELD Phase 1 contracts.
            </Text>
          </Box>
          <Button as={NextLink} href="/create" variant="primary">
            Create a pool
          </Button>
        </HStack>

        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="lg">
          <Card>
            <CardBody>
              <HStack justify="space-between" mb="md">
                <Heading size="md">Pools</Heading>
                <Badge colorScheme="green">Live Base</Badge>
              </HStack>
              <HStack
                align="center"
                as={NextLink}
                borderTop="1px solid"
                borderColor="border.base"
                gap="md"
                href="/balyield/swap"
                justify="space-between"
                py="md"
              >
                <HStack gap="md">
                  <HStack gap="-2">
                    {tokens.map(token => (
                      <Image
                        alt=""
                        border="2px solid"
                        borderColor="background.level2"
                        borderRadius="full"
                        boxSize="34px"
                        key={token.symbol}
                        src={token.logo}
                      />
                    ))}
                  </HStack>
                  <Box>
                    <Text color="font.highlight" fontWeight="bold">
                      {phase1Pool.symbol}
                    </Text>
                    <Text color="font.secondary" fontSize="sm">
                      {phase1Pool.name}
                    </Text>
                  </Box>
                </HStack>
                <Text>{phase1Pool.chainLabel}</Text>
                <Text>{phase1Pool.swapFee}</Text>
                <Text>{phase1Pool.type}</Text>
              </HStack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <HStack justify="space-between" mb="md">
                <Heading size="md">Pool preview</Heading>
                <Link color="font.highlight" href={`https://basescan.org/address/${phase1Pool.pool}`} isExternal>
                  View contract
                </Link>
              </HStack>
              <Phase1LiveStats />
              <SimpleGrid columns={2} gap="md" mb="lg">
                <BalYieldStat
                  label="Pool"
                  value={`${phase1Pool.pool.slice(0, 6)}...${phase1Pool.pool.slice(-4)}`}
                />
                <BalYieldStat
                  label="Rate provider"
                  value={`${phase1Pool.rateProvider.slice(0, 6)}...${phase1Pool.rateProvider.slice(-4)}`}
                />
              </SimpleGrid>
              <Stack>
                {tokens.map(token => (
                  <HStack justify="space-between" key={token.symbol}>
                    <HStack>
                      <Image alt="" borderRadius="full" boxSize="32px" src={token.logo} />
                      <Box>
                        <Text fontWeight="bold">{token.symbol}</Text>
                        <Text color="font.secondary" fontSize="sm">
                          {token.name}
                        </Text>
                      </Box>
                    </HStack>
                    <Text color="font.secondary" fontSize="sm">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </Text>
                  </HStack>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  )
}
