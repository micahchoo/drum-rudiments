import './style.css';
import { parse, Timeline, type Pattern } from './notation';
import { RUDIMENTS, type Family } from './rudiments';
import { stickHeight, armLift, fingerShare } from './motion';
import { Judge, type Verdict } from './judge';
import { Transport, Mic } from './audio';
import { PadScene } from './scene';
import { drawLane } from './lane';
import { drawStaff } from './staff';
import { HAND_COLOR, JUDGE_COLOR } from './canvas';
import { aboutHtml, jsonLd, pageMeta, rudimentBySlug, slugOf, SITE } from './pages';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// ─── state ───
// the address names the rudiment: /drum-rudiments/single-paradiddle/. The home page shows the last one played.
const BASE = import.meta.env.BASE_URL;
const slugInPath = () => location.pathname.slice(BASE.length).replace(/\/$/, '');
const fromPath = () => { const r = rudimentBySlug(slugInPath()); return r ? RUDIMENTS.indexOf(r) : -1; };
const legacyHash = RUDIMENTS.findIndex(r => r.number === Number(location.hash.slice(1)));   // old #16 links
let rudIndex = [fromPath(), legacyHash, RUDIMENTS.findIndex(r => r.number === Number(store.get('rud')))].find(i => i >= 0) ?? 0;
let bpm = Math.min(240, Math.max(10, Number(store.get('bpm')) || 60));
let mode: 'watch' | 'play' = 'watch';
let pattern: Pattern = parse(RUDIMENTS[rudIndex]!.notation);
let timeline = new Timeline(pattern, 60 / bpm);
const transport = new Transport(timeline);
let judge: Judge | null = null;
let idleT = -1;
let latency = Number(store.get('latency')) || 0;
let threshold = 0.09;
let popup: { text: string; color: string; at: number } | null = null;
let calibration: { times: number[]; diffs: number[] } | null = null;

const scene = new PadScene($<HTMLCanvasElement>('#gl'), $('#vSide'), $('#vFront'));
const mic = new Mic(transport.ac, onMicHit, lvl => { $('#lvl').style.width = `${Math.min(100, Math.sqrt(lvl) * 100)}%`; });

// ─── transport ───
const countIn = () => (mode === 'play' ? (bpm >= 50 ? 4 : bpm >= 25 ? 2 : 1) : 0);
function start() {
  judge = mode === 'play' ? new Judge(timeline) : null;
  renderScore();
  transport.start(countIn());
  drawPlay();
}
function stop() { if (transport.playing) idleT = transport.now(); transport.stop(); drawPlay(); }
const toggle = () => (transport.playing ? stop() : start());

// how the address follows a change: a new history entry, the same entry, or not at all (it already moved)
type Nav = 'push' | 'replace' | 'none';

function setRudiment(i: number, nav: Nav = 'push') {
  const was = transport.playing;
  stop();
  rudIndex = (i + RUDIMENTS.length) % RUDIMENTS.length;
  const r = RUDIMENTS[rudIndex]!;
  pattern = parse(r.notation); timeline = new Timeline(pattern, 60 / bpm); transport.retime(timeline);
  idleT = -1; popup = null;
  $('#rudNum').textContent = String(r.number); $('#rudName').textContent = r.name;
  document.querySelectorAll('#rudMenu button').forEach((b, k) => b.classList.toggle('on', k === rudIndex));
  store.set('rud', String(r.number));
  if (nav !== 'none') history[nav === 'push' ? 'pushState' : 'replaceState'](null, '', `${BASE}${slugOf(r)}/`);
  describePage(r);
  if (was) start();
}

// the parts of the page the build wrote for one rudiment, rewritten for another
function describePage(r: (typeof RUDIMENTS)[number] | null) {
  const m = pageMeta(r), url = `${SITE}${m.path}`;
  document.title = m.title;
  const set = (sel: string, attr: string, v: string) => document.querySelector(sel)?.setAttribute(attr, v);
  set('meta[name=description]', 'content', m.description);
  set('link[rel=canonical]', 'href', url);
  set('meta[property="og:title"]', 'content', m.title);
  set('meta[property="og:description"]', 'content', m.description);
  set('meta[property="og:url"]', 'content', url);
  const ld = document.querySelector('script[type="application/ld+json"]');
  if (ld) ld.textContent = jsonLd(r);
  $('#about').innerHTML = aboutHtml(r, BASE);
}

