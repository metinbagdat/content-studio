const REACH_API_BASE = 'https://developers.hostinger.com'

export type ReachContact = {
  uuid?: string
  email: string
  name?: string
  surname?: string
  phone?: string
  note?: string
  subscriptionStatus?: string
  source?: string
}

export type ReachGroup = {
  uuid: string
  title: string
}

function reachToken(): string {
  return (
    process.env.HOSTINGER_API_TOKEN?.trim() ||
    process.env.HOSTINGER_REACH_TOKEN?.trim() ||
    ''
  )
}

function profileUuid(): string {
  return process.env.HOSTINGER_REACH_PROFILE_UUID?.trim() || ''
}

export function reachConfigured(): boolean {
  return Boolean(reachToken())
}

function contactsPath(): string {
  const profile = profileUuid()
  return profile
    ? `/api/reach/v1/profiles/${encodeURIComponent(profile)}/contacts`
    : '/api/reach/v1/contacts'
}

async function reachFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = reachToken()
  if (!token) {
    throw new Error('HOSTINGER_API_TOKEN eksik (Reach → Integrations → Public API)')
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${REACH_API_BASE}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(20_000),
  })
}

async function parseError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    error?: string
    errors?: Record<string, string[] | string>
  }
  if (data.message) return data.message
  if (data.error) return data.error
  if (data.errors) {
    const first = Object.values(data.errors)[0]
    if (Array.isArray(first) && first[0]) return first[0]
    if (typeof first === 'string') return first
  }
  return `Hostinger Reach HTTP ${res.status}`
}

function normalizeContact(raw: Record<string, unknown>): ReachContact {
  return {
    uuid: String(raw.uuid || ''),
    email: String(raw.email || ''),
    name: raw.name ? String(raw.name) : undefined,
    surname: raw.surname ? String(raw.surname) : undefined,
    phone: raw.phone ? String(raw.phone) : undefined,
    note: raw.note ? String(raw.note) : undefined,
    subscriptionStatus: String(raw.subscriptionStatus || raw.subscription_status || ''),
    source: raw.source ? String(raw.source) : undefined,
  }
}

export async function createReachContact(input: {
  email: string
  name?: string
  surname?: string
  phone?: string
  note?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Geçerli e-posta gerekli' }
  }

  const body: Record<string, string> = { email }
  if (input.name?.trim()) body.name = input.name.trim()
  if (input.surname?.trim()) body.surname = input.surname.trim()
  if (input.phone?.trim()) body.phone = input.phone.trim()
  if (input.note?.trim()) body.note = input.note.trim()

  try {
    const res = await reachFetch(contactsPath(), {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, error: await parseError(res) }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function listReachContacts(opts?: {
  page?: number
  search?: string
  subscriptionStatus?: string
}): Promise<{ contacts: ReachContact[]; total: number | null; error?: string }> {
  const params = new URLSearchParams()
  if (opts?.page) params.set('page', String(opts.page))
  if (opts?.search?.trim()) params.set('search', opts.search.trim())
  if (opts?.subscriptionStatus) params.set('subscriptionStatus', opts.subscriptionStatus)
  const qs = params.toString()
  const path = `${contactsPath()}${qs ? `?${qs}` : ''}`

  try {
    const res = await reachFetch(path)
    if (!res.ok) return { contacts: [], total: null, error: await parseError(res) }
    const json = (await res.json()) as {
      data?: Record<string, unknown>[]
      meta?: { total?: number }
    }
    const rows = Array.isArray(json.data) ? json.data : Array.isArray(json) ? (json as Record<string, unknown>[]) : []
    return {
      contacts: rows.map(normalizeContact),
      total: typeof json.meta?.total === 'number' ? json.meta.total : null,
    }
  } catch (err) {
    return { contacts: [], total: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function listReachGroups(): Promise<{ groups: ReachGroup[]; error?: string }> {
  try {
    const res = await reachFetch('/api/reach/v1/contacts/groups')
    if (!res.ok) return { groups: [], error: await parseError(res) }
    const json = (await res.json()) as ReachGroup[] | { data?: ReachGroup[] }
    const groups = Array.isArray(json) ? json : json.data || []
    return { groups }
  } catch (err) {
    return { groups: [], error: err instanceof Error ? err.message : String(err) }
  }
}
