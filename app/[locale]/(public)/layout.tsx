import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        // Base bianca del sito pubblico: le sezioni colorate (pub-hero,
        // pub-surface, pub-ink) sono scelte esplicite delle singole pagine.
        backgroundColor: '#fff',
      }}
    >
      <PublicHeader locale={locale} />
      <main style={{ flex: 1 }}>{children}</main>
      <PublicFooter locale={locale} />
    </div>
  );
}
