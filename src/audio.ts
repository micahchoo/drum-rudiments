// The Web Audio clock is the one clock. Strokes and clicks are scheduled on it a
// little ahead; the screen reads it back, minus the output latency, so what you see
// is what you hear.

import type { Timeline, Stroke } from './notation';

const AHEAD = 0.12;       // s scheduled in advance
const TICK = 25;          // ms between scheduler runs

export class Transport {
  readonly ac = new AudioContext({ latencyHint: 'interactive' });
  readonly outLat = (this.ac.outputLatency || 0) + (this.ac.baseLatency || 0);
  playing = false;
  metronome = true;
  padSound = true;
  private T0 = 0;           // audio time of beat 0
  private nextStroke = 0;
  private nextTick = 0;     // in subdivisions
  private timer = 0;
  private readonly noise: AudioBuffer;

  constructor(public timeline: Timeline) {
    const n = this.ac.createBuffer(1, this.ac.sampleRate * 0.1, this.ac.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    this.noise = n;
  }

  get spb() { return this.timeline.spb; }
  // seconds from beat 0 that the listener is hearing now
  now() { return this.ac.currentTime - this.outLat - this.T0; }
  // seconds from beat 0 of an audio-clock time
  fromAudio(t: number) { return t - this.T0; }

  start(countInBeats: number) {
    void this.ac.resume();
    this.T0 = this.ac.currentTime + 0.15 + countInBeats * this.spb;
    this.nextStroke = 0;
    this.nextTick = -countInBeats * this.subdivisions();
    this.playing = true;
    this.timer = window.setInterval(() => this.schedule(), TICK);
    this.schedule();
  }

  stop() { this.playing = false; window.clearInterval(this.timer); }

  // A new tempo keeps the beat you are on.
  retime(timeline: Timeline) {
    if (this.playing) {
      const beat = (this.ac.currentTime - this.T0) / this.spb, sub = this.subdivisions();
      this.T0 = this.ac.currentTime - beat * timeline.spb;
      this.timeline = timeline;
      this.nextTick = Math.ceil(this.nextTick / sub * this.subdivisions()) ;
    } else this.timeline = timeline;
  }

  // below 40 bpm the beats are far apart, so the click also marks eighths, then sixteenths
  private subdivisions() { const bpm = 60 / this.spb; return bpm < 25 ? 4 : bpm < 40 ? 2 : 1; }

  private schedule() {
    const horizon = this.ac.currentTime + AHEAD, sub = this.subdivisions(), beats = this.timeline.pattern.beats;
    for (let t = this.T0 + this.nextTick / sub * this.spb; t < horizon; t = this.T0 + this.nextTick / sub * this.spb) {
      const k = this.nextTick++;
      if (!this.metronome && k >= 0) continue;
      if (k % sub !== 0) this.click(t, 0.05, 800);
      else { const beat = k / sub; this.click(t, ((beat % beats) + beats) % beats === 0 ? 0.3 : 0.16, beat % beats === 0 ? 1600 : 1100); }
    }
    for (let s = this.timeline.stroke(this.nextStroke); this.T0 + s.time < horizon; s = this.timeline.stroke(++this.nextStroke)) {
      if (this.padSound) this.pad(this.T0 + s.time, s);
    }
  }

  private click(t: number, gain: number, freq: number) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(this.ac.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.start(t); o.stop(t + 0.05);
  }

  private pad(t: number, s: Stroke) {
    const src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    src.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.8;
    g.gain.value = s.level === 'accent' ? 1.2 : s.level === 'grace' ? 0.12 : 0.35;
    src.connect(f); f.connect(g); g.connect(this.ac.destination);
    if (s.buzz) src.playbackRate.value = 0.7;
    src.start(t);
  }

  // a count-in style run of clicks, for calibration; returns their audio times
  clicks(count: number, every: number): number[] {
    const t0 = this.ac.currentTime + 0.5;
    return Array.from({ length: count }, (_, i) => { const t = t0 + i * every; this.click(t, i % 4 ? 0.16 : 0.3, i % 4 ? 1100 : 1600); return t; });
  }
}

// ─── microphone: onsets found in an AudioWorklet, sample-accurate ───

const WORKLET = `
class Onset extends AudioWorkletProcessor {
  constructor() { super(); this.th = 0.09; this.floor = 0.001; this.last = -1; this.collect = 0; this.peak = 0; this.trig = 0; this.lvl = 0; this.blocks = 0;
    this.port.onmessage = e => { if (e.data.th != null) this.th = e.data.th; }; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]; if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]), t = currentTime + i / sampleRate;
      this.floor += (a - this.floor) * 0.0005;
      if (a > this.lvl) this.lvl = a;
      if (this.collect > 0) {
        if (a > this.peak) this.peak = a;
        if (--this.collect === 0) this.port.postMessage({ t: this.trig, peak: this.peak });
      } else if (a > this.th && a > this.floor * 6 && t - this.last > 0.012) {
        this.trig = t; this.last = t; this.peak = a; this.collect = Math.round(sampleRate * 0.006);
      }
    }
    if (++this.blocks % 6 === 0) { this.port.postMessage({ lvl: this.lvl }); this.lvl = 0; }
    return true;
  }
}
registerProcessor('onset', Onset);`;

export class Mic {
  private node: AudioWorkletNode | null = null;
  constructor(private readonly ac: AudioContext, private readonly onHit: (audioTime: number, peak: number) => void, private readonly onLevel: (l: number) => void) {}

  get on() { return this.node !== null; }

  async enable(threshold: number) {
    await this.ac.resume();
    // the browser's voice processing deletes drum hits: turn all of it off
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    await this.ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })));
    const node = new AudioWorkletNode(this.ac, 'onset'), sink = this.ac.createGain();
    sink.gain.value = 0;
    this.ac.createMediaStreamSource(stream).connect(node); node.connect(sink); sink.connect(this.ac.destination);
    node.port.onmessage = (e: MessageEvent<{ t: number; peak: number } | { lvl: number }>) => {
      if ('lvl' in e.data) this.onLevel(e.data.lvl); else this.onHit(e.data.t, e.data.peak);
    };
    this.node = node;
    this.setThreshold(threshold);
  }

  setThreshold(th: number) { this.node?.port.postMessage({ th }); }
}
