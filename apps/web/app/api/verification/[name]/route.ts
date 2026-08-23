import { tiktokVerificationBody } from '@/lib/siteVerification'

export const dynamic = 'force-static'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params
  const body = tiktokVerificationBody(name)
  if (!body) {
    return new Response('Not found', { status: 404 })
  }
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
