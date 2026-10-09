import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'NeuroFlow — Next-Gen Automation Platform',
  description: 'Self-hosted visual workflow automation platform with engine and AI agents support',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased bg-[#090A0F] text-[#F8FAFC]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
