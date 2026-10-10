import type { Row, Side } from '@uomd/combat';
import { REF_W } from '../config';

export interface Spot {
  x: number;
  y: number;
  /** perspective scale: units lower on screen are slightly larger */
  depthScale: number;
}

const GROUND_TOP = 480;
const GROUND_BOTTOM = 720;
const ROW_X: Record<Side, Record<Row, number>> = {
  player: { front: 700, rear: 400 },
  enemy: { front: REF_W - 700, rear: REF_W - 400 }
};

/**
 * Screen position of a unit. Units of the same row are spread over the ground band (centered when
 * alone), alternating x offsets so tall sprites overlap less. `index`/`count` = place among the
 * living-or-dead members of that row, ordered by slot, so nobody moves when a neighbour falls.
 */
export function spotFor(side: Side, row: Row, index: number, count: number): Spot {
  const span = GROUND_BOTTOM - GROUND_TOP;
  const y = count === 1 ? (GROUND_TOP + GROUND_BOTTOM) / 2 : GROUND_TOP + (span * index) / (count - 1);
  const jitter = count === 1 ? 0 : index % 2 === 0 ? -50 : 50;
  const x = ROW_X[side][row] + jitter * (side === 'player' ? 1 : -1);
  const depthScale = 0.9 + 0.14 * ((y - GROUND_TOP) / span);
  return { x, y, depthScale };
}
