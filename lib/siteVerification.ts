/** TikTok domain verification files — served via API when Vercel prebuilt skips public/. */
export const TIKTOK_SITE_VERIFICATION: Record<string, string> = {
  tiktokcZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ:
    'tiktok-developers-site-verification=cZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ',
  tiktokNq6NRmactSBBqMFjzTc2qwldDnGCY4iK:
    'tiktok-developers-site-verification=Nq6NRmactSBBqMFjzTc2qwldDnGCY4iK',
  tiktokCdys8pJO7rCB48I8ms06eJ04umkNXsAY:
    'tiktok-developers-site-verification=Cdys8pJO7rCB48I8ms06eJ04umkNXsAY',
  tiktokwfWWX3oadkkisYGZhAVTlst52P4dpm2Z:
    'tiktok-developers-site-verification=wfWWX3oadkkisYGZhAVTlst52P4dpm2Z',
}

export function tiktokVerificationBody(name: string): string | undefined {
  const key = name.replace(/\.txt$/, '')
  return TIKTOK_SITE_VERIFICATION[key]
}