function setBpm(v: number) {
  bpm = Math.round(Math.min(240, Math.max(10, v || 60)));
  timeline = new Timeline(pattern, 60 / bpm);
  transport.retime(timeline);
  if (judge) judge.timeline = timeline;
  $<HTMLInputElement>('#bpm').value = String(bpm); $<HTMLInputElement>('#bpmNum').value = String(bpm);
  store.set('bpm', String(bpm));
}

function setMode(m: typeof mode) {
  stop();
  mode = m; judge = null; popup = null; idleT = -1;
  document.body.classList.toggle('play', m === 'play');
  for (const [id, on] of [['#mWatch', m === 'watch'], ['#mPlay', m === 'play']] as const) {
    $(id).classList.toggle('on', on); $(id).setAttribute('aria-checked', String(on));
  }
  setSound(m === 'watch');
  renderScore();
}
function setSound(on: boolean) { transport.padSound = on; $('#sound').classList.toggle('on', on); $('#sound').setAttribute('aria-pressed', String(on)); }

// ─── hits ───
function onMicHit(audioTime: number, peak: number) {
  if (calibration) {
    const near = calibration.times.reduce((b, x) => (Math.abs(x - audioTime) < Math.abs(b - audioTime) ? x : b));
    const d = audioTime - near;
    if (calibration.times.indexOf(near) >= 4 && d > -0.1 && d < 0.35) calibration.diffs.push(d);
    return;
  }
  if (judge && transport.playing) show(judge.hit(transport.fromAudio(audioTime) - latency, peak));
}
function tap() { if (judge && transport.playing) show(judge.hit(transport.now(), null)); }

const WORD: Record<Verdict['result'], string> = { perfect: 'perfect', good: 'good', ok: 'ok', miss: 'miss', flat: 'flat', extra: 'extra' };
function show(v: Verdict) {
  const ms = Math.round(Math.abs(v.err) * 1000), sign = v.err < 0 ? '−' : '+';
  let text = v.result === 'good' || v.result === 'ok' ? `${WORD[v.result]} ${sign}${ms}` : WORD[v.result];
  if (v.accent === 'ok') text += ' · accent'; else if (v.accent === 'soft') text += ' · soft accent'; else if (v.accent === 'loud') text += ' · loud tap';
  popup = { text, color: JUDGE_COLOR[v.result], at: performance.now() };
  renderScore();
}

function renderScore() {
  const st = judge?.stats;
  const total = st ? st.perfect + st.good + st.ok + st.miss : 0;
  $('#score').textContent = st ? Math.round(st.score).toLocaleString() : '0';
  $('#combo').textContent = String(st?.combo ?? 0);
  $('#acc').textContent = st && total ? `${Math.round((100 * (st.perfect + 0.7 * st.good + 0.3 * st.ok)) / total)}%` : '–';
  $('#pgo').textContent = st ? `${st.perfect} · ${st.good} · ${st.ok}` : '0 · 0 · 0';
  $('#miss').textContent = st ? `${st.miss} · ${st.extra}` : '0 · 0';
  const errs = st?.errs ?? [];
  if (errs.length) {
    const m = errs.reduce((a, b) => a + b, 0) / errs.length, sd = Math.sqrt(errs.reduce((a, b) => a + (b - m) ** 2, 0) / errs.length);
    $('#off').textContent = `${Math.abs(Math.round(m * 1000))} ms ${m < 0 ? 'early' : 'late'}`;
    $('#sd').textContent = `±${Math.round(sd * 1000)} ms`;
  } else { $('#off').textContent = '–'; $('#sd').textContent = '–'; }
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1]! : NaN; };
  const acc = med(st?.accentPeaks ?? []), taps = med(st?.tapPeaks ?? []);
  $('#gap').textContent = acc && taps ? `${(20 * Math.log10(acc / taps)).toFixed(1)} dB` : '–';
  $('#flam').textContent = `${st?.flams.length ? `${Math.round(med(st.flams) * 1000)} ms` : '–'} · ${st?.flat ?? 0}`;
}

