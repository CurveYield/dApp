import Image from 'next/image'

export function BalYieldLogo({ width = '26px' }: { width?: string }) {
  const size = Number.parseInt(width, 10) || 26

  return (
    <Image
      alt="balYIELD"
      height={size}
      src="/images/balyield/curveyield.png"
      style={{ borderRadius: '50%' }}
      width={size}
    />
  )
}
