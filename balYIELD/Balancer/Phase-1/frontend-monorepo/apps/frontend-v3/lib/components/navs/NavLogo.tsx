'use client'

import { fadeIn } from '@repo/lib/shared/utils/animations'
import { BalYieldLogo } from '../imgs/BalYieldLogo'
import { BalYieldLogoType } from '../imgs/BalYieldLogoType'
import { Box, Link } from '@chakra-ui/react'
import { motion } from 'motion/react'
import NextLink from 'next/link'

export function NavLogo() {
  return (
    <Box as={motion.div} variants={fadeIn}>
      <Link as={NextLink} href="/" prefetch variant="nav">
        <Box>
          <Box display={{ base: 'block', md: 'none' }}>
            <BalYieldLogo width="26px" />
          </Box>
          <Box display={{ base: 'none', md: 'block' }}>
            <BalYieldLogoType width="106px" />
          </Box>
        </Box>
      </Link>
    </Box>
  )
}
