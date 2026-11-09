import { describe, expect, it } from 'vitest'
import {
  CROSS_ROLE_PACK,
  buildCrossRoleSource,
  fillCrossRoleTemplate,
  renderCrossRoleHtml,
  toLearnConCrossRoleExport,
  validateCrossRolePack,
} from './crossRoleTemplates'

describe('Cross-role templates (CS-OS-03)', () => {
  it('covers invite / share / referral / institution tones and acceptance edges', () => {
    const pack = validateCrossRolePack(CROSS_ROLE_PACK)
    const edges = pack.templates.map((t) => `${t.roleFrom}->${t.roleTo}`)
    expect(edges).toEqual(
      expect.arrayContaining([
        'teacher->student',
        'student->parent',
        'parent->parent',
        'institution->parent',
      ]),
    )
    expect(new Set(pack.templates.map((t) => t.tone))).toEqual(
      new Set(['invite_peer', 'share_result', 'referral_parent', 'institution_formal']),
    )
  })

  it('fills {{cta}} and exports HTML', () => {
    const invite = CROSS_ROLE_PACK.templates.find((t) => t.id === 'cr-invite-teacher-student')!
    const filled = fillCrossRoleTemplate(invite, { cta: 'https://example.test/x' })
    expect(filled.bodyTr).toContain('https://example.test/x')
    expect(filled.bodyTr).not.toContain('{{cta}}')

    expect(buildCrossRoleSource().tags).toContain('cs-os-03')
    expect(toLearnConCrossRoleExport().contract).toBe('LEARNCON-OS-CS-OS-03')
    const html = renderCrossRoleHtml(CROSS_ROLE_PACK)
    expect(html).toContain('cr-referral-parent')
    expect(html).toContain('Noto Sans')
  })
})
