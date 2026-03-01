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
import { IconMapPin, IconUsers, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import {
  regioni,
  province,
  getRegione,
  getProvincia,
  getComuniByProvincia,
} from '@/data/italia';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; regione: string; provincia: string }[] = [];

  for (const locale of locales) {
    for (const prov of province) {
      const regione = regioni.find((r) => r.codice === prov.regione);
      if (regione) {
        params.push({
          locale,
          regione: regione.slug,
          provincia: prov.slug,
        });
      }
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; regione: string; provincia: string }>;
}): Promise<Metadata> {
  const { locale, regione: regioneSlug, provincia: provinciaSlug } = await params;
  const regione = getRegione(regioneSlug);
  const provincia = getProvincia(provinciaSlug);

  if (!regione || !provincia) {
    return { title: 'Provincia non trovata | InsegnaMi.pro' };
  }

  return {
    title: `Software Gestione Scuola a ${provincia.nome} (${provincia.sigla}) | InsegnaMi.pro`,
    description: `Cerchi un software gestionale per la tua scuola a ${provincia.nome}? InsegnaMi.pro è la soluzione #1 in provincia di ${provincia.nome}, ${regione.nome}. Provalo gratis!`,
    openGraph: {
      title: `Software Gestione Scuola a ${provincia.nome} | InsegnaMi.pro`,
      description: `Il miglior software gestionale per scuole in provincia di ${provincia.nome}. Supporto locale e conformità normative.`,
      type: 'website',
    },
    alternates: {
      canonical: `https://insegnami.pro/${locale}/citta/${regioneSlug}/${provinciaSlug}`,
    },
  };
}

export default async function ProvinciaPage({
  params,
}: {
  params: Promise<{ locale: string; regione: string; provincia: string }>;
}) {
  const { locale, regione: regioneSlug, provincia: provinciaSlug } = await params;
  const regione = getRegione(regioneSlug);
  const provincia = getProvincia(provinciaSlug);

  if (!regione || !provincia) {
    notFound();
  }

  const comuni = getComuniByProvincia(provinciaSlug);

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Software Gestione Scuola a ${provincia.nome}`,
    description: `InsegnaMi.pro è il software gestionale scolastico #1 in provincia di ${provincia.nome}.`,
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
        {
          '@type': 'ListItem',
          position: 4,
          name: provincia.nome,
          item: `https://insegnami.pro/${locale}/citta/${regioneSlug}/${provinciaSlug}`,
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
              <Anchor component={Link} href={`/${locale}/citta/${regioneSlug}`} c="white">
                {regione.nome}
              </Anchor>
              <Text c="white">{provincia.nome}</Text>
            </Breadcrumbs>

            <Group gap="lg" align="center">
              <ThemeIcon size={60} radius="xl" variant="white" color="blue">
                <IconMapPin size={30} />
              </ThemeIcon>
              <div>
                <Group gap="sm" align="center">
                  <Title order={1}>
                    Software Gestione Scuola a {provincia.nome}
                  </Title>
                  <Badge color="white" variant="filled" c="blue" size="lg">
                    {provincia.sigla}
                  </Badge>
                </Group>
                <Text size="lg" mt="xs">
                  Provincia di {provincia.nome}, {regione.nome}
                </Text>
              </div>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Back link */}
          <Anchor component={Link} href={`/${locale}/citta/${regioneSlug}`} size="sm">
            <Group gap={4}>
              <IconArrowLeft size={16} />
              Torna a {regione.nome}
            </Group>
          </Anchor>

          {/* Introduction */}
          <Box>
            <Title order={2} mb="md">
              Comuni in Provincia di {provincia.nome}
            </Title>
            <Text size="lg" c="dimmed" maw={800}>
              InsegnaMi.pro è disponibile in tutti i comuni della provincia di {provincia.nome}.
              Trova la tua città per scoprire come il nostro software gestionale può aiutare
              la tua scuola.
            </Text>
          </Box>

          {/* Comuni Grid */}
          {comuni.length > 0 ? (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
              {comuni.map((comune) => (
                <Card
                  key={comune.codice}
                  component={Link}
                  href={`/${locale}/citta/${regioneSlug}/${provinciaSlug}/${comune.slug}`}
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{ textDecoration: 'none' }}
                >
                  <Stack gap="xs">
                    <Title order={4}>{comune.nome}</Title>
                    <Group gap="xs">
                      {comune.popolazione && (
                        <Badge color="blue" variant="light" size="sm">
                          <Group gap={4}>
                            <IconUsers size={12} />
                            {comune.popolazione.toLocaleString('it-IT')} ab.
                          </Group>
                        </Badge>
                      )}
                      <Badge color="gray" variant="light" size="sm">
                        CAP {comune.cap}
                      </Badge>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Card withBorder p="xl" radius="md" ta="center">
              <Stack align="center" gap="md">
                <Text c="dimmed">
                  Dati dei comuni in provincia di {provincia.nome} in arrivo.
                </Text>
                <Text size="sm">
                  Nel frattempo, contattaci per informazioni sulla tua scuola a {provincia.nome}.
                </Text>
                <Anchor
                  component={Link}
                  href={`/${locale}/contact`}
                  style={{
                    backgroundColor: 'var(--mantine-color-blue-6)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--mantine-radius-md)',
                    textDecoration: 'none',
                  }}
                >
                  Contattaci
                </Anchor>
              </Stack>
            </Card>
          )}

          {/* SEO Content */}
          <Box mt="xl" p="xl" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Title order={2} mb="md">
              Perché le Scuole di {provincia.nome} Scelgono InsegnaMi.pro
            </Title>
            <Text mb="lg">
              InsegnaMi.pro è la soluzione gestionale preferita dalle scuole private, accademie e
              centri di formazione in provincia di {provincia.nome}. Ecco perché sempre più
              istituti ci scelgono:
            </Text>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Title order={4}>Facile da Usare</Title>
                  <Text size="sm" c="dimmed">
                    Interfaccia intuitiva che non richiede formazione tecnica.
                    I tuoi docenti e staff saranno operativi in pochi minuti.
                  </Text>
                </Stack>
              </Card>
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Title order={4}>Tutto in Uno</Title>
                  <Text size="sm" c="dimmed">
                    Studenti, docenti, classi, pagamenti, comunicazioni.
                    Un unico software per gestire ogni aspetto della tua scuola.
                  </Text>
                </Stack>
              </Card>
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Title order={4}>Supporto Dedicato</Title>
                  <Text size="sm" c="dimmed">
                    Team di supporto italiano disponibile per aiutarti.
                    Assistenza via email, chat e telefono inclusa.
                  </Text>
                </Stack>
              </Card>
            </SimpleGrid>
          </Box>

          {/* CTA */}
          <Card withBorder p="xl" radius="md" bg="blue.0" ta="center">
            <Stack align="center" gap="md">
              <Title order={3}>
                La Tua Scuola a {provincia.nome} Merita il Meglio
              </Title>
              <Text c="dimmed" maw={500}>
                Unisciti alle scuole di {provincia.nome} che hanno già scelto InsegnaMi.pro.
                Inizia la tua prova gratuita oggi.
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
                Prova Gratis per 14 Giorni
              </Anchor>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </>
  );
}
