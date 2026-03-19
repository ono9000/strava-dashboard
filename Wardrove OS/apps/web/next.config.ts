import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@wardrobe-os/db', '@wardrobe-os/types', '@wardrobe-os/core'],
}

export default config
