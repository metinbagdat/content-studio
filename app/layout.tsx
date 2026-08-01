import type { Metadata } from 'next'
import './globals.css'
import { ThemeToggle, themeInitScript } from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'Content Studio · egitim.today',
  description: 'Content auto-production & social distribution for egitim.today',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <header className="topbar">
          <a href="/admin" className="brand">
            <span className="brand-mark" aria-hidden />
            Content Studio
          </a>
          <nav>
            <a href="/admin">Admin</a>
            <a href="/docs/social-setup" className="muted">SM rehber</a>
            <ThemeToggle />
          </nav>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  )
}
