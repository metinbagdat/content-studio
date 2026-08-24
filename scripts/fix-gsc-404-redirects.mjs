import { readFileSync } from 'fs'

function env(k) {
  const t = readFileSync('.env', 'utf8')
  const m = t.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}

const auth = Buffer.from(`${env('WP_USERNAME')}:${env('WP_APP_PASSWORD')}`).toString('base64')
const base = env('WP_BASE_URL').replace(/\/$/, '')
const headers = {
  Authorization: `Basic ${auth}`,
  'Content-Type': 'application/json',
}

async function ensureRedirectPage(slug, title) {
  const existing = await (
    await fetch(`${base}/wp-json/wp/v2/pages?slug=${slug}&status=publish,draft,trash`, {
      headers: { Authorization: `Basic ${auth}` },
    })
  ).json()

  let id = existing[0]?.id
  if (!id) {
    const created = await fetch(`${base}/wp-json/wp/v2/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        slug,
        status: 'publish',
        content:
          '<p>Bu adres taşındı. <a href="https://blog.egitim.today/">Ana sayfaya dön</a>.</p>',
      }),
    })
    const data = await created.json()
    if (!created.ok) throw new Error(`create ${slug}: ${JSON.stringify(data)}`)
    id = data.id
    console.log('created page', slug, id)
  } else {
    // untrash / publish if needed
    await fetch(`${base}/wp-json/wp/v2/pages/${id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'publish', slug }),
    })
    console.log('reused page', slug, id)
  }

  const redir = await fetch(`${base}/wp-json/rankmath/v1/updateRedirection`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      objectID: id,
      objectType: 'post',
      hasRedirect: true,
      redirectionUrl: `${base}/`,
      redirectionType: '301',
    }),
  })
  const redirBody = await redir.text()
  console.log('rankmath redirect', slug, redir.status, redirBody.slice(0, 200))

  await fetch(`${base}/wp-json/rankmath/v1/updateMeta`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      objectType: 'post',
      objectID: id,
      meta: {
        rank_math_robots: ['noindex', 'nofollow'],
        rank_math_title: `${title} | yönlendirildi`,
      },
    }),
  })

  return id
}

async function check(path) {
  const res = await fetch(`${base}${path}`, { redirect: 'manual' })
  console.log(
    'check',
    path,
    res.status,
    res.headers.get('location') || '',
    res.headers.get('x-robots-tag') || '',
  )
}

await ensureRedirectPage('sample-page', 'Sample Page')
await ensureRedirectPage('hello-world', 'Hello world')
await check('/sample-page/')
await check('/hello-world/')
