import { Metadata } from 'next';
import { Anchor, Badge, Box, Card, Container, Group, Text } from '@mantine/core';
import Link from 'next/link';
import { getBlogPosts, getBlogCategories, slugifyTaxonomy } from '@/lib/blog';
import { buildPublicMetadata } from '@/lib/seo';
import { CtaBanner, PageHero } from '@/components/public/PublicUI';
import { PostGrid } from './PostGrid';

const POSTS_PER_PAGE = 12;

// Stringhe della pagina (hardcoded IT in questa fase: un agente successivo
// estrae e traduce tutto in messages/*.json).
const copy = {
  title: 'Blog: guide e consigli per la gestione scolastica',
  description:
    'Articoli, guide e consigli per gestire al meglio la tua scuola. Scopri le ultime novità sul mondo della formazione e della digitalizzazione scolastica.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPublicMetadata({
    locale,
    path: '/blog',
    title: copy.title,
    description: copy.description,
  });
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const posts = await getBlogPosts(locale);
  const categories = await getBlogCategories(locale);

  // Paginazione: 12 articoli per pagina, ?page= (clamp su range valido)
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const requestedPage = parseInt(pageParam ?? '1', 10);
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
  const pagePosts = posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  return (
    <>
      {/* Hero */}
      <PageHero
        badge="Blog"
        title="Guide e novità sulla"
        highlight="gestione scolastica"
        subtitle="Articoli, guide e consigli per gestire al meglio la tua scuola. Scopri le ultime novità sul mondo della formazione."
      >
        {/* Categorie cliccabili → pagina categoria */}
        {categories.length > 0 && (
          <Group justify="center" gap="xs" mt="sm">
            {categories.map((category) => (
              <Badge
                key={category.name}
                component={Link}
                href={`/${locale}/blog/categoria/${slugifyTaxonomy(category.name)}`}
                variant="light"
                color="indigo"
                size="lg"
                radius="xl"
                style={{ cursor: 'pointer' }}
              >
                {category.name} ({category.count})
              </Badge>
            ))}
          </Group>
        )}
      </PageHero>

      {/* Griglia articoli */}
      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          {pagePosts.length > 0 ? (
            <>
              <PostGrid posts={pagePosts} locale={locale} />

              {/* Paginazione server-side via link ?page= (niente componenti
                  client interattivi: pagina 100% renderizzabile lato server) */}
              {totalPages > 1 && (
                <Group justify="center" gap="xs" mt="xl">
                  {page > 1 && (
                    <Anchor
                      component={Link}
                      href={`/${locale}/blog${page - 1 > 1 ? `?page=${page - 1}` : ''}`}
                      size="sm"
                      c="indigo.6"
                      underline="hover"
                    >
                      ← Precedente
                    </Anchor>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
                    p === page ? (
                      <Badge key={p} variant="filled" color="indigo" radius="xl" size="lg">
                        {p}
                      </Badge>
                    ) : (
                      <Badge
                        key={p}
                        component={Link}
                        href={`/${locale}/blog${p > 1 ? `?page=${p}` : ''}`}
                        variant="light"
                        color="indigo"
                        radius="xl"
                        size="lg"
                        style={{ cursor: 'pointer' }}
                      >
                        {p}
                      </Badge>
                    )
                  )}
                  {page < totalPages && (
                    <Anchor
                      component={Link}
                      href={`/${locale}/blog?page=${page + 1}`}
                      size="sm"
                      c="indigo.6"
                      underline="hover"
                    >
                      Successiva →
                    </Anchor>
                  )}
                </Group>
              )}
            </>
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
