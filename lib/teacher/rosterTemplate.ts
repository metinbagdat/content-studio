/**
 * CS-TCH-01 — class roster Excel (CSV) templates + filled sample.
 * TYT / AYT / LGS column variants. Segment: egitimci.
 */

export const TEACHER_ROSTER_CATEGORY = 'teacher-roster-template' as const
export const TEACHER_ROSTER_SLUG = 'w3-excel-tyt-ayt-lgs' as const
export const TEACHER_SEGMENT = 'egitimci' as const

export type ExamVariant = 'TYT' | 'AYT' | 'LGS'

export type RosterColumn = {
  key: string
  header: string
  required: boolean
  note?: string
}

export type RosterRow = Record<string, string | number>

export type RosterTemplatePack = {
  version: 1
  kind: 'teacher-roster-template'
  slug: string
  segment: typeof TEACHER_SEGMENT
  columnsByExam: Record<ExamVariant, RosterColumn[]>
  blankCsvByExam: Record<ExamVariant, string>
  sampleCsvByExam: Record<ExamVariant, string>
  sampleMeta: {
    classLabel: string
    exam: ExamVariant
    studentCount: number
  }
}

const SHARED_COLUMNS: RosterColumn[] = [
  { key: 'student_no', header: 'Öğrenci No', required: true },
  { key: 'display_name', header: 'Ad Soyad', required: true },
  { key: 'grade', header: 'Sınıf', required: true, note: 'Örn. 11' },
]

const TYT_EXTRA: RosterColumn[] = [
  { key: 'exam_variant', header: 'Sınav', required: true, note: 'TYT' },
  { key: 'subject', header: 'Ders', required: true, note: 'Matematik' },
  { key: 'topic_code', header: 'Konu Kodu', required: false, note: 'tyt_mat_uslu_koklu' },
  { key: 'net', header: 'Net', required: true },
  { key: 'correct_pct', header: 'Doğruluk %', required: false },
  { key: 'session_date', header: 'Tarih', required: true, note: 'YYYY-MM-DD' },
]

const AYT_EXTRA: RosterColumn[] = [
  { key: 'exam_variant', header: 'Sınav', required: true, note: 'AYT' },
  { key: 'subject', header: 'Ders', required: true, note: 'Matematik' },
  { key: 'topic_code', header: 'Kazanım Kodu', required: false, note: '12.1.2.1.' },
  { key: 'net', header: 'Net', required: true },
  { key: 'correct_pct', header: 'Doğruluk %', required: false },
  { key: 'session_date', header: 'Tarih', required: true, note: 'YYYY-MM-DD' },
]

const LGS_EXTRA: RosterColumn[] = [
  { key: 'exam_variant', header: 'Sınav', required: true, note: 'LGS' },
  { key: 'subject', header: 'Ders', required: true, note: 'İnkılap / Matematik' },
  { key: 'topic_code', header: 'Kazanım Kodu', required: false, note: 'İTA.8.1.1.' },
  { key: 'score', header: 'Puan', required: true },
  { key: 'correct_pct', header: 'Doğruluk %', required: false },
  { key: 'session_date', header: 'Tarih', required: true, note: 'YYYY-MM-DD' },
]

export const COLUMNS_BY_EXAM: Record<ExamVariant, RosterColumn[]> = {
  TYT: [...SHARED_COLUMNS, ...TYT_EXTRA],
  AYT: [...SHARED_COLUMNS, ...AYT_EXTRA],
  LGS: [...SHARED_COLUMNS, ...LGS_EXTRA],
}

function csvEscape(value: string | number): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCsv(columns: RosterColumn[], rows: RosterRow[]): string {
  const header = columns.map((c) => csvEscape(c.header)).join(',')
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c.key] ?? '')).join(',')).join('\n')
  // BOM so Excel opens Turkish characters correctly
  return `\uFEFF${header}\n${body}\n`
}

export function blankCsv(exam: ExamVariant): string {
  return rowsToCsv(COLUMNS_BY_EXAM[exam], [])
}

/** Filled sample — TYT Matematik mini sınıf (gerçekçi dağılım). */
export const TYT_SAMPLE_ROWS: RosterRow[] = [
  {
    student_no: 1,
    display_name: 'Ayşe K.',
    grade: 11,
    exam_variant: 'TYT',
    subject: 'Matematik',
    topic_code: 'tyt_mat_uslu_koklu',
    net: 12.25,
    correct_pct: 72,
    session_date: '2026-10-20',
  },
  {
    student_no: 2,
    display_name: 'Berk T.',
    grade: 11,
    exam_variant: 'TYT',
    subject: 'Matematik',
    topic_code: 'tyt_mat_denklemler',
    net: 9.5,
    correct_pct: 58,
    session_date: '2026-10-20',
  },
  {
    student_no: 3,
    display_name: 'Cemre Y.',
    grade: 11,
    exam_variant: 'TYT',
    subject: 'Matematik',
    topic_code: 'tyt_mat_fonksiyonlar',
    net: 14.0,
    correct_pct: 81,
    session_date: '2026-10-20',
  },
  {
    student_no: 4,
    display_name: 'Deniz A.',
    grade: 11,
    exam_variant: 'TYT',
    subject: 'Matematik',
    topic_code: 'tyt_mat_uslu_koklu',
    net: 7.75,
    correct_pct: 44,
    session_date: '2026-10-20',
  },
  {
    student_no: 5,
    display_name: 'Efe S.',
    grade: 11,
    exam_variant: 'TYT',
    subject: 'Matematik',
    topic_code: 'tyt_mat_rasyonel',
    net: 11.0,
    correct_pct: 66,
    session_date: '2026-10-20',
  },
]

