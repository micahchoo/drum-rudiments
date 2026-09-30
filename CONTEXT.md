# Rudiments — context

A web page that shows the drum rudiments on one practice pad: two hands in
three.js, a note lane, and the written notation, at any tempo from 10 to 240
bpm. Play mode listens through the microphone and scores what it hears.

## Language

- **Rudiment** — one named sticking pattern from the PAS 40 (e.g. Single
  Paradiddle). Written once, in the notation language of `src/notation.ts`.
- **Cycle** — one repetition of a rudiment. Everything loops per cycle.
- **Note** — one written notehead: a start and a duration in beats, a hand,
  maybe an accent, maybe grace notes, maybe buzz.
- **Stroke** — one hit of one stick at one time. A note gives one stroke, plus
  one per grace note. The lane, the hands and the judge all read strokes.
- **Grace** — a quiet stroke just before its note, by the other hand. One grace
  = a **flam**; two = a **drag**.
- **Buzz** — a pressed stroke that bounces many times (multiple bounce roll).
  Scored as one stroke.
- **Stroke type** — full, down, tap, up. Not stored: it falls out of the motion
  model, because after each stroke the stick goes to the height of that hand's
  NEXT stroke.
- **Height** — stick height, 0 = on the pad, 1 = a full accent (~12 in).
  Tap 0.35 (~3 in), grace 0.1 (~1 in).
- **Watch** — the visualisation only. **Play** — adds count-in, microphone and
  score.
- **Sticking is trusted.** One pad, one microphone: the page hears when and how
  loud, never which hand. Nothing may claim to check the hand.
