import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

// Slug validi: solo caratteri alfanumerici, trattini e underscore.
// Blocca probe dei bot (/blog/.env, /blog/../..) prima di toccare il filesystem.
const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/i;

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  /** Data di ultimo aggiornamento (frontmatter 'updated'), se presente. */
  updated?: string;
  author: string;
  category: string;
  tags: string[];
  image?: string;
  readingTime: string;
  content: string;
  locale: string;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  /** Data di ultimo aggiornamento (frontmatter 'updated'), se presente. */
  updated?: string;
  author: string;
  category: string;
  tags: string[];
  image?: string;
  readingTime: string;
  locale: string;
}

/**
 * Slug URL-safe per categorie e tag ("Registro Elettronico" → "registro-elettronico").
 * Stessa funzione usata da route e link: il matching resta consistente.
 */
export function slugifyTaxonomy(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuove gli accenti (diacritici combinanti)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get all blog posts for a locale
 */
export async function getBlogPosts(locale: string = 'it'): Promise<BlogPostMeta[]> {
  const localeDir = path.join(BLOG_DIR, locale);

  // Mai creare directory a runtime: in produzione il filesystem è read-only.
  if (!fs.existsSync(localeDir)) {
    return [];
  }

  const files = fs.readdirSync(localeDir).filter((file) => file.endsWith('.mdx'));

  const posts = files.map((file) => {
    const slug = file.replace('.mdx', '');
    const filePath = path.join(localeDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);
    const stats = readingTime(content);

    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      date: data.date || new Date().toISOString(),
      updated: data.updated || undefined,
      author: data.author || 'InsegnaMi Team',
      category: data.category || 'Generale',
      tags: data.tags || [],
      image: data.image,
      readingTime: stats.text,
      locale,
    };
  });

  // Sort by date descending
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Get a single blog post by slug
 */
export async function getBlogPost(slug: string, locale: string = 'it'): Promise<BlogPost | null> {
  if (!SLUG_RE.test(slug)) {
    return null;
  }

  const filePath = path.join(BLOG_DIR, locale, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  const stats = readingTime(content);

  return {
    slug,
    title: data.title || slug,
    description: data.description || '',
    date: data.date || new Date().toISOString(),
    updated: data.updated || undefined,
    author: data.author || 'InsegnaMi Team',
    category: data.category || 'Generale',
    tags: data.tags || [],
    image: data.image,
    readingTime: stats.text,
    content,
    locale,
  };
}

/**
 * Posts belonging to a category, matched by slugified name.
 * Returns the display name too (dal primo post che matcha).
 */
export async function getBlogPostsByCategory(
  categorySlug: string,
  locale: string = 'it'
): Promise<{ name: string | null; posts: BlogPostMeta[] }> {
  const posts = await getBlogPosts(locale);
  const matching = posts.filter((p) => slugifyTaxonomy(p.category) === categorySlug);
  return { name: matching[0]?.category ?? null, posts: matching };
}

/**
 * Posts carrying a tag, matched by slugified name.
 */
export async function getBlogPostsByTag(
  tagSlug: string,
  locale: string = 'it'
): Promise<{ name: string | null; posts: BlogPostMeta[] }> {
  const posts = await getBlogPosts(locale);
  let name: string | null = null;
  const matching = posts.filter((p) => {
    const tag = p.tags.find((t) => slugifyTaxonomy(t) === tagSlug);
    if (tag && !name) name = tag;
    return Boolean(tag);
  });
  return { name, posts: matching };
}

/**
 * Locali in cui esiste un post con questo slug (per hreflang dei post).
 */
export async function getPostLocales(slug: string): Promise<string[]> {
  if (!SLUG_RE.test(slug)) return [];
  const locales = ['it', 'en', 'fr', 'pt'];
  return locales.filter((l) => fs.existsSync(path.join(BLOG_DIR, l, `${slug}.mdx`)));
}

/**
 * Get all blog slugs for static generation
 */
export async function getBlogSlugs(locale: string = 'it'): Promise<string[]> {
  const localeDir = path.join(BLOG_DIR, locale);

  if (!fs.existsSync(localeDir)) {
    return [];
  }

  const files = fs.readdirSync(localeDir).filter((file) => file.endsWith('.mdx'));
  return files.map((file) => file.replace('.mdx', ''));
}

/**
 * Get all categories with post counts
 */
export async function getBlogCategories(locale: string = 'it'): Promise<{ name: string; count: number }[]> {
  const posts = await getBlogPosts(locale);
  const categories: Record<string, number> = {};

  posts.forEach((post) => {
    categories[post.category] = (categories[post.category] || 0) + 1;
  });

  return Object.entries(categories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get all tags with post counts
 */
export async function getBlogTags(locale: string = 'it'): Promise<{ name: string; count: number }[]> {
  const posts = await getBlogPosts(locale);
  const tags: Record<string, number> = {};

  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tags[tag] = (tags[tag] || 0) + 1;
    });
  });

  return Object.entries(tags)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get related posts based on category and tags
 */
export async function getRelatedPosts(
  currentSlug: string,
  locale: string = 'it',
  limit: number = 3
): Promise<BlogPostMeta[]> {
  const currentPost = await getBlogPost(currentSlug, locale);
  if (!currentPost) return [];

  const allPosts = await getBlogPosts(locale);
  const otherPosts = allPosts.filter((p) => p.slug !== currentSlug);

  // Score posts by relevance
  const scoredPosts = otherPosts.map((post) => {
    let score = 0;

    // Same category = +10
    if (post.category === currentPost.category) {
      score += 10;
    }

    // Matching tags = +5 each
    currentPost.tags.forEach((tag) => {
      if (post.tags.includes(tag)) {
        score += 5;
      }
    });

    return { ...post, score };
  });

  // Sort by score and return top N
  return scoredPosts
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...post }) => post);
}