export const AYT_SAMPLE_ROWS: RosterRow[] = [
  {
    student_no: 1,
    display_name: 'Ayşe K.',
    grade: 12,
    exam_variant: 'AYT',
    subject: 'Matematik',
    topic_code: '12.1.1.1.',
    net: 8.5,
    correct_pct: 61,
    session_date: '2026-10-21',
  },
  {
    student_no: 2,
    display_name: 'Berk T.',
    grade: 12,
    exam_variant: 'AYT',
    subject: 'Matematik',
    topic_code: '12.1.2.1.',
    net: 5.25,
    correct_pct: 39,
    session_date: '2026-10-21',
  },
]

export const LGS_SAMPLE_ROWS: RosterRow[] = [
  {
    student_no: 1,
    display_name: 'Mert D.',
    grade: 8,
    exam_variant: 'LGS',
    subject: 'İnkılap',
    topic_code: 'İTA.8.1.1.',
    score: 78,
    correct_pct: 78,
    session_date: '2026-10-18',
  },
  {
    student_no: 2,
    display_name: 'Zeynep B.',
    grade: 8,
    exam_variant: 'LGS',
    subject: 'İnkılap',
    topic_code: 'İTA.8.2.1.',
    score: 85,
    correct_pct: 85,
    session_date: '2026-10-18',
  },
]

export function buildRosterTemplatePack(): RosterTemplatePack {
  return {
    version: 1,
    kind: 'teacher-roster-template',
    slug: TEACHER_ROSTER_SLUG,
    segment: TEACHER_SEGMENT,
    columnsByExam: COLUMNS_BY_EXAM,
    blankCsvByExam: {
      TYT: blankCsv('TYT'),
      AYT: blankCsv('AYT'),
      LGS: blankCsv('LGS'),
    },
    sampleCsvByExam: {
      TYT: rowsToCsv(COLUMNS_BY_EXAM.TYT, TYT_SAMPLE_ROWS),
      AYT: rowsToCsv(COLUMNS_BY_EXAM.AYT, AYT_SAMPLE_ROWS),
      LGS: rowsToCsv(COLUMNS_BY_EXAM.LGS, LGS_SAMPLE_ROWS),
    },
    sampleMeta: {
      classLabel: '11-A TYT Matematik örnek',
      exam: 'TYT',
      studentCount: TYT_SAMPLE_ROWS.length,
    },
  }
}

export type RosterSourceDraft = {
  title: string
  category: typeof TEACHER_ROSTER_CATEGORY
  tags: string[]
  content: string
}

export function validateRosterTemplatePack(raw: unknown): RosterTemplatePack {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('pack nesne olmalı')
  }
  const row = raw as RosterTemplatePack
  if (row.kind !== 'teacher-roster-template') throw new Error('kind geçersiz')
  if (row.segment !== 'egitimci') throw new Error('segment egitimci olmalı')
  for (const exam of ['TYT', 'AYT', 'LGS'] as ExamVariant[]) {
    if (!row.columnsByExam?.[exam]?.length) throw new Error(`${exam} sütunları eksik`)
    if (!row.blankCsvByExam?.[exam]?.includes('Öğrenci No')) {
      throw new Error(`${exam} boş CSV eksik`)
    }
    if (!row.sampleCsvByExam?.[exam]?.includes('Öğrenci No')) {
      throw new Error(`${exam} örnek CSV eksik`)
    }
  }
  return row
}

export function buildRosterTemplateSource(
  pack: RosterTemplatePack = buildRosterTemplatePack(),
): RosterSourceDraft {
  const validated = validateRosterTemplatePack(pack)
  return {
    title: 'Öğretmen Excel şablonu — TYT/AYT/LGS',
    category: TEACHER_ROSTER_CATEGORY,
    tags: [
      `slug:${validated.slug}`,
      'cs-tch-01',
      'teacher-roster-template',
      `segment:${validated.segment}`,
      'egitimci',
    ],
    content: JSON.stringify(validated, null, 2),
  }
}

export function readRosterTemplatePack(content: string): RosterTemplatePack {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('roster template JSON değil')
  }
  return validateRosterTemplatePack(raw)
}

export type LearnConRosterExport = {
  contract: 'LEARNCON-TCH-W3'
  pack: RosterTemplatePack
}

export function toLearnConRosterExport(
  pack: RosterTemplatePack = buildRosterTemplatePack(),
): LearnConRosterExport {
  return { contract: 'LEARNCON-TCH-W3', pack: validateRosterTemplatePack(pack) }
}
