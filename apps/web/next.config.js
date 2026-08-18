const path = require('path')
const { loadEnvConfig } = require('@next/env')

const repoRoot = path.join(__dirname, '../..')
loadEnvConfig(repoRoot)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@content-studio/db'],
  serverExternalPackages: ['ws', 'msedge-tts', 'fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static'],
  // Keep Vercel/GHA `vercel build` from repo root: output still lands in root `.next`.
  distDir: '../../.next',
  outputFileTracingRoot: repoRoot,
}

module.exports = nextConfig
