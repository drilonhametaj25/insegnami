import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { appTheme } from '@/lib/theme';
import { AnalyticsScript } from '@/components/public/AnalyticsScript';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

export const metadata = {
  title: {
    default: 'InsegnaMi.pro — Registro Elettronico e Gestione Scolastica',
    template: '%s | InsegnaMi.pro',
  },
  description:
    'Piattaforma all-in-one per scuole private, accademie e centri di formazione. Registro elettronico, gestione studenti, presenze digitali, pagamenti e comunicazioni.',
  keywords: [
    'registro elettronico',
    'gestione scolastica',
    'software scuola',
    'scuole private',
    'presenze digitali',
  ],
  authors: [{ name: 'InsegnaMi.pro Team' }],
  metadataBase: new URL('https://insegnami.pro'),
  openGraph: {
    title: 'InsegnaMi.pro — Registro Elettronico e Gestione Scolastica',
    description:
      'Piattaforma all-in-one per scuole private. Registro elettronico, presenze, pagamenti e comunicazioni.',
    type: 'website',
    siteName: 'InsegnaMi.pro',
    locale: 'it_IT',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InsegnaMi.pro — Registro Elettronico e Gestione Scolastica',
    description:
      'Piattaforma all-in-one per scuole private. Registro elettronico, presenze, pagamenti e comunicazioni.',
  },
  // ATTENZIONE: niente `alternates` qui. Il merge shallow dei metadata Next
  // farebbe ereditare canonical '/' a OGNI pagina che non lo ridefinisce,
  // deindicizzando blog/tool/pricing come duplicati della homepage.
  // Ogni pagina pubblica dichiara i propri alternates via lib/seo.ts.
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0ea5e9',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
        {/* Sincrono, prima dell'idratazione: <html lang> deve riflettere il
            locale del path (it|en|fr|pt). app/layout.tsx resta l'owner di
            <html> ma non conosce il segmento [locale] lato server. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=location.pathname.match(/^\\/(it|en|fr|pt)(?=\\/|$)/);document.documentElement.lang=(m&&m[1])||'it';}catch(e){}})();",
          }}
        />
        <AnalyticsScript />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <MantineProvider theme={appTheme} defaultColorScheme="light">
          <Notifications />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
