import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://gravity-front.jimpeng.chatgpt.site'),
  title: 'Gravity Front — U.C. 0079',
  description:
    'A browser-based Universal Century mobile-suit combat simulator with campaign, custom battles, and direct peer-to-peer PvP.',
  openGraph: {
    title: 'Gravity Front — U.C. 0079',
    description:
      'A browser-based mobile-suit combat simulator with campaign, custom battles, and direct peer-to-peer PvP.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gravity Front — U.C. 0079',
    description:
      'A browser-based mobile-suit combat simulator with campaign, custom battles, and direct peer-to-peer PvP.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
