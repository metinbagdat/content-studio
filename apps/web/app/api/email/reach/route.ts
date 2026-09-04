import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@content-studio/core/auth'
import {
  createReachContact,
  listReachContacts,
  listReachGroups,
  reachConfigured,
} from '@/lib/email/hostingerReach'
import { listPendingReachReminders, dismissReachReminder } from '@/lib/email/reachReminders'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configured = reachConfigured()
  const profileScoped = Boolean(process.env.HOSTINGER_REACH_PROFILE_UUID?.trim())
  const reminders = await listPendingReachReminders()

  if (!configured) {
    return NextResponse.json({ configured, profileScoped, contacts: [], total: null, groups: [], reminders })
  }

  const { searchParams } = new URL(req.url)
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined
  const search = searchParams.get('search') || undefined
  const subscriptionStatus = searchParams.get('subscriptionStatus') || undefined

  try {
    const [contactsResult, groupsResult] = await Promise.all([
      listReachContacts({ page, search, subscriptionStatus }),
      listReachGroups(),
    ])
    return NextResponse.json({
      configured,
      profileScoped,
      contacts: contactsResult.contacts,
      total: contactsResult.total,
      contactsError: contactsResult.error || null,
      groups: groupsResult.groups,
      groupsError: groupsResult.error || null,
      reminders,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/email/reach]', message)
    return NextResponse.json({ error: `Sunucu hatası: ${message}` }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const action = String(body.action || 'create-contact')

  if (action === 'dismiss-reminder') {
    const sourceId = String(body.sourceId || '')
    if (!sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 })
    await dismissReachReminder(sourceId)
    return NextResponse.json({ ok: true })
  }

  if (!reachConfigured()) {
    return NextResponse.json(
      { error: 'HOSTINGER_API_TOKEN eksik (Reach → Integrations → Public API)' },
      { status: 400 },
    )
  }

  try {
    return await handleAction(action, body)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[POST /api/email/reach] action=${action}`, message)
    return NextResponse.json({ error: `Sunucu hatası (${action}): ${message}` }, { status: 500 })
  }
}

async function handleAction(action: string, body: Record<string, unknown>) {
  if (action === 'create-contact') {
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}