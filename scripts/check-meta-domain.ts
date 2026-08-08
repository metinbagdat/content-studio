async function main() {
  const appId = process.env.META_APP_ID
  const secret = process.env.META_APP_SECRET
  if (!appId || !secret) {
    console.error('META_APP_ID / META_APP_SECRET missing')
    process.exit(1)
  }

  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${secret}&grant_type=client_credentials`,
  )
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: unknown }
  if (!tokenJson.access_token) {
    console.log('token fail', JSON.stringify(tokenJson, null, 2))
    return
  }

  const token = tokenJson.access_token
  const fields = ['id', 'name', 'app_domains', 'link'].join(',')
  const appRes = await fetch(`https://graph.facebook.com/v21.0/${appId}?fields=${fields}&access_token=${token}`)
  console.log('app:', JSON.stringify(await appRes.json(), null, 2))

  // Probe domain verification endpoints (may require user token)
  for (const path of [
    `${appId}/domain_verifications`,
    `${appId}/app_domains`,
  ]) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${path}?access_token=${token}`)
    console.log(path + ':', JSON.stringify(await res.json(), null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
