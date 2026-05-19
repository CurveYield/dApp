import { Container, Heading, Link, Stack, Text } from '@chakra-ui/react'

export default function NotFound() {
  return (
    <Container maxW="container.md" py="2xl">
      <Stack gap="md">
        <Heading color="font.highlight">Page not found</Heading>
        <Text color="font.secondary">This balYIELD route is not enabled for phase 1.</Text>
        <Link color="font.link" href="/balyield/pools">
          Open pools
        </Link>
      </Stack>
    </Container>
  )
}
