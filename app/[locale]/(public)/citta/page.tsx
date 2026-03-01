import { Metadata } from 'next';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Stack,
  Badge,
  Group,
  Anchor,
  ThemeIcon,
  Box,
} from '@mantine/core';
import { IconMapPin, IconBuilding, IconSchool } from '@tabler/icons-react';
import Link from 'next/link';
import { regioni, province } from '@/data/italia';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: 'Software Gestione Scuola per Città | InsegnaMi.pro',
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

export default async function CittaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Count provinces per region
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

      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-cyan-5) 100%)',
          color: 'white',
          padding: '4rem 0',
        }}
      >
        <Container size="xl">
          <Stack align="center" gap="lg">
            <ThemeIcon size={80} radius="xl" variant="white" color="blue">
              <IconMapPin size={40} />
            </ThemeIcon>
            <Title order={1} ta="center">
              Software Gestione Scuola nella Tua Città
            </Title>
            <Text size="xl" ta="center" maw={700}>
              InsegnaMi.pro è il software gestionale scolastico #1 in Italia.
              Disponibile in tutte le 20 regioni con supporto locale dedicato.
            </Text>
            <Group gap="xl">
              <Group gap={6}>
                <IconBuilding size={20} />
                <Text fw={500}>20 Regioni</Text>
              </Group>
              <Group gap={6}>
                <IconMapPin size={20} />
                <Text fw={500}>107 Province</Text>
              </Group>
              <Group gap={6}>
                <IconSchool size={20} />
                <Text fw={500}>7.900+ Comuni</Text>
              </Group>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Introduction */}
          <Box ta="center" maw={800} mx="auto">
            <Title order={2} mb="md">
              Scegli la Tua Regione
            </Title>
            <Text size="lg" c="dimmed">
              Seleziona la tua regione per trovare informazioni sul software gestionale
              InsegnaMi.pro nella tua zona. Offriamo supporto dedicato e conformità
              alle normative locali per tutte le scuole italiane.
            </Text>
          </Box>

          {/* Regions Grid */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {provinceCount.map((regione) => (
              <Card
                key={regione.codice}
                component={Link}
                href={`/${locale}/citta/${regione.slug}`}
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ textDecoration: 'none' }}
              >
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={3} size="h4">
                      {regione.nome}
                    </Title>
                    <Badge color="blue" variant="light">
                      {regione.provinceCount} province
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Software gestionale per scuole in {regione.nome}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          {/* SEO Content */}
          <Box mt="xl" p="xl" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Title order={2} mb="md">
              Perché Scegliere InsegnaMi.pro per la Tua Scuola?
            </Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Stack gap="sm">
                <Title order={4}>Supporto Locale</Title>
                <Text c="dimmed">
                  Il nostro team di supporto conosce le specificità di ogni regione italiana.
                  Offriamo assistenza in italiano con conoscenza delle normative locali.
                </Text>
              </Stack>
              <Stack gap="sm">
                <Title order={4}>Conformità Normativa</Title>
                <Text c="dimmed">
                  InsegnaMi.pro è conforme a tutte le normative italiane sulla privacy (GDPR)
                  e sulla gestione scolastica, incluse le direttive regionali.
                </Text>
              </Stack>
              <Stack gap="sm">
                <Title order={4}>Integrazione con Enti Locali</Title>
                <Text c="dimmed">
                  Il nostro software si integra con i sistemi degli enti locali per
                  comunicazioni, rendicontazioni e adempimenti burocratici.
                </Text>
              </Stack>
              <Stack gap="sm">
                <Title order={4}>Prezzi Competitivi</Title>
                <Text c="dimmed">
                  Offriamo piani flessibili adatti a scuole di ogni dimensione,
                  dalle piccole accademie ai grandi istituti.
                </Text>
              </Stack>
            </SimpleGrid>
          </Box>

          {/* CTA */}
          <Card withBorder p="xl" radius="md" bg="blue.0" ta="center">
            <Stack align="center" gap="md">
              <Title order={3}>Prova InsegnaMi.pro Gratuitamente</Title>
              <Text c="dimmed" maw={500}>
                Inizia oggi la tua prova gratuita di 14 giorni. Nessuna carta di credito
                richiesta, supporto incluso.
              </Text>
              <Anchor
                component={Link}
                href="/auth/register"
                style={{
                  backgroundColor: 'var(--mantine-color-blue-6)',
                  color: 'white',
                  padding: '0.75rem 2rem',
                  borderRadius: 'var(--mantine-radius-md)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Inizia la Prova Gratuita
              </Anchor>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </>
  );
}