// ─── microphone ───
function setSensitivity(v: number) {
  threshold = 0.005 * Math.pow(10, (100 - v) / 40);
  $('#thMark').style.left = `${Math.min(100, Math.sqrt(threshold) * 100)}%`;
  mic.setThreshold(threshold);
}
async function enableMic() {
  try { await mic.enable(threshold); }
  catch (e) { toast(`Microphone failed: ${(e as Error).message}`); return; }
  $<HTMLButtonElement>('#micOn').textContent = 'On'; $<HTMLButtonElement>('#micOn').disabled = true;
  $<HTMLButtonElement>('#cal').disabled = false; $('#micBtn').classList.add('on');
  setSound(false);
  toast('Microphone on. Pad sound is off, so it hears only you. Calibrate once.');
}
function calibrate() {
  stop();
  calibration = { times: transport.clicks(12, 0.6), diffs: [] };
  $('#latTxt').textContent = 'Hit with each click after the first four…';
  window.setTimeout(() => {
    const d = calibration!.diffs; calibration = null;
    if (d.length < 4) { $('#latTxt').textContent = `Heard ${d.length} hits — try again`; return; }
    latency = [...d].sort((a, b) => a - b)[d.length >> 1]!;
    store.set('latency', String(latency));
    $('#latTxt').textContent = `Latency ${Math.round(latency * 1000)} ms`;
  }, (12 * 0.6 + 1) * 1000);
}

// ─── drawing ───
function frame() {
  const t = transport.playing ? transport.now() : idleT;
  if (judge && transport.playing) {
    const late = judge.sweep(transport.fromAudio(transport.ac.currentTime) - Math.max(latency, transport.outLat));
    if (late.length) show(late[late.length - 1]!);
  }
  for (const hand of ['R', 'L'] as const) {
    const { h, last, gap } = stickHeight(timeline, hand, t);
    const v = last && judge?.verdicts.get(last.n);
    scene.pose(hand, h, armLift(timeline, hand, t), fingerShare(gap), last ? { age: t - last.time, color: v ? JUDGE_COLOR[v.result] : HAND_COLOR[hand] } : null);
  }
  const age = popup ? (performance.now() - popup.at) / 1000 : 9;
  drawLane($<HTMLCanvasElement>('#lane'), timeline, {
    t, playing: transport.playing, verdicts: judge?.verdicts ?? null,
    popup: popup && mode === 'play' ? { text: popup.text, color: popup.color, age } : null,
  });
  const beat = t >= 0 ? (((t / timeline.spb) % pattern.beats) + pattern.beats) % pattern.beats : null;
  drawStaff($<HTMLCanvasElement>('#staff'), pattern, beat);
  scene.render();
  requestAnimationFrame(frame);
}

function drawPlay() {
  const b = $('#play');
  b.innerHTML = transport.playing
    ? '<svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 16 16"><path d="M4.5 2.5v11l9-5.5z" fill="currentColor"/></svg>';
  b.setAttribute('aria-label', transport.playing ? 'Stop' : 'Play');
}

let toastTimer = 0;
function toast(s: string) {
  const el = $('#toast'); el.textContent = s; el.classList.add('show');
  window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove('show'), 3500);
}

// ─── controls ───
function buildMenu() {
  const menu = $('#rudMenu');
  const families: [Family, string][] = [['Roll', 'Roll rudiments'], ['Diddle', 'Diddle rudiments'], ['Flam', 'Flam rudiments'], ['Drag', 'Drag rudiments']];
  for (const [fam, title] of families) {
    const col = document.createElement('div');
    col.innerHTML = `<h4>${title}</h4>`;
    RUDIMENTS.forEach((r, i) => {
      if (r.family !== fam) return;
      const b = document.createElement('button');
      b.innerHTML = `<span>${r.number}</span>${r.name}`;
      b.onclick = () => { setRudiment(i); openMenu(false); };
      col.append(b);
    });
    menu.append(col);
  }
}
function openMenu(open: boolean) {
  $('#rudMenu').classList.toggle('open', open); $('#rudBtn').setAttribute('aria-expanded', String(open));
  if (open) ($('#rudMenu').querySelector<HTMLButtonElement>('button.on') ?? $('#rudMenu').querySelector('button'))?.focus();
}
const blurring = (fn: (e: MouseEvent) => void) => (e: MouseEvent) => { fn(e); (e.currentTarget as HTMLElement).blur(); };

