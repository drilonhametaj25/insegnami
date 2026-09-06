import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Anchor, Box, Container, Group } from '@mantine/core';
import Link from 'next/link';
import { getBlogTags, getBlogPostsByTag, slugifyTaxonomy } from '@/lib/blog';
import { buildPublicMetadata } from '@/lib/seo';
import { CtaBanner, PageHero } from '@/components/public/PublicUI';
import { PostGrid } from '../../PostGrid';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; slug: string }[] = [];
  for (const locale of locales) {
    const tags = await getBlogTags(locale);
    tags.forEach((t) => params.push({ locale, slug: slugifyTaxonomy(t.name) }));
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const { name } = await getBlogPostsByTag(slug, locale);
  if (!name) {
    return { title: 'Tag non trovato' };
  }
  return buildPublicMetadata({
    locale,
    path: `/blog/tag/${slug}`,
    title: `${name} - Blog`,
    description: `Tutti gli articoli con il tag "${name}": approfondimenti e guide per la gestione della tua scuola.`,
  });
}

export default async function BlogTagPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const { name, posts } = await getBlogPostsByTag(slug, locale);

  if (!name || posts.length === 0) {
    notFound();
  }

  return (
    <>
      <PageHero
        badge="Tag"
        title="Articoli taggati"
        highlight={name}
        subtitle={`${posts.length} ${posts.length === 1 ? 'articolo' : 'articoli'} con il tag "${name}".`}
      >
        <Group justify="center" mt="sm">
          <Anchor component={Link} href={`/${locale}/blog`} size="sm" c="indigo.6" underline="hover">
            ← Tutti gli articoli
          </Anchor>
        </Group>
      </PageHero>

      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          <PostGrid posts={posts} locale={locale} />
        </Container>
      </Box>

      <CtaBanner locale={locale} />
    </>
  );
}
