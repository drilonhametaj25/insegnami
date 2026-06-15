import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
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
  IconArrowLeft,
  IconArrowRight,
  IconMapPin,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  regioni,
  province,
  getRegione,
  getProvincia,
  getComuniByProvincia,
} from '@/data/italia';
import { CtaBanner, PUB_GRADIENT, SectionHeader } from '@/components/public/PublicUI';

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
    return { title: 'Provincia non trovata' };
  }

  return {
    title: `Software Gestione Scuola a ${provincia.nome} (${provincia.sigla})`,
    description: `Cerchi un software gestionale per la tua scuola a ${provincia.nome}? InsegnaMi.pro è la soluzione per le scuole in provincia di ${provincia.nome}, ${regione.nome}. Provalo gratis!`,
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
    description: `InsegnaMi.pro è il software gestionale scolastico per le scuole in provincia di ${provincia.nome}.`,
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
              <Anchor
                component={Link}
                href={`/${locale}/citta/${regioneSlug}`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                {regione.nome}
              </Anchor>
              <Text size="sm" c="dimmed">
                {provincia.nome}
              </Text>
            </Breadcrumbs>

            <Group gap="lg" wrap="nowrap" align="flex-start">
              <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
                <IconMapPin size={34} />
              </ThemeIcon>
              <Box>
                <Badge size="lg" variant="light" color="indigo" radius="xl" mb="sm">
                  Provincia · {provincia.sigla}
                </Badge>
                <Title fz={{ base: rem(28), sm: rem(34) }} fw={900} lh={1.15} c="var(--pub-ink)" mb={8}>
                  Software Gestione Scuola a {provincia.nome}
                </Title>
                <Text size="lg" c="dimmed">
                  Provincia di {provincia.nome}, {regione.nome}
                </Text>
              </Box>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Elenco comuni */}
      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          <Stack gap="xl">
            {/* Link di ritorno */}
            <Anchor
              component={Link}
              href={`/${locale}/citta/${regioneSlug}`}
              size="sm"
              c="indigo.6"
              fw={500}
              underline="hover"
              display="inline-block"
            >
              <Group gap={6} wrap="nowrap">
                <IconArrowLeft size={16} />
                Torna a {regione.nome}
              </Group>
            </Anchor>

            {/* Introduzione */}
            <Box>
              <Title order={2} fz={{ base: rem(26), sm: rem(30) }} fw={800} c="var(--pub-ink)" mb="md">
                Comuni in Provincia di {provincia.nome}
              </Title>
              <Text size="lg" c="dimmed" maw={800}>
                InsegnaMi.pro è disponibile in tutti i comuni della provincia di {provincia.nome}.
                Trova la tua città per scoprire come il nostro software gestionale può aiutare
                la tua scuola.
              </Text>
            </Box>

            {/* Griglia comuni */}
            {comuni.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg">
                {comuni.map((comune) => (
                  <Card
                    key={comune.codice}
                    component={Link}
                    href={`/${locale}/citta/${regioneSlug}/${provinciaSlug}/${comune.slug}`}
                    padding="lg"
                    radius="lg"
                    className="pub-card"
                    h="100%"
                    style={{ textDecoration: 'none' }}
                  >
                    <Stack gap="xs" h="100%">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Title order={4} fz={rem(18)} fw={700} c="var(--pub-ink)">
                          {comune.nome}
                        </Title>
                        <IconArrowRight
                          size={16}
                          color="var(--mantine-color-indigo-6)"
                          style={{ flexShrink: 0 }}
                        />
                      </Group>
                      <Group gap="xs" mt="auto">
                        <Badge color="gray" variant="light" size="sm" radius="xl">
                          CAP {comune.cap}
                        </Badge>
                        {comune.popolazione && (
                          <Badge
                            color="indigo"
                            variant="light"
                            size="sm"
                            radius="xl"
                            leftSection={<IconUsers size={12} />}
                          >
                            {comune.popolazione.toLocaleString('it-IT')} ab.
                          </Badge>
                        )}
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            ) : (
              <Card withBorder padding="xl" radius="lg" ta="center">
                <Stack align="center" gap="md">
                  <Text c="dimmed">
                    Dati dei comuni in provincia di {provincia.nome} in arrivo.
                  </Text>
                  <Text size="sm">
                    Nel frattempo, contattaci per informazioni sulla tua scuola a {provincia.nome}.
                  </Text>
                  <Button
                    component={Link}
                    href={`/${locale}/contact`}
                    variant="light"
                    color="indigo"
                    radius="xl"
                  >
                    Contattaci
                  </Button>
                </Stack>
              </Card>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Contenuto SEO */}
      <Box bg="var(--pub-surface)" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SectionHeader
            title={`Perché le Scuole di ${provincia.nome}`}
            highlight="Scelgono InsegnaMi.pro"
            subtitle={`InsegnaMi.pro è la soluzione gestionale preferita dalle scuole private, accademie e centri di formazione in provincia di ${provincia.nome}. Ecco perché sempre più istituti ci scelgono:`}
          />
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            {[
              {
                title: 'Facile da Usare',
                text: 'Interfaccia intuitiva che non richiede formazione tecnica. I tuoi docenti e staff saranno operativi in pochi minuti.',
              },
              {
                title: 'Tutto in Uno',
                text: 'Studenti, docenti, classi, pagamenti, comunicazioni. Un unico software per gestire ogni aspetto della tua scuola.',
              },
              {
                title: 'Supporto Dedicato',
                text: 'Team di supporto italiano disponibile per aiutarti. Assistenza via email, chat e telefono inclusa.',
              },
            ].map((item) => (
              <Card key={item.title} padding="xl" radius="lg" withBorder bg="white" h="100%">
                <Title order={4} fz={rem(20)} fw={700} c="var(--pub-ink)" mb="xs">
                  {item.title}
                </Title>
                <Text size="sm" c="dimmed" lh={1.6}>
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
        title={`La Tua Scuola a ${provincia.nome} Merita il Meglio`}
        subtitle={`Porta la gestione della tua scuola a ${provincia.nome} nel digitale. Inizia la tua prova gratuita oggi.`}
      />
    </>
  );
}
