import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  rem,
} from '@mantine/core';
import { IconCalendar, IconClock, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import { getBlogPost, getBlogSlugs, getPostLocales, getRelatedPosts, slugifyTaxonomy } from '@/lib/blog';
import { buildPublicMetadata, SITE_URL } from '@/lib/seo';
import { CtaBanner } from '@/components/public/PublicUI';
import { blogMarkdownComponents } from '@/components/public/BlogMarkdown';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; slug: string }[] = [];

  for (const locale of locales) {
    const slugs = await getBlogSlugs(locale);
    slugs.forEach((slug) => {
      params.push({ locale, slug });
    });
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getBlogPost(slug, locale);

  if (!post) {
    return {
      title: 'Articolo non trovato',
    };
  }

  // Canonical/hreflang via buildPublicMetadata, ma con hreflang limitato ai
  // SOLI locali in cui il post esiste davvero: un post senza traduzione non
  // deve dichiarare alternate verso 404.
  const metadata = buildPublicMetadata({
    locale,
    path: `/blog/${slug}`,
    title: post.title,
    description: post.description,
    ogImage: post.image ? `${SITE_URL}${post.image}` : undefined,
  });

  const availableLocales = await getPostLocales(slug);
  if (metadata.alternates) {
    if (availableLocales.length > 1) {
      const languages: Record<string, string> = Object.fromEntries(
        availableLocales.map((l) => [l, `${SITE_URL}/${l}/blog/${slug}`])
      );
      // x-default solo se esiste la versione italiana (default del sito)
      if (availableLocales.includes('it')) {
        languages['x-default'] = `${SITE_URL}/it/blog/${slug}`;
      }
      metadata.alternates.languages = languages;
    } else {
      // Post in un solo locale: canonical self, nessun hreflang
      delete metadata.alternates.languages;
    }
  }

  return {
    ...metadata,
    authors: [{ name: post.author }],
    openGraph: {
      ...metadata.openGraph,
      type: 'article',
      publishedTime: post.date,
      ...(post.updated ? { modifiedTime: post.updated } : {}),
      authors: [post.author],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = await getBlogPost(slug, locale);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(slug, locale);

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: post.image,
    author: {
      '@type': 'Organization',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'InsegnaMi.pro',
      logo: {
        '@type': 'ImageObject',
        url: 'https://insegnami.pro/logo.png',
      },
    },
    datePublished: post.date,
    // dateModified dal frontmatter 'updated' quando presente
    dateModified: post.updated ?? post.date,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Testata articolo su banda hero, come le altre pagine pubbliche */}
      <Box className="pub-hero" py={{ base: 32, sm: 48 }}>
        <Container size="md">
          {/* Breadcrumbs (navigazione unica verso Home e Blog) */}
          <Breadcrumbs mb="xl">
            <Anchor component={Link} href={`/${locale}`} size="sm" c="indigo.6" underline="hover">
              Home
            </Anchor>
            <Anchor
              component={Link}
              href={`/${locale}/blog`}
              size="sm"
              c="indigo.6"
              underline="hover"
            >
              Blog
            </Anchor>
            <Text size="sm" c="dimmed" truncate maw={320}>
              {post.title}
            </Text>
          </Breadcrumbs>

          <header>
            <Badge
              component={Link}
              href={`/${locale}/blog/categoria/${slugifyTaxonomy(post.category)}`}
              variant="light"
              color="indigo"
              radius="xl"
              mb="sm"
              style={{ cursor: 'pointer' }}
            >
              {post.category}
            </Badge>

            <Title
              order={1}
              fz={{ base: rem(34), sm: rem(40) }}
              fw={900}
              lh={1.15}
              c="var(--pub-ink)"
              mb="md"
            >
              {post.title}
            </Title>

            <Text size="lg" c="dimmed" mb="lg">
              {post.description}
            </Text>

            <Group gap="lg">
              <Group gap={6}>
                <IconCalendar size={16} />
                <Text size="sm" c="gray.7">
                  {new Date(post.date).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </Group>
              <Group gap={6}>
                <IconUser size={16} />
                <Text size="sm" c="gray.7">
                  {post.author}
                </Text>
              </Group>
              <Group gap={6}>
                <IconClock size={16} />
                <Text size="sm" c="gray.7">
                  {post.readingTime.replace('min read', 'min di lettura')}
                </Text>
              </Group>
            </Group>
          </header>
        </Container>
      </Box>

      {/* Corpo articolo su bianco */}
      <Container size="md" py={{ base: 32, sm: 48 }}>
        <Stack gap="xl">
          <Box component="article">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={blogMarkdownComponents}>
              {post.content}
            </ReactMarkdown>
          </Box>

          {/* Tag */}
          {post.tags.length > 0 && (
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Tag:
              </Text>
              {post.tags.map((tag) => (
                <Badge
                  key={tag}
                  component={Link}
                  href={`/${locale}/blog/tag/${slugifyTaxonomy(tag)}`}
                  variant="outline"
                  color="indigo"
                  size="sm"
                  radius="xl"
                  style={{ cursor: 'pointer' }}
                >
                  {tag}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      </Container>

      {/* Articoli correlati in banda surface */}
      {relatedPosts.length > 0 && (
        <Box component="section" bg="var(--pub-surface)" py={{ base: 40, sm: 56 }}>
          <Container size="md">
            <Title order={2} fz={rem(24)} fw={800} c="var(--pub-ink)" mb="lg">
              Articoli correlati
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
              {relatedPosts.map((relatedPost) => (
                <Card
                  key={relatedPost.slug}
                  component={Link}
                  href={`/${locale}/blog/${relatedPost.slug}`}
                  padding="lg"
                  radius="lg"
                  bg="white"
                  className="pub-card"
                  style={{ textDecoration: 'none' }}
                >
                  <Badge variant="light" color="indigo" size="sm" radius="xl" mb="xs">
                    {relatedPost.category}
                  </Badge>
                  <Text fw={600} c="var(--pub-ink)" lineClamp={2}>
                    {relatedPost.title}
                  </Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    {new Date(relatedPost.date).toLocaleDateString(locale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </Container>
        </Box>
      )}

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title="Prova InsegnaMi.pro gratuitamente"
        subtitle="Scopri come InsegnaMi.pro può semplificare la gestione della tua scuola. 14 giorni di prova gratuita, nessuna carta di credito richiesta."
      />
    </>
  );
}
