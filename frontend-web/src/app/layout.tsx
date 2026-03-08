import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Birøkt - Digitalt styringssystem for birøktere',
  description: 'Administrer dine bigårder, kuber og inspeksjoner med Birøkt',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body className="app-shell">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

