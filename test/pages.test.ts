import { describe, expect, test } from 'bun:test';
import { RUDIMENTS } from '../src/rudiments';
import { slugOf, sticking, pageMeta, rudimentBySlug } from '../src/pages';

const by = (name: string) => RUDIMENTS.find(r => r.name === name)!;

describe('pages', () => {
  test('every rudiment has its own lowercase, url-safe slug', () => {
    const slugs = RUDIMENTS.map(slugOf);
    expect(new Set(slugs).size).toBe(40);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slugOf(by('Drag Paradiddle #1'))).toBe('drag-paradiddle-1');
  });

  test('a slug finds its rudiment again; an unknown one finds nothing', () => {
    for (const r of RUDIMENTS) expect(rudimentBySlug(slugOf(r))).toBe(r);
    expect(rudimentBySlug('nope')).toBeUndefined();
  });

  test('sticking is written per beat, graces in lowercase, accents marked', () => {
    expect(sticking(by('Single Paradiddle'))).toBe('>R L R R | >L R L L');
    expect(sticking(by('Flam Tap'))).toBe('>lR R >rL L | >lR R >rL L');
    expect(sticking(by('Drag'))).toBe('llR rrL | llR rrL');
  });

  test('titles and descriptions fit what search results show', () => {
    for (const r of RUDIMENTS) {
      const m = pageMeta(r);
      expect(m.title.length).toBeLessThanOrEqual(70);
      expect(m.description.length).toBeGreaterThan(70);
      expect(m.description.length).toBeLessThanOrEqual(160);
      expect(m.title).toContain(r.name);
      expect(m.path).toBe(`${slugOf(r)}/`);
    }
    expect(pageMeta(null).path).toBe('');
  });
});
