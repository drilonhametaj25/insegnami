import { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
  Breadcrumbs,
  Box,
  ThemeIcon,
} from '@mantine/core';
import { IconMapPin, IconBuilding, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import {
  regioni,
  getRegione,
  getProvinceByRegione,
  comuni,
} from '@/data/italia';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; regione: string }[] = [];

  for (const locale of locales) {
    for (const regione of regioni) {
      params.push({ locale, regione: regione.slug });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; regione: string }>;
}): Promise<Metadata> {
  const { locale, regione: regioneSlug } = await params;
  const regione = getRegione(regioneSlug);

  if (!regione) {
    return { title: 'Regione non trovata | InsegnaMi.pro' };
  }

  return {
    title: `Software Gestione Scuola in ${regione.nome} | InsegnaMi.pro`,
    description: `InsegnaMi.pro è il software gestionale scolastico #1 in ${regione.nome}. Gestisci studenti, docenti, pagamenti e molto altro. Provalo gratis!`,
    openGraph: {
      title: `Software Gestione Scuola in ${regione.nome} | InsegnaMi.pro`,
      description: `Il miglior software gestionale per scuole in ${regione.nome}. Supporto locale e conformità normative italiane.`,
      type: 'website',
    },
    alternates: {
      canonical: `https://insegnami.pro/${locale}/citta/${regioneSlug}`,
    },
  };
}

export default async function RegionePage({
  params,
}: {
  params: Promise<{ locale: string; regione: string }>;
}) {
  const { locale, regione: regioneSlug } = await params;
  const regione = getRegione(regioneSlug);

  if (!regione) {
    notFound();
  }

  const province = getProvinceByRegione(regioneSlug);

  // Count comuni per province
  const provinceWithCounts = province.map((prov) => ({
    ...prov,
    comuniCount: comuni.filter((c) => c.provincia === prov.codice).length,
  }));

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Software Gestione Scuola in ${regione.nome}`,
    description: `InsegnaMi.pro è il software gestionale scolastico #1 in ${regione.nome}.`,
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
        {
          '@type': 'ListItem',
          position: 3,
          name: regione.nome,
          item: `https://insegnami.pro/${locale}/citta/${regioneSlug}`,
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
          padding: '3rem 0',
        }}
      >
        <Container size="xl">
          <Stack gap="md">
            <Breadcrumbs
              styles={{
                breadcrumb: { color: 'rgba(255,255,255,0.8)' },
                separator: { color: 'rgba(255,255,255,0.5)' },
              }}
            >
              <Anchor component={Link} href={`/${locale}`} c="white">
                Home
              </Anchor>
              <Anchor component={Link} href={`/${locale}/citta`} c="white">
                Città
              </Anchor>
              <Text c="white">{regione.nome}</Text>
            </Breadcrumbs>

            <Group gap="lg" align="center">
              <ThemeIcon size={60} radius="xl" variant="white" color="blue">
                <IconMapPin size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>
                  Software Gestione Scuola in {regione.nome}
                </Title>
                <Text size="lg" mt="xs">
                  {province.length} province servite dal nostro software gestionale
                </Text>
              </div>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Back link */}
          <Anchor component={Link} href={`/${locale}/citta`} size="sm">
            <Group gap={4}>
              <IconArrowLeft size={16} />
              Tutte le regioni
            </Group>
          </Anchor>

          {/* Introduction */}
          <Box>
            <Title order={2} mb="md">
              Province in {regione.nome}
            </Title>
            <Text size="lg" c="dimmed" maw={800}>
              InsegnaMi.pro è disponibile in tutte le province della regione {regione.nome}.
              Seleziona la tua provincia per trovare scuole e informazioni nella tua zona.
            </Text>
          </Box>

          {/* Provinces Grid */}
          {provinceWithCounts.length > 0 ? (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {provinceWithCounts.map((prov) => (
                <Card
                  key={prov.codice}
                  component={Link}
                  href={`/${locale}/citta/${regioneSlug}/${prov.slug}`}
                  shadow="sm"
                  padding="lg"
                  radius="md"
                  withBorder
                  style={{ textDecoration: 'none' }}
                >
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconBuilding size={20} color="var(--mantine-color-blue-6)" />
                        <Title order={3} size="h4">
                          {prov.nome}
                        </Title>
                      </Group>
                      <Badge color="gray" variant="light">
                        {prov.sigla}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      Software gestionale per scuole in provincia di {prov.nome}
                    </Text>
                    {prov.comuniCount > 0 && (
                      <Badge color="blue" variant="light" size="sm">
                        {prov.comuniCount} comuni
                      </Badge>
                    )}
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Card withBorder p="xl" radius="md" ta="center">
              <Text c="dimmed">
                Dati delle province in arrivo. Contattaci per informazioni sulla tua zona.
              </Text>
            </Card>
          )}

          {/* SEO Content */}
          <Box mt="xl" p="xl" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Title order={2} mb="md">
              InsegnaMi.pro in {regione.nome}
            </Title>
            <Text mb="md">
              InsegnaMi.pro è il software gestionale scolastico leader in {regione.nome}.
              Offriamo una soluzione completa per la gestione di scuole private, accademie
              musicali, scuole di danza, centri di formazione e istituti educativi di ogni tipo.
            </Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
              <Stack gap="sm">
                <Title order={4}>Funzionalità Principali</Title>
                <Text size="sm" c="dimmed">
                  • Gestione studenti e iscrizioni<br />
                  • Registro presenze digitale<br />
                  • Gestione docenti e orari<br />
                  • Fatturazione e pagamenti<br />
                  • Comunicazioni con famiglie
                </Text>
              </Stack>
              <Stack gap="sm">
                <Title order={4}>Vantaggi per le Scuole in {regione.nome}</Title>
                <Text size="sm" c="dimmed">
                  • Supporto in italiano dedicato<br />
                  • Conformità GDPR e normative italiane<br />
                  • Interfaccia semplice e intuitiva<br />
                  • Prezzi accessibili per ogni dimensione<br />
                  • Prova gratuita di 14 giorni
                </Text>
              </Stack>
            </SimpleGrid>
          </Box>

          {/* CTA */}
          <Card withBorder p="xl" radius="md" bg="blue.0" ta="center">
            <Stack align="center" gap="md">
              <Title order={3}>Prova InsegnaMi.pro nella Tua Scuola</Title>
              <Text c="dimmed" maw={500}>
                Unisciti alle scuole di {regione.nome} che già usano InsegnaMi.pro.
                Prova gratuita di 14 giorni, nessun impegno.
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
