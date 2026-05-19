import { Box, Text } from '@chakra-ui/react'

export function BalYieldStat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text color="font.secondary" fontSize="sm">
        {label}
      </Text>
      <Text fontWeight="bold">{value}</Text>
    </Box>
  )
}
