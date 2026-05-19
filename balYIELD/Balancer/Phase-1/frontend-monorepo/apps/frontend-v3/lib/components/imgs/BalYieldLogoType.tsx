import { HStack, Text } from '@chakra-ui/react'
import { BalYieldLogo } from './BalYieldLogo'

export function BalYieldLogoType({ width = '106px' }: { width?: string }) {
  return (
    <HStack gap="2" width={width}>
      <BalYieldLogo width="26px" />
      <Text color="font.primary" fontSize="lg" fontWeight="bold" letterSpacing="tight">
        balYIELD
      </Text>
    </HStack>
  )
}
