import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '메이즈랜드 대시보드',
  description: '메이즈랜드 정산/마케팅 통합 대시보드',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}



