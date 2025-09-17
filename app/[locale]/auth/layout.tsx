import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Accesso - InsegnaMi.pro',
  description: 'Accedi alla piattaforma di gestione scolastica moderna InsegnaMi.pro',
  keywords: 'scuola, gestione, accesso, login, insegnami',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#667eea',
  colorScheme: 'light',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ 
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {children}
    </div>
  );
}
