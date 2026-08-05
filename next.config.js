/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['ws', 'msedge-tts', 'fluent-ffmpeg', 'ffmpeg-static'],
}

module.exports = nextConfig