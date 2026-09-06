import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Anchor, Box, Container, Group } from '@mantine/core';
import Link from 'next/link';
import { getBlogCategories, getBlogPostsByCategory, slugifyTaxonomy } from '@/lib/blog';
import { buildPublicMetadata } from '@/lib/seo';
import { CtaBanner, PageHero } from '@/components/public/PublicUI';
import { PostGrid } from '../../PostGrid';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; slug: string }[] = [];
  for (const locale of locales) {
    const categories = await getBlogCategories(locale);
    categories.forEach((c) => params.push({ locale, slug: slugifyTaxonomy(c.name) }));
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const { name } = await getBlogPostsByCategory(slug, locale);
  if (!name) {
    return { title: 'Categoria non trovata' };
  }
  return buildPublicMetadata({
    locale,
    path: `/blog/categoria/${slug}`,
    title: `${name} - Blog`,
    description: `Tutti gli articoli della categoria ${name}: guide e consigli pratici per la gestione della tua scuola.`,
  });
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const { name, posts } = await getBlogPostsByCategory(slug, locale);

  if (!name || posts.length === 0) {
    notFound();
  }

  return (
    <>
      <PageHero
        badge="Categoria"
        title="Articoli su"
        highlight={name}
        subtitle={`${posts.length} ${posts.length === 1 ? 'articolo' : 'articoli'} nella categoria ${name}.`}
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
