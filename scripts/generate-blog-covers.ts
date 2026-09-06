/**
 * Genera le cover 1200x630 brandizzate per i post del blog.
 *
 * Uso: npx tsx scripts/generate-blog-covers.ts
 *
 * Per ogni .mdx in content/blog/{locale}/ legge il titolo dal frontmatter,
 * renderizza una pagina HTML (gradiente navy + titolo + logo) con Playwright
 * (chromium headless) e salva lo screenshot in public/images/blog/<slug>.png.
 * Idempotente: rigenera sempre tutte le cover (sovrascrive).
 *
 * NB: aggiornare a mano (o via script) il frontmatter `image:` dei post
 * quando si aggiunge un post nuovo: image: "/images/blog/<slug>.png".
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'content', 'blog');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'blog');
const LOCALES = ['it', 'en', 'fr', 'pt'];

/** Marchio "IM" (stesso disegno di app/icon.svg) + wordmark, inline nell'HTML. */
const LOGO_SVG = `
<svg width="64" height="64" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="52" height="52" rx="15" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
  <text x="28" y="37" text-anchor="middle" font-family="Arial, sans-serif" font-size="23" font-weight="800" letter-spacing="-0.6" fill="#ffffff">IM</text>
  <circle cx="44" cy="13" r="3.6" fill="#f59e0b"/>
</svg>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function coverHtml(title: string, category: string): string {
  // Titoli lunghi → font più piccolo per stare nei 630px
  const fontSize = title.length > 70 ? 52 : title.length > 45 ? 60 : 68;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: Arial, 'Helvetica Neue', sans-serif;
    background: linear-gradient(135deg, #1e3a8a 0%, #172554 100%);
    position: relative; color: #fff;
  }
  .glow {
    position: absolute; inset: 0;
    background: radial-gradient(80% 90% at 85% -10%, rgba(255,255,255,0.18) 0%, transparent 60%);
  }
  .dots {
    position: absolute; inset: 0; opacity: 0.5;
    background-image: radial-gradient(rgba(255,255,255,0.12) 2px, transparent 2px);
    background-size: 48px 48px;
  }
  .content {
    position: relative; height: 100%;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 64px 72px;
  }
  .brand { display: flex; align-items: center; gap: 20px; }
  .brand-name { font-size: 34px; font-weight: 800; letter-spacing: -0.5px; }
  .brand-name .pro { color: #93c5fd; }
  .category {
    display: inline-block; align-self: flex-start;
    background: rgba(255,255,255,0.14); border: 1.5px solid rgba(255,255,255,0.35);
    border-radius: 999px; padding: 10px 26px;
    font-size: 26px; font-weight: 600; letter-spacing: 0.3px;
    margin-bottom: 28px;
  }
  h1 {
    font-size: ${fontSize}px; font-weight: 800; line-height: 1.15;
    letter-spacing: -1px; max-width: 1000px;
  }
  .footer { font-size: 26px; color: rgba(255,255,255,0.75); font-weight: 500; }
  .bar {
    position: absolute; left: 0; top: 0; bottom: 0; width: 14px;
    background: linear-gradient(180deg, #f59e0b 0%, #6366f1 100%);
  }
</style>
</head>
<body>
  <div class="glow"></div>
  <div class="dots"></div>
  <div class="bar"></div>
  <div class="content">
    <div class="brand">
      ${LOGO_SVG}
      <div class="brand-name">InsegnaMi<span class="pro">.pro</span></div>
    </div>
    <div>
      <div class="category">${escapeHtml(category)}</div>
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="footer">insegnami.pro/blog</div>
  </div>
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const posts: { slug: string; title: string; category: string; locale: string }[] = [];
  for (const locale of LOCALES) {
    const dir = path.join(BLOG_DIR, locale);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
      const slug = file.replace(/\.mdx$/, '');
      const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf-8'));
      posts.push({
        slug,
        title: data.title || slug,
        category: data.category || 'Blog',
        locale,
      });
    }
  }

  if (posts.length === 0) {
    console.log('Nessun post trovato, niente da generare.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  for (const post of posts) {
    const outPath = path.join(OUT_DIR, `${post.slug}.png`);
    await page.setContent(coverHtml(post.title, post.category), { waitUntil: 'load' });
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`OK  ${post.locale}/${post.slug} -> public/images/blog/${post.slug}.png`);
  }

  await browser.close();
  console.log(`\nGenerate ${posts.length} cover in public/images/blog/`);
}

main().catch((err) => {
  console.error('Errore nella generazione delle cover:', err);
  process.exit(1);
});
