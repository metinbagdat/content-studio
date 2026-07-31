import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Content Studio · egitim.today',
  description: 'Content auto-production & social distribution for egitim.today',
}

const NAV = [
  { href: '/admin', label: 'Pipeline' },
  { href: '/admin/review', label: 'Onay' },
  { href: '/admin/media', label: 'Medya' },
  { href: '/admin/social', label: 'Sosyal' },
  { href: '/admin/calendar', label: 'Takvim' },
  { href: '/admin/discovery', label: 'Discovery' },
  { href: '/docs/social-setup', label: 'SM rehber', muted: true },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            <span className="brand-mark" aria-hidden />
            Content Studio
          </a>
          <nav>
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className={item.muted ? 'muted' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  )
}
