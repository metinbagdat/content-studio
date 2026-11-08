import { describe, expect, it } from 'vitest'
import {
  buildPrereqForest,
  buildPrereqSource,
  hasPrerequisiteEdge,
  readPrereqGraph,
  toLearnConPrereqExport,
  validatePrereqGraph,
} from './prereqGraph'
import { TYT_MATH_PREREQ_GRAPH, TYT_MATH_PREREQ_NODES } from './tytMathPrereqSeed'

describe('prereq graph (CS-STU-02)', () => {
  it('covers full TYT Matematik topic set from LearnCon 007b', () => {
    const tyt = TYT_MATH_PREREQ_NODES.filter((n) => n.examType === 'TYT')
    expect(tyt.length).toBe(18)
    expect(tyt.every((n) => n.subject === 'Matematik')).toBe(true)
  })

  it('encodes Logaritma → Üstel (Üslü) chain', () => {
    expect(hasPrerequisiteEdge(TYT_MATH_PREREQ_NODES, '12.1.2.1.', '12.1.1.1.')).toBe(true)
    expect(hasPrerequisiteEdge(TYT_MATH_PREREQ_NODES, '12.1.1.1.', 'tyt_mat_uslu_koklu')).toBe(
      true,
    )
  })

  it('validates seed, exports LearnCon contract, builds forest', () => {
    const draft = buildPrereqSource(TYT_MATH_PREREQ_GRAPH)
    expect(draft.category).toBe('prereq-graph')
    const record = readPrereqGraph(draft.content)
    const exported = toLearnConPrereqExport(record)
    expect(exported.contract).toBe('LEARNCON-STU-prereq')
    expect(exported.nodes.find((n) => n.code === '12.1.2.1.')?.prerequisites).toEqual([
      '12.1.1.1.',
    ])
    const forest = buildPrereqForest(record.nodes)
    expect(forest.some((r) => r.code === 'tyt_mat_dogal_sayilar')).toBe(true)
  })

  it('rejects cycles and unknown prerequisites', () => {
    expect(() =>
      validatePrereqGraph({
        slug: 'bad-cycle',
        title: 'bad',
        nodes: [
          {
            code: 'a',
            label: 'A',
            examType: 'TYT',
            subject: 'Matematik',
            prerequisites: ['b'],
          },
          {
            code: 'b',
            label: 'B',
            examType: 'TYT',
            subject: 'Matematik',
            prerequisites: ['a'],
          },
        ],
      }),
    ).toThrow(/döngü/i)

    expect(() =>
      validatePrereqGraph({
        slug: 'bad-ref',
        title: 'bad',
        nodes: [
          {
            code: 'a',
            label: 'A',
            examType: 'TYT',
            subject: 'Matematik',
            prerequisites: ['missing'],
          },
        ],
      }),
    ).toThrow(/tanımsız/i)
  })
})
