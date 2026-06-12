import { Metadata } from 'next';
import {
  Badge,
  Box,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconArrowRight,
  IconBuilding,
  IconHeadset,
  IconMapPin,
} from '@tabler/icons-react';
import Link from 'next/link';
import { regioni, province } from '@/data/italia';
import { CtaBanner, PUB_GRADIENT, SectionHeader } from '@/components/public/PublicUI';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: 'Software Gestione Scuola per Città',
    description:
      'Trova il miglior software gestionale per scuole nella tua città. InsegnaMi.pro è disponibile in tutte le regioni italiane con supporto locale.',
    openGraph: {
      title: 'Software Gestione Scuola per Città | InsegnaMi.pro',
      description:
        'Trova il miglior software gestionale per scuole nella tua città. InsegnaMi.pro è disponibile in tutte le regioni italiane.',
      type: 'website',
    },
    alternates: {
      canonical: `https://insegnami.pro/${locale}/citta`,
    },
  };
}

// Punti di forza mostrati nell'hero: claim qualitativi, non numerici
const heroStats = [
  { icon: IconBuilding, label: 'Tutte le 20 regioni' },
  { icon: IconMapPin, label: 'Presenza in tutta Italia' },
  { icon: IconHeadset, label: 'Supporto in italiano' },
];

export default async function CittaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Conteggio province per regione
  const provinceCount = regioni.map((regione) => ({
    ...regione,
    provinceCount: province.filter((p) => p.regione === regione.codice).length,
  }));

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Software Gestione Scuola per Città',
    description:
      'Trova il miglior software gestionale per scuole nella tua città italiana.',
    publisher: {
      '@type': 'Organization',
      name: 'InsegnaMi.pro',
      url: 'https://insegnami.pro',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `https://insegnami.pro/${locale}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Città',
          item: `https://insegnami.pro/${locale}/citta`,
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <Box className="pub-hero" py={{ base: 40, sm: 56 }}>
        <Container size="xl">
          <Group gap="lg" wrap="nowrap" align="flex-start">
            <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
              <IconMapPin size={34} />
            </ThemeIcon>
            <Box>
              <Badge size="lg" variant="light" color="indigo" radius="xl" mb="sm">
                Copertura nazionale
              </Badge>
              <Title fz={{ base: rem(32), sm: rem(40) }} fw={900} lh={1.12} c="var(--pub-ink)" mb={8}>
                Software Gestione Scuola nella Tua Città
              </Title>
              <Text size="lg" c="dimmed" maw={640}>
                InsegnaMi.pro è il gestionale per le scuole italiane. Disponibile in tutte le 20
                regioni con supporto locale dedicato.
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="xl" maw={640}>
                {heroStats.map((stat) => (
                  <Group key={stat.label} gap="sm" wrap="nowrap">
                    <ThemeIcon size={36} radius="md" variant="light" color="indigo">
                      <stat.icon size={20} />
                    </ThemeIcon>
                    <Text size="sm" fw={600} c="var(--pub-ink)">
                      {stat.label}
                    </Text>
                  </Group>
                ))}
              </SimpleGrid>
            </Box>
          </Group>
        </Container>
      </Box>

      {/* Griglia regioni */}
      <Box bg="white" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SectionHeader
            title="Scegli la"
            highlight="Tua Regione"
            subtitle="Seleziona la tua regione per trovare informazioni sul software gestionale InsegnaMi.pro nella tua zona. Offriamo supporto dedicato e conformità alle normative locali per tutte le scuole italiane."
          />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg">
            {provinceCount.map((regione) => (
              <Card
                key={regione.codice}
                component={Link}
                href={`/${locale}/citta/${regione.slug}`}
                padding="xl"
                radius="lg"
                className="pub-card"
                h="100%"
                style={{ textDecoration: 'none' }}
              >
                <Stack gap="sm" h="100%">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                      {regione.nome}
                    </Title>
                    {regione.provinceCount > 0 ? (
                      <Badge color="indigo" variant="light" radius="xl" style={{ flexShrink: 0 }}>
                        {regione.provinceCount}{' '}
                        {regione.provinceCount === 1 ? 'provincia' : 'province'}
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light" radius="xl" style={{ flexShrink: 0 }}>
                        In arrivo
                      </Badge>
                    )}
                  </Group>
                  <Text size="sm" c="dimmed">
                    Software gestionale per scuole in {regione.nome}
                  </Text>
                  <Group justify="flex-end" mt="auto">
                    <IconArrowRight size={18} color="var(--mantine-color-indigo-6)" />
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Contenuto SEO */}
      <Box bg="var(--pub-surface)" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SectionHeader
            title="Perché Scegliere InsegnaMi.pro"
            highlight="per la Tua Scuola?"
          />
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {[
              {
                title: 'Supporto Locale',
                text: 'Il nostro team di supporto conosce le specificità di ogni regione italiana. Offriamo assistenza in italiano con conoscenza delle normative locali.',
              },
              {
                title: 'Conformità Normativa',
                text: 'InsegnaMi.pro è conforme a tutte le normative italiane sulla privacy (GDPR) e sulla gestione scolastica, incluse le direttive regionali.',
              },
              {
                title: 'Integrazione con Enti Locali',
                text: 'Il nostro software si integra con i sistemi degli enti locali per comunicazioni, rendicontazioni e adempimenti burocratici.',
              },
              {
                title: 'Prezzi Competitivi',
                text: 'Offriamo piani flessibili adatti a scuole di ogni dimensione, dalle piccole accademie ai grandi istituti.',
              },
            ].map((item) => (
              <Card key={item.title} padding="xl" radius="lg" withBorder bg="white">
                <Title order={4} fz={rem(20)} fw={700} c="var(--pub-ink)" mb="xs">
                  {item.title}
                </Title>
                <Text c="dimmed" lh={1.6}>
                  {item.text}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title="Prova InsegnaMi.pro Gratuitamente"
        subtitle="Inizia oggi la tua prova gratuita di 14 giorni. Nessuna carta di credito richiesta, supporto incluso."
      />
    </>
  );
}
