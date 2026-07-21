import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Content Studio · egitim.today',
  description: 'Content auto-production & social distribution for egitim.today',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            Content Studio
          </a>
          <nav>
            <a href="/admin">Pipeline</a>
            <a href="/admin/review">Onay</a>
            <a href="/admin/social">Sosyal</a>
            <a href="/admin/calendar">Takvim</a>
            <a href="/docs/social-setup" className="muted">SM rehber</a>
          </nav>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  )
}
