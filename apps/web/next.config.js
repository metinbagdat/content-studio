const path = require('path')
const { loadEnvConfig } = require('@next/env')

const repoRoot = path.join(__dirname, '../..')
loadEnvConfig(repoRoot)

const tiktokVerificationRewrites = [
  'tiktokcZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ',
  'tiktokNq6NRmactSBBqMFjzTc2qwldDnGCY4iK',
  'tiktokCdys8pJO7rCB48I8ms06eJ04umkNXsAY',
  'tiktokwfWWX3oadkkisYGZhAVTlst52P4dpm2Z',
].flatMap((name) => [
  { source: `/${name}.txt`, destination: `/api/verification/${name}` },
  { source: `/legal/privacy/${name}.txt`, destination: `/api/verification/${name}` },
  { source: `/legal/terms/${name}.txt`, destination: `/api/verification/${name}` },
])

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@content-studio/db', '@content-studio/core'],
  serverExternalPackages: ['ws', 'msedge-tts', 'fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static'],
  // Keep Vercel/GHA `vercel build` from repo root: output still lands in root `.next`.
  distDir: '../../.next',
  outputFileTracingRoot: repoRoot,
  async rewrites() {
    return tiktokVerificationRewrites
  },
}

module.exports = nextConfig
