import { NextRequest, NextResponse } from 'next/server';
import { getBlogPosts } from '@/lib/blog';
import { SITE_URL, PUBLIC_LOCALES } from '@/lib/seo';

/**
 * Feed RSS 2.0 del blog, per locale: /{locale}/blog/feed.xml
 * Disponibile solo per i locali che hanno almeno un post (404 altrimenti).
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;

  if (!(PUBLIC_LOCALES as readonly string[]).includes(locale)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const posts = await getBlogPosts(locale);
  if (posts.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const channelTitle =
    locale === 'it' ? 'Blog InsegnaMi.pro' : `InsegnaMi.pro Blog (${locale.toUpperCase()})`;
  const channelDescription =
    locale === 'it'
      ? 'Guide e consigli per la gestione della tua scuola: registro elettronico, presenze, pagamenti e digitalizzazione.'
      : 'Guides and tips for running your school: digital register, attendance, billing and digitalization.';

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/${locale}/blog/${post.slug}`;
      const pubDate = new Date(post.updated ?? post.date).toUTCString();
      const categories = [post.category, ...post.tags]
        .map((c) => `      <category>${escapeXml(c)}</category>`)
        .join('\n');
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${pubDate}</pubDate>
${categories}
    </item>`;
    })
    .join('\n');

  const lastBuildDate = new Date(posts[0].updated ?? posts[0].date).toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${SITE_URL}/${locale}/blog</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>${locale}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/${locale}/blog/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      // Il feed cambia solo quando si pubblica: cache CDN aggressiva ma non eterna
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
