import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
// NB: niente componenti dot-notation (Card.Section) nei Server Components:
// in build di produzione risolvono a undefined ("Element type is invalid").
import {
  Badge,
  Box,
  Card,
  CardSection,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  rem,
} from '@mantine/core';
import { IconCalendar, IconClock } from '@tabler/icons-react';
import Link from 'next/link';
import { getBlogPosts, getBlogCategories } from '@/lib/blog';
import { CtaBanner, PageHero } from '@/components/public/PublicUI';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Blog' });

  return {
    title: t('title') || 'Blog',
    description:
      t('description') ||
      'Articoli, guide e consigli per la gestione della tua scuola. Scopri le ultime novità sul mondo della formazione.',
    openGraph: {
      title: t('title') || 'Blog',
      description:
        t('description') ||
        'Articoli, guide e consigli per la gestione della tua scuola.',
      type: 'website',
    },
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const posts = await getBlogPosts(locale);
  const categories = await getBlogCategories(locale);

  return (
    <>
      {/* Hero */}
      <PageHero
        badge="Blog"
        title="Guide e novità sulla"
        highlight="gestione scolastica"
        subtitle="Articoli, guide e consigli per gestire al meglio la tua scuola. Scopri le ultime novità sul mondo della formazione."
      >
        {/* Categorie: testo informativo con conteggio, non cliccabili */}
        {categories.length > 0 && (
          <Group justify="center" gap="xs" mt="sm">
            {categories.map((category) => (
              <Badge key={category.name} variant="light" color="indigo" size="lg" radius="xl">
                {category.name} ({category.count})
              </Badge>
            ))}
          </Group>
        )}
      </PageHero>

      {/* Griglia articoli */}
      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          {posts.length > 0 ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {posts.map((post) => (
                <Card
                  key={post.slug}
                  component={Link}
                  href={`/${locale}/blog/${post.slug}`}
                  padding="xl"
                  radius="lg"
                  bg="white"
                  className="pub-card"
                  h="100%"
                  style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
                >
                  {/* Blocco decorativo al posto delle immagini (asset non presenti) */}
                  <CardSection>
                    <Box h={140} pos="relative" style={{ background: 'var(--pub-brand-gradient)' }}>
                      <Box
                        pos="absolute"
                        inset={0}
                        style={{
                          background:
                            'radial-gradient(90% 90% at 85% -10%, rgba(255, 255, 255, 0.28) 0%, transparent 60%)',
                        }}
                      />
                      <Badge
                        variant="white"
                        color="indigo"
                        radius="xl"
                        pos="absolute"
                        bottom={12}
                        left={12}
                      >
                        {post.category}
                      </Badge>
                    </Box>
                  </CardSection>

                  <Stack gap="sm" mt="md" style={{ flex: 1 }}>
                    <Title order={3} fz={rem(20)} fw={700} lh={1.3} c="var(--pub-ink)" lineClamp={2}>
                      {post.title}
                    </Title>

                    <Text size="sm" c="dimmed" lineClamp={3}>
                      {post.description}
                    </Text>

                    <Group gap="lg" mt="auto">
                      <Group gap={4}>
                        <IconCalendar size={14} />
                        <Text size="xs" c="dimmed">
                          {new Date(post.date).toLocaleDateString(locale, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                      </Group>
                      <Group gap={4}>
                        <IconClock size={14} />
                        <Text size="xs" c="dimmed">
                          {post.readingTime.replace('min read', 'min di lettura')}
                        </Text>
                      </Group>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Card withBorder p="xl" radius="lg" ta="center">
              <Text c="dimmed">Nessun articolo disponibile al momento.</Text>
            </Card>
          )}
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner locale={locale} />
    </>
  );
}
