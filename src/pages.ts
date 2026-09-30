// One page per rudiment: its address, its title and description, and the text under
// the app. The build writes each page with this module; the app, moving between
// rudiments without a reload, rewrites the same parts with it. One source for both.

import { parse } from './notation';
import { RUDIMENTS, type Family, type Rudiment } from './rudiments';

export const SITE = 'https://micahchoo.github.io/drum-rudiments/';
export const NAME = 'Drum Rudiments Trainer';

export const slugOf = (r: Rudiment) => r.name.toLowerCase().replace(/#/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const rudimentBySlug = (slug: string) => RUDIMENTS.find(r => slugOf(r) === slug);

// ">R L R R | >L R L L": a note per word, a beat per bar, graces lowercase before their note
export function sticking(r: Rudiment): string {
  const beats: string[][] = [];
  for (const n of parse(r.notation).notes) {
    const grace = (n.hand === 'R' ? 'l' : 'r').repeat(n.graces);
    (beats[Math.floor(n.start + 1e-9)] ??= []).push(`${n.accent ? '>' : ''}${grace}${n.hand}${n.buzz ? 'z' : ''}`);
  }
  return beats.filter(Boolean).map(b => b.join(' ')).join(' | ');
}

export interface Meta { title: string; description: string; path: string }

export function pageMeta(r: Rudiment | null): Meta {
  if (!r) return {
    title: `${NAME} – All 40 PAS Rudiments with 3D Hands`,
    description: 'Learn all 40 PAS drum rudiments on a practice pad: animated 3D hands, notation and a note lane from 10 to 240 bpm, and a play-along score.',
    path: '',
  };
  const long = `${r.name} – Drum Rudiment #${r.number} | ${NAME}`;
  const title = long.length <= 70 ? long : `${r.name} – Drum Rudiment #${r.number}`;
  const st = sticking(r);
  const lead = `Learn the ${r.name}, PAS drum rudiment #${r.number}`;
  const withSticking = `${lead}, sticking ${st.replace(/ \| /g, ' ')}. Animated 3D hands, notation and a play-along score, 10–240 bpm.`;
  const description = withSticking.length <= 160 ? withSticking : `${lead}. Animated 3D hands, notation and a note lane from 10 to 240 bpm, then play along and get scored.`;
  return { title, description, path: `${slugOf(r)}/` };
}

// ─── the text under the app ───

const HOW: Record<Family, string> = {
  Roll: 'The rolls here are written open: every stroke of every diddle is a note. At slow tempos play each diddle as two wrist strokes; as the tempo rises, let the second stroke come from the rebound and the fingers. Put the accent on the release.',
  Diddle: 'Each group starts with an accent. After it, the stick stops low for the taps – a down stroke – and it rises again on the last tap before the next accent – an up stroke.',
  Flam: 'Start the two sticks at two heights: the grace note about an inch off the pad, the main note from full height. Drop them together; the low stick lands first. The hand that played the grace stays low, and the other hand comes back up.',
  Drag: 'The two grace notes are one low stroke that bounces twice, played close to the main note. Keep the grace hand low before it plays, and do not let the two grace notes get louder than a whisper.',
};
const FAMILY_TITLE: Record<Family, string> = { Roll: 'Roll rudiments', Diddle: 'Diddle rudiments', Flam: 'Flam rudiments', Drag: 'Drag rudiments' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function index(base: string, current: Rudiment | null) {
  return (['Roll', 'Diddle', 'Flam', 'Drag'] as Family[]).map(f => `
    <section><h3>${FAMILY_TITLE[f]}</h3><ol>${RUDIMENTS.filter(r => r.family === f).map(r =>
      `<li value="${r.number}"><a href="${base}${slugOf(r)}/"${r === current ? ' aria-current="page"' : ''}>${esc(r.name)}</a></li>`).join('')}</ol></section>`).join('');
}

// base: the site's path, e.g. "/drum-rudiments/"
export function aboutHtml(r: Rudiment | null, base: string): string {
  const intro = r
    ? `<h2>How to play the ${esc(r.name)}</h2>
      <p class="sticking" aria-label="Sticking">${esc(sticking(r))}</p>
      <p>${esc(HOW[r.family])}</p>
      <p>${esc(r.name)} is number ${r.number} of the 40 International Drum Rudiments of the Percussive Arts Society, in the ${r.family.toLowerCase()} family. Above, it plays on one practice pad: the side view and your own view show the stick heights, the lane shows each stroke falling to the beat, and the notation shows where you are in it. Slow it down as far as 10 bpm in Watch mode. In Play mode, hit a pad near your microphone, and every stroke is scored for timing, accents and flam spread.</p>`
    : `<h2>Learn the 40 drum rudiments</h2>
      <p>${NAME} shows every rudiment of the Percussive Arts Society's 40 on one practice pad. Two hands play it in 3D, from the side and from where you sit; a lane shows each stroke falling to the beat; and the notation follows along. Set any tempo from 10 to 240 bpm.</p>
      <p>Watch mode is the picture alone. Play mode counts you in and listens through your microphone: each hit is scored against the beat, accents against your own taps, and flams by the space between the two notes. The microphone hears when and how hard, not which hand, so the sticking is on your honour.</p>`;
  return `${intro}
    <h2>All 40 PAS drum rudiments</h2>
    <nav class="index" aria-label="All rudiments">${index(base, r)}</nav>
    <p class="credit">Made by <a href="https://micahchoo.github.io/">Micah Alex</a>. Source on <a href="https://github.com/micahchoo/drum-rudiments">GitHub</a>. Rudiment list: <a href="https://pas.org/rudiments/">Percussive Arts Society</a>.</p>`;
}

export function jsonLd(r: Rudiment | null): string {
  const app = { '@type': 'WebApplication', name: NAME, url: SITE, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', browserRequirements: 'Requires WebGL and Web Audio', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: 'Micah Alex', url: 'https://micahchoo.github.io/' } };
  const data = r
    ? { '@context': 'https://schema.org', '@type': 'LearningResource', name: `${r.name} (drum rudiment #${r.number})`, url: `${SITE}${slugOf(r)}/`, description: pageMeta(r).description, learningResourceType: 'Interactive exercise', educationalLevel: 'Beginner to advanced', teaches: `Drum rudiment: ${r.name}`, isPartOf: app }
    : { '@context': 'https://schema.org', ...app, description: pageMeta(null).description };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// everything a page's <head> says about it
export function headHtml(r: Rudiment | null): string {
  const m = pageMeta(r), url = `${SITE}${m.path}`, image = `${SITE}og.png`;
  return `<title>${esc(m.title)}</title>
<meta name="description" content="${esc(m.description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(m.title)}">
<meta property="og:description" content="${esc(m.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd(r)}</script>`;
}

export function sitemapXml(): string {
  const urls = [SITE, ...RUDIMENTS.map(r => `${SITE}${slugOf(r)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
}