buildMenu();
$('#rudBtn').onclick = () => openMenu(!$('#rudMenu').classList.contains('open'));
$('#mWatch').onclick = blurring(() => setMode('watch'));
$('#mPlay').onclick = blurring(() => setMode('play'));
$('#play').onclick = blurring(toggle);
$<HTMLInputElement>('#bpm').oninput = e => setBpm(Number((e.target as HTMLInputElement).value));
$<HTMLInputElement>('#bpmNum').onchange = e => { setBpm(Number((e.target as HTMLInputElement).value)); (e.target as HTMLElement).blur(); };
$('#slower').onclick = blurring(e => setBpm(bpm - (e.shiftKey ? 1 : 5)));
$('#faster').onclick = blurring(e => setBpm(bpm + (e.shiftKey ? 1 : 5)));
$('#metro').onclick = blurring(() => {
  transport.metronome = !transport.metronome;
  $('#metro').classList.toggle('on', transport.metronome); $('#metro').setAttribute('aria-pressed', String(transport.metronome));
});
$('#sound').onclick = blurring(() => setSound(!transport.padSound));
$('#micBtn').onclick = () => { const open = !$('#micPop').classList.contains('open'); $('#micPop').classList.toggle('open', open); $('#micBtn').setAttribute('aria-expanded', String(open)); };
$('#micOn').onclick = () => void enableMic();
$('#cal').onclick = calibrate;
$<HTMLInputElement>('#sens').oninput = e => setSensitivity(Number((e.target as HTMLInputElement).value));
$('#pill').onclick = () => { const open = !$('#details').classList.contains('open'); $('#details').classList.toggle('open', open); $('#pill').setAttribute('aria-expanded', String(open)); };

window.addEventListener('popstate', () => { const i = fromPath(); if (i >= 0) setRudiment(i, 'none'); else describePage(null); });
// links to other rudiments in the text change the rudiment in place, then go back up to the app
$('#about').addEventListener('click', e => {
  const a = (e.target as HTMLElement).closest('a');
  const r = a && a.origin === location.origin ? rudimentBySlug(a.pathname.slice(BASE.length).replace(/\/$/, '')) : undefined;
  if (!r || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  setRudiment(RUDIMENTS.indexOf(r));
  window.scrollTo(0, 0);
});
window.addEventListener('pointerdown', e => {
  const el = e.target as HTMLElement;
  if (!el.closest('#micPop,#micBtn')) $('#micPop').classList.remove('open');
  if (!el.closest('.picker')) openMenu(false);
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { openMenu(false); $('#micPop').classList.remove('open'); return; }
  const tag = (document.activeElement as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || $('#rudMenu').classList.contains('open')) return;
  if (window.scrollY > innerHeight / 2) return;     // reading the text below: keys scroll the page as usual
  if (e.key === 'ArrowUp') { e.preventDefault(); setBpm(bpm + (e.shiftKey ? 1 : 5)); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); setBpm(bpm - (e.shiftKey ? 1 : 5)); }
  else if (e.key === 'ArrowRight') setRudiment(rudIndex + 1);
  else if (e.key === 'ArrowLeft') setRudiment(rudIndex - 1);
  else if (e.key === 'p' || e.key === 'P') toggle();
  else if (e.code === 'Space') {
    e.preventDefault(); if (e.repeat) return;
    if (mode === 'play' && transport.playing) tap(); else toggle();
  }
});

setBpm(bpm); setSensitivity(50); setMode('watch');
// on a rudiment's own page (or an old #16 link) the address names it; the home page keeps its address and text
if (fromPath() >= 0 || legacyHash >= 0) setRudiment(rudIndex, 'replace'); else { setRudiment(rudIndex, 'none'); describePage(null); }
if (latency) $('#latTxt').textContent = `Latency ${Math.round(latency * 1000)} ms`;
drawPlay(); requestAnimationFrame(frame);
