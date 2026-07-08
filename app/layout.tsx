import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Comment Exporter — Private',
  description: 'Documentation for the Comment Exporter research tool. Registered access only.',
  robots: { index: false, follow: false }, // don't index a private tool page
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
