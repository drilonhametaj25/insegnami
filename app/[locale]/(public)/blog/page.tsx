import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Image,
  Badge,
  Group,
  Stack,
} from '@mantine/core';
import { IconClock, IconUser, IconCalendar } from '@tabler/icons-react';
import Link from 'next/link';
import { getBlogPosts, getBlogCategories } from '@/lib/blog';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Blog' });

  return {
    title: t('title') || 'Blog | InsegnaMi.pro',
    description:
      t('description') ||
      'Articoli, guide e consigli per la gestione della tua scuola. Scopri le ultime novità sul mondo della formazione.',
    openGraph: {
      title: t('title') || 'Blog | InsegnaMi.pro',
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
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Title order={1} mb="md">
            Blog InsegnaMi.pro
          </Title>
          <Text size="lg" c="dimmed" maw={600} mx="auto">
            Articoli, guide e consigli per gestire al meglio la tua scuola.
            Scopri le ultime novità sul mondo della formazione.
          </Text>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <Group justify="center" gap="xs">
            {categories.map((category) => (
              <Badge
                key={category.name}
                variant="outline"
                size="lg"
                style={{ cursor: 'pointer' }}
              >
                {category.name} ({category.count})
              </Badge>
            ))}
          </Group>
        )}

        {/* Posts Grid */}
        {posts.length > 0 ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {posts.map((post) => (
              <Card
                key={post.slug}
                component={Link}
                href={`/${locale}/blog/${post.slug}`}
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{ textDecoration: 'none' }}
              >
                {post.image && (
                  <Card.Section>
                    <Image
                      src={post.image}
                      height={180}
                      alt={post.title}
                      fallbackSrc="/images/blog-placeholder.jpg"
                    />
                  </Card.Section>
                )}

                <Stack gap="sm" mt="md">
                  <Badge color="blue" variant="light">
                    {post.category}
                  </Badge>

                  <Title order={3} lineClamp={2}>
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
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </Group>
                    <Group gap={4}>
                      <IconClock size={14} />
                      <Text size="xs" c="dimmed">
                        {post.readingTime}
                      </Text>
                    </Group>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        ) : (
          <Card withBorder p="xl" radius="md" ta="center">
            <Text c="dimmed">Nessun articolo disponibile al momento.</Text>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
