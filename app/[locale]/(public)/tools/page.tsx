import { Metadata } from 'next';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Stack,
  Group,
  ThemeIcon,
  Box,
  rem,
} from '@mantine/core';
import {
  IconCalculator,
  IconCalendar,
  IconClipboardCheck,
  IconFileText,
  IconClock,
  IconCurrencyEuro,
  IconId,
  IconTable,
} from '@tabler/icons-react';
import Link from 'next/link';
import { CtaBanner, PageHero } from '@/components/public/PublicUI';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: 'Strumenti Gratuiti per Scuole',
    description:
      'Strumenti gratuiti per la gestione scolastica: calcolatori, generatori e validatori. Calcola medie voti, presenze, costi e molto altro.',
    keywords: [
      'strumenti scuola gratuiti',
      'calcolatore media voti',
      'calcolatore presenze',
      'generatore calendario scolastico',
      'validatore codice fiscale',
    ],
    openGraph: {
      title: 'Strumenti Gratuiti per Scuole | InsegnaMi.pro',
      description:
        'Strumenti gratuiti per la gestione scolastica: calcolatori, generatori e validatori.',
      type: 'website',
    },
  };
}

const tools = [
  {
    slug: 'calcolatore-media-voti',
    title: 'Calcolatore Media Voti',
    description: 'Calcola la media dei voti con pesi personalizzati per materia o tipologia di verifica.',
    icon: IconCalculator,
    category: 'Calcolatori',
  },
  {
    slug: 'calcolatore-presenze',
    title: 'Calcolatore Presenze',
    description: 'Calcola la percentuale di frequenza e verifica il raggiungimento del monte ore minimo.',
    icon: IconClipboardCheck,
    category: 'Calcolatori',
  },
  {
    slug: 'calcolatore-costo-studente',
    title: 'Calcolatore Costo per Studente',
    description: 'Calcola il costo effettivo per studente considerando tutte le spese della scuola.',
    icon: IconCurrencyEuro,
    category: 'Calcolatori',
  },
  {
    slug: 'validatore-codice-fiscale',
    title: 'Validatore Codice Fiscale',
    description: 'Verifica la correttezza di un codice fiscale ed estrai le informazioni anagrafiche.',
    icon: IconId,
    category: 'Validatori',
  },
  {
    slug: 'generatore-calendario-scolastico',
    title: 'Generatore Calendario Scolastico',
    description: 'Genera un calendario scolastico personalizzato con festività e periodi di vacanza.',
    icon: IconCalendar,
    category: 'Generatori',
  },
  {
    slug: 'generatore-orario-settimanale',
    title: 'Generatore Orario Settimanale',
    description: 'Crea un orario settimanale delle lezioni da stampare o esportare.',
    icon: IconTable,
    category: 'Generatori',
  },
  {
    slug: 'calcolatore-ore-corso',
    title: 'Calcolatore Ore Corso',
    description: 'Calcola il totale delle ore di un corso e pianifica le lezioni necessarie.',
    icon: IconClock,
    category: 'Calcolatori',
  },
  {
    slug: 'generatore-comunicazioni',
    title: 'Generatore Comunicazioni',
    description: 'Genera template per comunicazioni ai genitori, circolari e avvisi.',
    icon: IconFileText,
    category: 'Generatori',
  },
];

const categories = ['Calcolatori', 'Generatori', 'Validatori'];

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Strumenti Gratuiti per Scuole',
    description: 'Strumenti gratuiti per la gestione scolastica: calcolatori, generatori e validatori.',
    publisher: {
      '@type': 'Organization',
      name: 'InsegnaMi.pro',
      url: 'https://insegnami.pro',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: tools.map((tool, index) => ({
        '@type': 'SoftwareApplication',
        position: index + 1,
        name: tool.title,
        description: tool.description,
        applicationCategory: 'EducationalApplication',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <PageHero
        badge="100% gratuiti"
        title="Strumenti gratuiti"
        highlight="per la tua scuola"
        subtitle="Calcolatori, generatori e validatori pensati per semplificare la gestione quotidiana della tua scuola. Nessuna registrazione richiesta."
      />

      {/* Strumenti per categoria */}
      <Container size="xl" py={{ base: 32, sm: 48 }}>
        <Stack gap={48}>
          {categories.map((category) => {
            const categoryTools = tools.filter((t) => t.category === category);
            if (categoryTools.length === 0) return null;

            return (
              <Box key={category}>
                <Group align="baseline" gap="sm" mb="lg">
                  <Title order={2} fz={rem(24)} fw={800} c="var(--pub-ink)">
                    {category}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {categoryTools.length}{' '}
                    {categoryTools.length === 1 ? 'strumento' : 'strumenti'}
                  </Text>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                  {categoryTools.map((tool) => (
                    <Card
                      key={tool.slug}
                      component={Link}
                      href={`/${locale}/tools/${tool.slug}`}
                      padding="xl"
                      radius="lg"
                      bg="white"
                      className="pub-card"
                      h="100%"
                      style={{ textDecoration: 'none' }}
                    >
                      <ThemeIcon size={52} radius="md" variant="light" color="indigo" mb="md">
                        <tool.icon size={28} />
                      </ThemeIcon>
                      <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)" mb={6}>
                        {tool.title}
                      </Title>
                      <Text size="sm" c="dimmed" lh={1.6}>
                        {tool.description}
                      </Text>
                    </Card>
                  ))}
                </SimpleGrid>
              </Box>
            );
          })}
        </Stack>
      </Container>

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title="Vuoi Automatizzare Tutto Questo?"
        subtitle="Con InsegnaMi.pro puoi gestire automaticamente voti, presenze, pagamenti e comunicazioni. Tutti questi strumenti integrati in un'unica piattaforma."
      />
    </>
  );
}
