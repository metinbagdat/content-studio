import { describe, expect, it } from 'vitest'
import {
  METRICS_DICTIONARY_PACK,
  buildMetricsDictionarySource,
  renderMetricsDictionaryHtml,
  toLearnConMetricsDictionaryExport,
  validateMetricsDictionary,
} from './metricsDictionary'

describe('Growth OS metrics dictionary (CS-OS-01)', () => {
  it('covers WLAS, Family WAU, Active Class, K-factor with TR+EN', () => {
    const pack = validateMetricsDictionary(METRICS_DICTIONARY_PACK)
    const keys = pack.metrics.map((m) => m.key)
    expect(keys).toEqual(expect.arrayContaining(['wlas', 'family_wau', 'active_class', 'k_factor']))
    expect(pack.roleActivations).toHaveLength(4)
    expect(pack.loops).toHaveLength(4)
    expect(pack.loops.map((l) => l.key)).toEqual(
      expect.arrayContaining([
        'student_viral',
        'teacher_amplification',
        'teacher_to_institution',
        'parent_to_parent',
      ]),
    )
  })

  it('exports and renders HTML dictionary', () => {
    expect(buildMetricsDictionarySource().tags).toContain('cs-os-01')
    expect(toLearnConMetricsDictionaryExport().contract).toBe('LEARNCON-OS-CS-OS-01')
    const html = renderMetricsDictionaryHtml(METRICS_DICTIONARY_PACK)
    expect(html).toContain('WLAS')
    expect(html).toContain('Family WAU')
    expect(html).toContain('Noto Sans')
  })
})
