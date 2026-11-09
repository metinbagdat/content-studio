'use client'

import Link from 'next/link'

const SEED_LINKS: Array<{
  href: string
  title: string
  blurb: string
  id: string
}> = [
  {
    href: '/admin/diagnostic',
    title: 'Diagnostic soru bankası',
    blurb: 'CS-STU-01 — TYT/AYT/LGS/OKUL seed + LearnCon export',
    id: 'CS-STU-01',
  },
  {
    href: '/admin/prereq',
    title: 'Önkoşul grafiği',
    blurb: 'CS-STU-02 — TYT Mat + Logaritma→Üstel tree',
    id: 'CS-STU-02',
  },
  {
    href: '/admin/parent-report',
    title: 'Örnek veli raporu',
    blurb: 'CS-PAR-01 — Ali 11. sınıf +3 net / %38',
    id: 'CS-PAR-01',
  },
  {
    href: '/admin/parent-templates',
    title: 'Veli şablonları',
    blurb: 'CS-PAR-02 — V1 IG/YT/FB + V-E1…E8',
    id: 'CS-PAR-02',
  },
  {
    href: '/admin/teacher-roster',
    title: 'Öğretmen Excel şablonu',
    blurb: 'CS-TCH-01 — TYT/AYT/LGS CSV + rehber PDF HTML',
    id: 'CS-TCH-01',
  },
  {
    href: '/admin/teacher-class-report',
    title: 'Örnek sınıf analizi',
    blurb: 'CS-TCH-02 — 30 öğrenci + veli toplantısı sayfası',
    id: 'CS-TCH-02',
  },
  {
    href: '/admin/institution-pilot',
    title: 'Kurumsal pilot rehberi',
    blurb: 'CS-INST-01 — 4 hafta plan + metrikler + PDF HTML',
    id: 'CS-INST-01',
  },
  {
    href: '/admin/institution-report',
    title: 'Örnek kurum raporu',
    blurb: 'CS-INST-02 — anonim 400 öğrenci, Logaritma %32',
    id: 'CS-INST-02',
  },
  {
    href: '/admin/growth-metrics',
    title: 'Growth OS metrik sözlüğü',
    blurb: 'CS-OS-01 — WLAS / Family WAU / Active Class / K-factor + 4 rol + 4 döngü',
    id: 'CS-OS-01',
  },
  {
    href: '/admin/growth-loops',
    title: 'Döngü içerik stratejisi',
    blurb: 'CS-OS-02 — viral / öğretmen çarpanı / öğretmen→kurum / veli→veli + zayıf halka',
    id: 'CS-OS-02',
  },
  {
    href: '/admin/growth-cross-role',
    title: 'Çapraz rol şablonları',
    blurb: 'CS-OS-03 — davet / paylaşım / referans / kurum→veli · TR+EN',
    id: 'CS-OS-03',
  },
]

export default function SeedsHubPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Seed’ler</h1>
        <p className="text-sm text-neutral-600">
          Huni içerik fabrikası — üst menüyü şişirmeden buradan seed yükleyin, CSV/HTML önizleyin,
          LearnCon export alın.
        </p>
      </header>

      <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
        {SEED_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-neutral-50"
            >
              <div>
                <div className="font-medium text-neutral-900">{item.title}</div>
                <div className="mt-1 text-sm text-neutral-600">{item.blurb}</div>
              </div>
              <span className="shrink-0 font-mono text-xs text-neutral-400">{item.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
