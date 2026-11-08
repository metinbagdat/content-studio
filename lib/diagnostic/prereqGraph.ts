/**
 * CS-STU-02 prerequisite knowledge graph.
 * Authoring lives here; LearnCon #1753 consumes the export (traversal out of scope).
 */

export const PREREQ_CATEGORY = 'prereq-graph' as const
export const PREREQ_GRAPH_SLUG = 'tyt-matematik' as const

export type PrereqExamType = 'TYT' | 'AYT' | 'LGS' | 'OKUL'

export type PrereqNodeInput = {
  code: string
  label: string
  examType: PrereqExamType
  subject: string
  unit?: string
  /** Codes that must be ready before this node (direct parents). */
  prerequisites: string[]
}

export type PrereqGraphRecord = {
  version: 1
  kind: 'prereq-graph'
  slug: string
  title: string
  nodes: PrereqNodeInput[]
}

export type PrereqSourceDraft = {
  title: string
  category: typeof PREREQ_CATEGORY
  tags: string[]
  content: string
}

/** LEARNCON #1753 / curriculum_tree_nodes.prerequisites-shaped export. */
export type LearnConPrereqExport = {
  contract: 'LEARNCON-STU-prereq'
  slug: string
  nodes: Array<{
    code: string
    label: string
    exam_type: PrereqExamType
    subject: string
    unit: string | null
    prerequisites: string[]
  }>
}

export type PrereqTreeNode = {
  code: string
  label: string
  examType: PrereqExamType
  subject: string
  unit: string | null
  children: PrereqTreeNode[]
}

function trimRequired(label: string, value: string): string {
  const v = value.trim()
  if (!v) throw new Error(`${label} gerekli`)
  return v
}

function assertCode(label: string, code: string): string {
  const v = trimRequired(label, code)
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._:-]*$/u.test(v)) {
    throw new Error(`${label} geçersiz: ${v}`)
  }
  return v
}

export function validatePrereqGraph(input: {
  slug: string
  title: string
  nodes: PrereqNodeInput[]
}): PrereqGraphRecord {
  const slug = trimRequired('slug', input.slug)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('slug yalnızca küçük harf, rakam ve tire olmalı')
  }
  const title = trimRequired('title', input.title)
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    throw new Error('en az bir node gerekli')
  }

  const byCode = new Map<string, PrereqNodeInput>()
  const nodes: PrereqNodeInput[] = []
  for (const raw of input.nodes) {
    const code = assertCode('code', raw.code)
    if (byCode.has(code)) throw new Error(`node tekrarı: ${code}`)
    const label = trimRequired(`label(${code})`, raw.label)
    const examType = raw.examType
    if (!['TYT', 'AYT', 'LGS', 'OKUL'].includes(examType)) {
      throw new Error(`examType geçersiz: ${code}`)
    }
    const subject = trimRequired(`subject(${code})`, raw.subject)
    const unit = raw.unit?.trim() || undefined
    const prerequisites = Array.isArray(raw.prerequisites)
      ? raw.prerequisites.map((p, i) => assertCode(`prerequisites[${i}](${code})`, p))
      : []
    if (prerequisites.includes(code)) {
      throw new Error(`${code} kendini önkoşul yapamaz`)
    }
    const node: PrereqNodeInput = {
      code,
      label,
      examType,
      subject,
      ...(unit ? { unit } : {}),
      prerequisites: [...new Set(prerequisites)],
    }
    byCode.set(code, node)
    nodes.push(node)
  }

  for (const node of nodes) {
    for (const p of node.prerequisites) {
      if (!byCode.has(p)) {
        throw new Error(`${node.code} önkoşulu tanımsız: ${p}`)
      }
    }
  }

  detectCycle(nodes)
  return { version: 1, kind: 'prereq-graph', slug, title, nodes }
}

function detectCycle(nodes: PrereqNodeInput[]): void {
  const adj = new Map(nodes.map((n) => [n.code, n.prerequisites]))
  const visiting = new Set<string>()
  const done = new Set<string>()

  function dfs(code: string, path: string[]): void {
    if (done.has(code)) return
    if (visiting.has(code)) {
      throw new Error(`önkoşul döngüsü: ${[...path, code].join(' → ')}`)
    }
    visiting.add(code)
    for (const p of adj.get(code) || []) {
      dfs(p, [...path, code])
    }
    visiting.delete(code)
    done.add(code)
  }

  for (const n of nodes) dfs(n.code, [])
}

export function buildPrereqSource(input: {
  slug: string
  title: string
  nodes: PrereqNodeInput[]
}): PrereqSourceDraft {
  const record = validatePrereqGraph(input)
  return {
    title: record.title,
    category: PREREQ_CATEGORY,
    tags: [`slug:${record.slug}`, 'cs-stu-02', 'prereq-graph'],
    content: JSON.stringify(record, null, 2),
  }
}

export function readPrereqGraph(content: string): PrereqGraphRecord {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('prereq content JSON değil')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('prereq content nesne değil')
  }
  const row = raw as Record<string, unknown>
  return validatePrereqGraph({
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    nodes: (Array.isArray(row.nodes) ? row.nodes : []) as PrereqNodeInput[],
  })
}

export function toLearnConPrereqExport(record: PrereqGraphRecord): LearnConPrereqExport {
  return {
    contract: 'LEARNCON-STU-prereq',
    slug: record.slug,
    nodes: record.nodes.map((n) => ({
      code: n.code,
      label: n.label,
      exam_type: n.examType,
      subject: n.subject,
      unit: n.unit ?? null,
      prerequisites: [...n.prerequisites],
    })),
  }
}

/**
 * Forest for admin tree view: roots have no inbound “is prerequisite of” from
 * nodes outside… Actually roots = nodes that are never listed as prerequisite
 * of another? Better: roots = nodes with empty prerequisites (foundations),
 * children = nodes that list parent as direct prerequisite.
 */
export function buildPrereqForest(nodes: PrereqNodeInput[]): PrereqTreeNode[] {
  const byCode = new Map(nodes.map((n) => [n.code, n]))
  const childrenOf = new Map<string, string[]>()
  for (const n of nodes) {
    for (const p of n.prerequisites) {
      const list = childrenOf.get(p) || []
      list.push(n.code)
      childrenOf.set(p, list)
    }
  }

  function toTree(code: string, stack: Set<string>): PrereqTreeNode {
    const n = byCode.get(code)!
    if (stack.has(code)) {
      return {
        code: n.code,
        label: n.label,
        examType: n.examType,
        subject: n.subject,
        unit: n.unit ?? null,
        children: [],
      }
    }
    stack.add(code)
    const kids = (childrenOf.get(code) || []).map((c) => toTree(c, stack))
    stack.delete(code)
    return {
      code: n.code,
      label: n.label,
      examType: n.examType,
      subject: n.subject,
      unit: n.unit ?? null,
      children: kids,
    }
  }

  const roots = nodes.filter((n) => n.prerequisites.length === 0)
  return roots.map((r) => toTree(r.code, new Set()))
}

/** Edge check used in tests / “vay be” example. */
export function hasPrerequisiteEdge(
  nodes: PrereqNodeInput[],
  topicCode: string,
  prerequisiteCode: string,
): boolean {
  const node = nodes.find((n) => n.code === topicCode)
  return Boolean(node?.prerequisites.includes(prerequisiteCode))
}
