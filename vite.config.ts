import { defineConfig, type Plugin } from 'vite';
import { RUDIMENTS, type Rudiment } from './src/rudiments';
import { aboutHtml, headHtml, sitemapXml, slugOf } from './src/pages';

const BASE = '/drum-rudiments/';

// The app is one page, but a search engine should find a page per rudiment. The build
// fills the home page's head and text, then writes a copy for each rudiment with its
// own title, description and text, plus a sitemap. In development the page is filled
// for whichever rudiment the address names.
function pages(): Plugin {
  const fill = (html: string, r: Rudiment | null) => html.replace('<!--head-->', headHtml(r)).replace('<!--about-->', aboutHtml(r, BASE));
  return {
    name: 'rudiment-pages',
    enforce: 'post',          // after Vite has emitted index.html
    transformIndexHtml(html, ctx) {
      if (!ctx.server) return html;
      const slug = (ctx.originalUrl ?? '').replace(BASE, '').split(/[/?#]/)[0] ?? '';
      return fill(html, RUDIMENTS.find(r => slugOf(r) === slug) ?? null);
    },
    generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;
      const template = String(index.source);
      index.source = fill(template, null);
      for (const r of RUDIMENTS) this.emitFile({ type: 'asset', fileName: `${slugOf(r)}/index.html`, source: fill(template, r) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml() });
    },
  };
}

export default defineConfig({ base: BASE, plugins: [pages()] });
