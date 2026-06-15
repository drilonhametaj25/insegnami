import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Card,
  Container,
  Group,
  List,
  ListItem,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconMapPin,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  regioni,
  getRegione,
  getProvinceByRegione,
  comuni,
} from '@/data/italia';
import { CtaBanner, PUB_GRADIENT } from '@/components/public/PublicUI';

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
    return { title: 'Regione non trovata' };
  }

  return {
    title: `Software Gestione Scuola in ${regione.nome}`,
    description: `InsegnaMi.pro è il software gestionale scolastico per le scuole di ${regione.nome}. Gestisci studenti, docenti, pagamenti e molto altro. Provalo gratis!`,
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

  // Conteggio comuni per provincia
  const provinceWithCounts = province.map((prov) => ({
    ...prov,
    comuniCount: comuni.filter((c) => c.provincia === prov.codice).length,
  }));

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Software Gestione Scuola in ${regione.nome}`,
    description: `InsegnaMi.pro è il software gestionale scolastico per le scuole di ${regione.nome}.`,
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

      {/* Hero */}
      <Box className="pub-hero" py={{ base: 40, sm: 56 }}>
        <Container size="xl">
          <Stack gap="lg">
            <Breadcrumbs>
              <Anchor component={Link} href={`/${locale}`} size="sm" c="indigo.6" underline="hover">
                Home
              </Anchor>
              <Anchor
                component={Link}
                href={`/${locale}/citta`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                Città
              </Anchor>
              <Text size="sm" c="dimmed">
                {regione.nome}
              </Text>
            </Breadcrumbs>

            <Group gap="lg" wrap="nowrap" align="flex-start">
              <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
                <IconMapPin size={34} />
              </ThemeIcon>
              <Box>
                <Badge size="lg" variant="light" color="indigo" radius="xl" mb="sm">
                  Regione
                </Badge>
                <Title fz={{ base: rem(28), sm: rem(34) }} fw={900} lh={1.15} c="var(--pub-ink)" mb={8}>
                  Software Gestione Scuola in {regione.nome}
                </Title>
                <Text size="lg" c="dimmed">
                  {province.length} province servite dal nostro software gestionale
                </Text>
              </Box>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Elenco province */}
      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          <Stack gap="xl">
            {/* Link di ritorno */}
            <Anchor
              component={Link}
              href={`/${locale}/citta`}
              size="sm"
              c="indigo.6"
              fw={500}
              underline="hover"
              display="inline-block"
            >
              <Group gap={6} wrap="nowrap">
                <IconArrowLeft size={16} />
                Tutte le regioni
              </Group>
            </Anchor>

            {/* Introduzione */}
            <Box>
              <Title order={2} fz={{ base: rem(26), sm: rem(30) }} fw={800} c="var(--pub-ink)" mb="md">
                Province in {regione.nome}
              </Title>
              <Text size="lg" c="dimmed" maw={800}>
                InsegnaMi.pro è disponibile in tutte le province della regione {regione.nome}.
                Seleziona la tua provincia per trovare scuole e informazioni nella tua zona.
              </Text>
            </Box>

            {/* Griglia province */}
            {provinceWithCounts.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                {provinceWithCounts.map((prov) => (
                  <Card
                    key={prov.codice}
                    component={Link}
                    href={`/${locale}/citta/${regioneSlug}/${prov.slug}`}
                    padding="xl"
                    radius="lg"
                    className="pub-card"
                    h="100%"
                    style={{ textDecoration: 'none' }}
                  >
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon size={36} radius="md" variant="light" color="indigo">
                            <IconBuilding size={20} />
                          </ThemeIcon>
                          <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                            {prov.nome}
                          </Title>
                        </Group>
                        <Badge color="gray" variant="light" radius="xl" style={{ flexShrink: 0 }}>
                          {prov.sigla}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        Software gestionale per scuole in provincia di {prov.nome}
                      </Text>
                      <Group justify="space-between" mt="auto">
                        {prov.comuniCount > 0 ? (
                          <Badge color="indigo" variant="light" size="sm" radius="xl">
                            {prov.comuniCount} {prov.comuniCount === 1 ? 'comune' : 'comuni'}
                          </Badge>
                        ) : (
                          <Badge color="gray" variant="light" size="sm" radius="xl">
                            In arrivo
                          </Badge>
                        )}
                        <IconArrowRight size={18} color="var(--mantine-color-indigo-6)" />
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            ) : (
              <Card withBorder padding="xl" radius="lg" ta="center">
                <Text c="dimmed">
                  Dati delle province in arrivo. Contattaci per informazioni sulla tua zona.
                </Text>
              </Card>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Contenuto SEO */}
      <Box bg="var(--pub-surface)" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <Card padding="xl" radius="lg" withBorder bg="white">
            <Title order={2} fz={{ base: rem(26), sm: rem(30) }} fw={800} c="var(--pub-ink)" mb="md">
              InsegnaMi.pro in {regione.nome}
            </Title>
            <Text mb="md" c="dimmed">
              InsegnaMi.pro è il software gestionale scolastico pensato per le scuole di{' '}
              {regione.nome}. Offriamo una soluzione completa per la gestione di scuole private,
              accademie musicali, scuole di danza, centri di formazione e istituti educativi di
              ogni tipo.
            </Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
              <Stack gap="sm">
                <Title order={4} fz={rem(18)} fw={700} c="var(--pub-ink)">
                  Funzionalità Principali
                </Title>
                <List
                  spacing={8}
                  size="sm"
                  c="dimmed"
                  icon={
                    <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  <ListItem>Gestione studenti e iscrizioni</ListItem>
                  <ListItem>Registro presenze digitale</ListItem>
                  <ListItem>Gestione docenti e orari</ListItem>
                  <ListItem>Fatturazione e pagamenti</ListItem>
                  <ListItem>Comunicazioni con famiglie</ListItem>
                </List>
              </Stack>
              <Stack gap="sm">
                <Title order={4} fz={rem(18)} fw={700} c="var(--pub-ink)">
                  Vantaggi per le Scuole in {regione.nome}
                </Title>
                <List
                  spacing={8}
                  size="sm"
                  c="dimmed"
                  icon={
                    <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  <ListItem>Supporto in italiano dedicato</ListItem>
                  <ListItem>Conformità GDPR e normative italiane</ListItem>
                  <ListItem>Interfaccia semplice e intuitiva</ListItem>
                  <ListItem>Prezzi accessibili per ogni dimensione</ListItem>
                  <ListItem>Prova gratuita di 14 giorni</ListItem>
                </List>
              </Stack>
            </SimpleGrid>
          </Card>
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title="Prova InsegnaMi.pro nella Tua Scuola"
        subtitle={`Porta la gestione della tua scuola in ${regione.nome} nel digitale. Prova gratuita di 14 giorni, nessun impegno.`}
      />
    </>
  );
}
