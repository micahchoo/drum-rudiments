# Handoff — rudiments

State 2026-09-29: the final build works. `bun run check` passes: 75 tests, tsc and vite build.
Run it with `bunx vite`. Read `CONTEXT.md` for the vocabulary.

## Not done
- The microphone path (`src/audio.ts#Mic`, calibration in `src/main.ts`) has never
  heard a real pad. The onset threshold and the `floor * 6` retrigger guard are guesses.
- The chart's 31 hybrid rudiments are not in `src/rudiments.ts`. The notation
  language can write most of them. Cheese needs a buzz on a flam (`lRz`), which the
  parser already accepts.
- Not a git repository yet.

## Where the decisions live
- Stroke types come from `src/motion.ts`. Nothing stores them. Change a height there,
  not in the scene.
- `src/rig.ts` is elbow → forearm → wrist → hand (American grip, rolled 0.5 rad)
  → fulcrum → stick, with jointed fingers. Each pose solves the wrist angle by
  Newton's method, so that height 0 puts the tip on the pad, whatever the forearm
  and fingers do. `test/rig.test.ts` holds that to 2 mm. The contact point comes
  out of the chain; the chain is not built from it.
- Fast strokes are finger strokes: `motion.ts#fingerShare(gap)` hands up to 70% of
  the turn to the fingers, and the back fingers open as the butt drops.
- Hand tracking (MediaPipe) was considered, 2026-09-29, for checking sticking in
  Play mode (the mic cannot tell hands apart). It is not for driving the animation:
  it cannot see the stick, and it loses fast hands.
- Grace notes sit inside the gap before their note (`Timeline`). The strictly
  increasing test in `test/notation.test.ts` keeps them from crossing it at 240 bpm.
- The throwaway A/B and v2 prototypes live on the `prototypes` branch. Layout A (the lane leads) won.
