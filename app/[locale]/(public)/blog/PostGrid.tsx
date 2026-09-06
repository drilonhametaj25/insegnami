// NB: niente componenti dot-notation (Card.Section) nei Server Components:
// in build di produzione risolvono a undefined ("Element type is invalid").
import {
  Badge,
  Box,
  Card,
  CardSection,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  rem,
} from '@mantine/core';
import { IconCalendar, IconClock } from '@tabler/icons-react';
import Link from 'next/link';
import type { BlogPostMeta } from '@/lib/blog';

/**
 * Griglia di card articolo condivisa da indice blog, pagine categoria e tag.
 * Con cover (frontmatter image) mostra l'immagine; altrimenti blocco decorativo.
 */
export function PostGrid({ posts, locale }: { posts: BlogPostMeta[]; locale: string }) {
  return (
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
          <CardSection>
            <Box h={140} pos="relative" style={{ background: 'var(--pub-brand-gradient)' }}>
              {post.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.image}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Box
                  pos="absolute"
                  inset={0}
                  style={{
                    background:
                      'radial-gradient(90% 90% at 85% -10%, rgba(255, 255, 255, 0.28) 0%, transparent 60%)',
                  }}
                />
              )}
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
  );
}
