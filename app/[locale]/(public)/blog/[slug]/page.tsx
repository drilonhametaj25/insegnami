import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Container,
  Title,
  Text,
  Badge,
  Group,
  Stack,
  Paper,
  Image,
  Divider,
  Card,
  SimpleGrid,
  Anchor,
  Breadcrumbs,
} from '@mantine/core';
import { IconCalendar, IconClock, IconUser, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { getBlogPost, getBlogSlugs, getRelatedPosts } from '@/lib/blog';

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
      title: 'Articolo non trovato | InsegnaMi.pro',
    };
  }

  return {
    title: `${post.title} | InsegnaMi.pro`,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: post.image ? [post.image] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: post.image ? [post.image] : [],
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
    dateModified: post.date,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Container size="md" py="xl">
        <Stack gap="xl">
          {/* Breadcrumbs */}
          <Breadcrumbs>
            <Anchor component={Link} href={`/${locale}`} size="sm">
              Home
            </Anchor>
            <Anchor component={Link} href={`/${locale}/blog`} size="sm">
              Blog
            </Anchor>
            <Text size="sm" c="dimmed">
              {post.title}
            </Text>
          </Breadcrumbs>

          {/* Back link */}
          <Anchor component={Link} href={`/${locale}/blog`} size="sm">
            <Group gap={4}>
              <IconArrowLeft size={16} />
              Torna al blog
            </Group>
          </Anchor>

          {/* Article Header */}
          <header>
            <Badge color="blue" variant="light" mb="sm">
              {post.category}
            </Badge>

            <Title order={1} mb="md">
              {post.title}
            </Title>

            <Text size="lg" c="dimmed" mb="lg">
              {post.description}
            </Text>

            <Group gap="lg">
              <Group gap={4}>
                <IconUser size={16} />
                <Text size="sm">{post.author}</Text>
              </Group>
              <Group gap={4}>
                <IconCalendar size={16} />
                <Text size="sm">
                  {new Date(post.date).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </Group>
              <Group gap={4}>
                <IconClock size={16} />
                <Text size="sm">{post.readingTime}</Text>
              </Group>
            </Group>
          </header>

          {/* Featured Image */}
          {post.image && (
            <Image
              src={post.image}
              alt={post.title}
              radius="md"
              fallbackSrc="/images/blog-placeholder.jpg"
            />
          )}

          {/* Article Content */}
          <Paper p="xl" radius="md">
            <article className="prose prose-lg" style={{ lineHeight: 1.8 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {post.content}
              </ReactMarkdown>
            </article>
          </Paper>

          {/* Tags */}
          {post.tags.length > 0 && (
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Tag:
              </Text>
              {post.tags.map((tag) => (
                <Badge key={tag} variant="outline" size="sm">
                  {tag}
                </Badge>
              ))}
            </Group>
          )}

          <Divider />

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section>
              <Title order={2} mb="lg">
                Articoli correlati
              </Title>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {relatedPosts.map((relatedPost) => (
                  <Card
                    key={relatedPost.slug}
                    component={Link}
                    href={`/${locale}/blog/${relatedPost.slug}`}
                    shadow="sm"
                    padding="md"
                    radius="md"
                    withBorder
                    style={{ textDecoration: 'none' }}
                  >
                    <Badge color="blue" variant="light" size="sm" mb="xs">
                      {relatedPost.category}
                    </Badge>
                    <Text fw={500} lineClamp={2}>
                      {relatedPost.title}
                    </Text>
                    <Text size="xs" c="dimmed" mt="xs">
                      {new Date(relatedPost.date).toLocaleDateString(locale)}
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>
            </section>
          )}

          {/* CTA */}
          <Card withBorder p="xl" radius="md" bg="blue.0">
            <Stack align="center" gap="md">
              <Title order={3} ta="center">
                Prova InsegnaMi.pro gratuitamente
              </Title>
              <Text c="dimmed" ta="center" maw={400}>
                Scopri come InsegnaMi.pro può semplificare la gestione della tua scuola.
                14 giorni di prova gratuita, nessuna carta di credito richiesta.
              </Text>
              <Anchor
                component={Link}
                href={`/${locale}/pricing`}
                style={{
                  backgroundColor: 'var(--mantine-color-blue-6)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: 'var(--mantine-radius-md)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Inizia la prova gratuita
              </Anchor>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </>
  );
}
