import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  createReachContact,
  listReachContacts,
  listReachGroups,
  reachConfigured,
} from '@/lib/email/hostingerReach'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configured = reachConfigured()
  const page = Number(req.nextUrl.searchParams.get('page') || 1)
  const search = req.nextUrl.searchParams.get('search') || ''

  if (!configured) {
    return NextResponse.json({
      configured: false,
      profileScoped: Boolean(process.env.HOSTINGER_REACH_PROFILE_UUID?.trim()),
      contacts: [],
      groups: [],
      total: null,
    })
  }

  const [contacts, groups] = await Promise.all([
    listReachContacts({ page: Number.isFinite(page) ? page : 1, search }),
    listReachGroups(),
  ])

  return NextResponse.json({
    configured: true,
    profileScoped: Boolean(process.env.HOSTINGER_REACH_PROFILE_UUID?.trim()),
    contacts: contacts.contacts,
    total: contacts.total,
    groups: groups.groups,
    error: contacts.error || groups.error || null,
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!reachConfigured()) {
    return NextResponse.json({ error: 'HOSTINGER_API_TOKEN not set' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action || 'create-contact')

  if (action === 'create-contact') {
    const result = await createReachContact({
      email: String(body.email || ''),
      name: body.name ? String(body.name) : undefined,
      surname: body.surname ? String(body.surname) : undefined,
      phone: body.phone ? String(body.phone) : undefined,
      note: body.note ? String(body.note) : undefined,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
