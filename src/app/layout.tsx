import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MatterGuide AI — Vos visites Matterport deviennent des agents immobiliers',
  icons: { icon: '/favicon.svg' },
  description:
    "Agent vocal IA pour visites virtuelles Matterport : visite guidée, réponses sur documents, qualification des acquéreurs et CRM intégré.",
};

/**
 * Fonts chargées au runtime (link Google Fonts) plutôt que via next/font :
 * le build reste possible sans accès réseau (Docker/CI restreints) et les
 * fallbacks système assurent un rendu correct hors ligne.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Instrument+Sans:wght@400..700&family=Spline+Sans+Mono:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
