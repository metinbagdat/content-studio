import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@content-studio/core/auth'
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
  const profileScoped = Boolean(process.env.HOSTINGER_REACH_PROFILE_UUID?.trim())
  const page = Number(req.nextUrl.searchParams.get('page') || 1)
  const search = req.nextUrl.searchParams.get('search') || ''

  if (!configured) {
    return NextResponse.json({
      configured: false,
      profileScoped,
      contacts: [],
      groups: [],
      total: null,
      contactsError: null,
      groupsError: null,
    })
  }

  const [contacts, groups] = await Promise.all([
    listReachContacts({ page: Number.isFinite(page) ? page : 1, search }),
    listReachGroups(),
  ])

  // Groups endpoint often returns Reach:9999 on some accounts — don't mask a successful contacts list.
  return NextResponse.json({
    configured: true,
    profileScoped,
    contacts: contacts.contacts,
    total: contacts.total ?? contacts.contacts.length,
    contactsError: contacts.error || null,
    groups: groups.groups,
    groupsError: groups.error || null,
    error: contacts.error || null,
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!reachConfigured()) {
    return NextResponse.json(
      { error: 'HOSTINGER_API_TOKEN eksik (hPanel → API Bearer token)' },
      { status: 400 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action || 'create-contact')

  if (action === 'create-contact' || action === 'add-contact') {
    const email = String(body.email || '').trim()
    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }
    const result = await createReachContact({
      email,
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
