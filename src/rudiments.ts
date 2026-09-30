// The 40 PAS International Drum Rudiments, each written out for one cycle in the
// notation language of notation.ts. Rolls are written open: every diddle stroke is
// a note, so the lane and the hands show each one.

export type Family = 'Roll' | 'Diddle' | 'Flam' | 'Drag';
export interface Rudiment { number: number; name: string; family: Family; notation: string }

const r = (number: number, family: Family, name: string, notation: string): Rudiment => ({ number, name, family, notation });

export const RUDIMENTS: Rudiment[] = [
  // I. Roll rudiments — single stroke
  r(1, 'Roll', 'Single Stroke Roll', '16: R L R L R L R L'),
  r(2, 'Roll', 'Single Stroke Four', '3/16: R L R 8: L 3/16: L R L 8: R'),
  r(3, 'Roll', 'Single Stroke Seven', '6/16: R L R L R L q: R 6/16: L R L R L R q: L'),
  // multiple bounce
  r(4, 'Roll', 'Multiple Bounce Roll', '16: Rz Lz Rz Lz Rz Lz Rz Lz'),
  r(5, 'Roll', 'Triple Stroke Roll', '6/16: R R R L L L R R R L L L'),
  // double stroke open
  r(6, 'Roll', 'Double Stroke Open Roll', '16: R R L L R R L L'),
  r(7, 'Roll', 'Five Stroke Roll', '32: R R L L 8: >R 32: L L R R 8: >L'),
  r(8, 'Roll', 'Six Stroke Roll', '16: >R 32: L L R R 16: >L 16: >R 32: L L R R 16: >L'),
  r(9, 'Roll', 'Seven Stroke Roll', '6/16: R R L L R R q: >L 6/16: L L R R L L q: >R'),
  r(10, 'Roll', 'Nine Stroke Roll', '32: R R L L R R L L q: >R 32: L L R R L L R R q: >L'),
  r(11, 'Roll', 'Ten Stroke Roll', '32: R R L L R R L L 8: >R >L'),
  r(12, 'Roll', 'Eleven Stroke Roll', '32: R R L L R R L L R R 16: >L 8: - 32: L L R R L L R R L L 16: >R 8: -'),
  r(13, 'Roll', 'Thirteen Stroke Roll', '32: R R L L R R L L R R L L 8: >R 32: L L R R L L R R L L R R 8: >L'),
  r(14, 'Roll', 'Fifteen Stroke Roll', '32: R R L L R R L L R R L L R R 16: >L 32: L L R R L L R R L L R R L L 16: >R'),
  r(15, 'Roll', 'Seventeen Stroke Roll', '32: R R L L R R L L R R L L R R L L q: >R - 32: L L R R L L R R L L R R L L R R q: >L -'),
  // II. Diddle rudiments
  r(16, 'Diddle', 'Single Paradiddle', '16: >R L R R >L R L L'),
  r(17, 'Diddle', 'Double Paradiddle', '6/16: >R L R L R R >L R L R L L'),
  r(18, 'Diddle', 'Triple Paradiddle', '16: >R L R L R L R R >L R L R L R L L'),
  r(19, 'Diddle', 'Single Paradiddle-Diddle', '6/16: >R L R R L L >R L R R L L'),
  // III. Flam rudiments
  r(20, 'Flam', 'Flam', '8: lR rL lR rL'),
  r(21, 'Flam', 'Flam Accent', '3/8: >lR L R >rL R L'),
  r(22, 'Flam', 'Flam Tap', '16: >lR R >rL L >lR R >rL L'),
  r(23, 'Flam', 'Flamacue', '16: lR >L R L q: >lR'),
  r(24, 'Flam', 'Flam Paradiddle', '16: >lR L R R >rL R L L'),
  r(25, 'Flam', 'Single Flammed Mill', '16: >lR R L R >rL L R L'),
  r(26, 'Flam', 'Flam Paradiddle-Diddle', '6/16: >lR L R R L L >rL R L L R R'),
  r(27, 'Flam', 'Pataflafla', '16: lR L R rL lR L R rL'),
  r(28, 'Flam', 'Swiss Army Triplet', '3/8: lR R L lR R L'),
  r(29, 'Flam', 'Inverted Flam Tap', '16: lR L rL R lR L rL R'),
  r(30, 'Flam', 'Flam Drag', '3/8: >lR 3/16: L L 3/8: R >rL 3/16: R R 3/8: L'),
  // IV. Drag rudiments
  r(31, 'Drag', 'Drag', '8: llR rrL llR rrL'),
  r(32, 'Drag', 'Single Drag Tap', '8: llR >L rrL >R'),
  r(33, 'Drag', 'Double Drag Tap', '8: llR llR >L rrL rrL >R'),
  r(34, 'Drag', 'Lesson 25', '16: llR L 8: >R 16: rrL R 8: >L'),
  r(35, 'Drag', 'Single Dragadiddle', '32: >R R 16: L R R 32: >L L 16: R L L'),
  r(36, 'Drag', 'Drag Paradiddle #1', '8: >R 16: llR L R R 8: >L 16: rrL R L L'),
  r(37, 'Drag', 'Drag Paradiddle #2', '8: >R >llR 16: llR L R R 8: >L >rrL 16: rrL R L L'),
  r(38, 'Drag', 'Single Ratamacue', '3/16: llR L R 8: >L 3/16: rrL R L 8: >R'),
  r(39, 'Drag', 'Double Ratamacue', '8: llR 3/16: llR L R 8: >L 8: rrL 3/16: rrL R L 8: >R'),
  r(40, 'Drag', 'Triple Ratamacue', '8: llR llR 3/16: llR L R 8: >L 8: rrL rrL 3/16: rrL R L 8: >R'),
];
