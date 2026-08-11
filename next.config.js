/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['ws', 'msedge-tts', 'fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static'],
}

module.exports = nextConfig