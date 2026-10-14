/**
 * Deterministic component-first sheet slicer and frame normalizer (docs/media/EXPORT_PIPELINE.md §3.4 & §5.4).
 * Pure functions on 8-bit RGBA buffers (plus sharp for Lanczos3 resize and WebP/PNG encoding).
 */
import sharp from 'sharp';

export type LayoutSpec =
  | { mode: 'single' }
  | {
      mode: 'grid';
      cols: number;
      rows: number;
      cells: string[];
      merge_gap_px?: number;
      min_gutter_pct?: number;
    }
  | {
      mode: 'regions';
      cells: Record<string, [number, number, number, number]>;
    };

export interface SliceBox {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
}

export interface SliceResult {
  boxes: SliceBox[];
  warnings: string[];
}

export interface TrimmedFrame {
  name: string;
  data: Buffer;
  width: number;
  height: number;
  alphaArea: number;
  footY: number;
  pivotX: number;
  sourceBox: [number, number, number, number];
}

/**
 * Slices a keyed RGBA buffer into named bounding boxes according to `layout`.
 * - `single`: returns a single cell covering the whole image `[0, 0, width, height]`.
 * - `regions`: returns the explicit rectangles in reading/declaration order.
 * - `grid`: dilates `alpha > 25` by `merge_gap_px`, finds 4-connected components, merges small detached parts
 *   (< 25% of median area) into the nearest large component, orders into `rows` x `cols`, and checks gutters.
 */
export function sliceSheet(
  rgba: Buffer,
  width: number,
  height: number,
  layout: LayoutSpec,
  cellOrder?: number[],
): SliceResult {
  const warnings: string[] = [];
  if (layout.mode === 'single') {
    return {
      boxes: [{ name: 'single', x: 0, y: 0, w: width, h: height, area: width * height }],
      warnings,
    };
  }

  if (layout.mode === 'regions') {
    const boxes: SliceBox[] = [];
    for (const [name, [x, y, w, h]] of Object.entries(layout.cells)) {
      if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) {
        throw new Error(`region "${name}" [${x},${y},${w},${h}] exceeds image bounds ${width}x${height}`);
      }
      let area = 0;
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          if ((rgba[(py * width + px) * 4 + 3] as number) > 25) area++;
        }
      }
      boxes.push({ name, x, y, w, h, area });
    }
    return { boxes, warnings };
  }

  const { cols, rows, cells } = layout;
  const expected = cols * rows;
  if (cells.length !== expected) {
    throw new Error(`grid layout requires cells.length (${cells.length}) === cols * rows (${expected})`);
  }

  const n = width * height;
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if ((rgba[p * 4 + 3] as number) > 25) mask[p] = 1;
  }

  // Separable square dilation by radius r = Math.max(1, Math.round(merge_gap_px / 2))
  const mergeGap = layout.merge_gap_px ?? Math.max(2, Math.round(width * 0.02));
  const r = Math.max(1, Math.round(mergeGap / 2));
  const horiz = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    let count = 0;
    for (let x = 0; x <= Math.min(width - 1, r); x++) count += mask[rowOff + x] as number;
    for (let x = 0; x < width; x++) {
      if (count > 0) horiz[rowOff + x] = 1;
      const addIdx = x + r + 1;
      const remIdx = x - r;
      if (addIdx < width) count += mask[rowOff + addIdx] as number;
      if (remIdx >= 0) count -= mask[rowOff + remIdx] as number;
    }
  }
  const dilated = new Uint8Array(n);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y <= Math.min(height - 1, r); y++) count += horiz[y * width + x] as number;
    for (let y = 0; y < height; y++) {
      if (count > 0) dilated[y * width + x] = 1;
      const addIdx = y + r + 1;
      const remIdx = y - r;
      if (addIdx < height) count += horiz[addIdx * width + x] as number;
      if (remIdx >= 0) count -= horiz[remIdx * width + x] as number;
    }
  }

  // 4-connected components on dilated mask, measuring true undilated bounding box & area
  interface Comp {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    area: number;
  }
  const rawComps: Comp[] = [];
  const seen = new Uint8Array(n);
  const stack: number[] = [];

  for (let s = 0; s < n; s++) {
    if (!dilated[s] || seen[s]) continue;
    seen[s] = 1;
    stack.push(s);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let area = 0;
    while (stack.length > 0) {
      const p = stack.pop() as number;
      const x = p % width;
      const y = (p - x) / width;
      if (mask[p]) {
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (x > 0 && dilated[p - 1] && !seen[p - 1]) {
        seen[p - 1] = 1;
        stack.push(p - 1);
      }
      if (x < width - 1 && dilated[p + 1] && !seen[p + 1]) {
        seen[p + 1] = 1;
        stack.push(p + 1);
      }
      if (y > 0 && dilated[p - width] && !seen[p - width]) {
        seen[p - width] = 1;
        stack.push(p - width);
      }
      if (y < height - 1 && dilated[p + width] && !seen[p + width]) {
        seen[p + width] = 1;
        stack.push(p + width);
      }
    }
    if (area > 0 && maxX >= minX) {
      rawComps.push({ minX, minY, maxX, maxY, area });
    }
  }

  if (rawComps.length < expected) {
    throw new Error(
      `slicer found ${rawComps.length} figure components, expected ${expected} (${cols}x${rows}); figures may touch or be missing`,
    );
  }

  // Merge small detached parts (< 25% of median area) into the nearest large component
  let comps = [...rawComps];
  if (comps.length > expected) {
    const sortedAreas = comps.map((c) => c.area).sort((a, b) => a - b);
    const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)] as number;
    const threshold = medianArea * 0.25;
    const large = comps.filter((c) => c.area >= threshold);
    const small = comps.filter((c) => c.area < threshold);
    if (large.length >= expected) {
      for (const sm of small) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < large.length; i++) {
          const lg = large[i]!;
          const dx = Math.max(0, sm.minX - lg.maxX, lg.minX - sm.maxX);
          const dy = Math.max(0, sm.minY - lg.maxY, lg.minY - sm.maxY);
          const d = Math.hypot(dx, dy);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        const target = large[bestIdx]!;
        target.minX = Math.min(target.minX, sm.minX);
        target.minY = Math.min(target.minY, sm.minY);
        target.maxX = Math.max(target.maxX, sm.maxX);
        target.maxY = Math.max(target.maxY, sm.maxY);
        target.area += sm.area;
      }
      comps = large;
    }
  }

  if (comps.length !== expected) {
    throw new Error(`slicer resolved ${comps.length} components after part merging, expected ${expected} (${cols}x${rows})`);
  }

  // Check for overlapping bounding boxes (A15 fail)
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      const a = comps[i]!;
      const b = comps[j]!;
      const overlapX = a.minX <= b.maxX && b.minX <= a.maxX;
      const overlapY = a.minY <= b.maxY && b.minY <= a.maxY;
      if (overlapX && overlapY) {
        throw new Error(`A15: component bounding boxes ${i} and ${j} overlap and cannot be separated deterministically`);
      }
    }
  }

  // Sort by centroid Y, split into `rows` groups of `cols` items each, then sort each row by centroid X
  const withCentroid = comps.map((c) => ({
    ...c,
    cx: (c.minX + c.maxX) / 2,
    cy: (c.minY + c.maxY) / 2,
  }));
  withCentroid.sort((a, b) => a.cy - b.cy || a.cx - b.cx);

  const ordered: typeof withCentroid = [];
  for (let rIdx = 0; rIdx < rows; rIdx++) {
    const rowSlice = withCentroid.slice(rIdx * cols, (rIdx + 1) * cols);
    rowSlice.sort((a, b) => a.cx - b.cx);
    ordered.push(...rowSlice);
  }

  // Gutter check (A15 warning if < min_gutter_pct of cell width)
  const cellW = width / cols;
  const minGutterPx = cellW * ((layout.min_gutter_pct ?? 4) / 100);
  for (let rIdx = 0; rIdx < rows; rIdx++) {
    for (let cIdx = 0; cIdx < cols - 1; cIdx++) {
      const left = ordered[rIdx * cols + cIdx]!;
      const right = ordered[rIdx * cols + cIdx + 1]!;
      const gap = right.minX - left.maxX - 1;
      if (gap < minGutterPx) {
        warnings.push(`A15: narrow horizontal gutter (${gap}px < ${Math.round(minGutterPx)}px) between row ${rIdx + 1} col ${cIdx + 1} and ${cIdx + 2}`);
      }
    }
  }

  // Area balance check (A14)
  const areas = ordered.map((c) => c.area).sort((a, b) => a - b);
  const medArea = areas[Math.floor(areas.length / 2)] as number;
  for (let i = 0; i < ordered.length; i++) {
    const ratio = ordered[i]!.area / medArea;
    if (ratio < 0.35 || ratio > 3.0) {
      throw new Error(`A14: cell ${i} area (${ordered[i]!.area}) is outside 0.35..3.0x median (${medArea})`);
    }
  }

  const boxes: SliceBox[] = ordered.map((c, idx) => {
    const mappedIdx = cellOrder ? (cellOrder[idx] ?? idx) : idx;
    const name = cells[mappedIdx];
    if (!name) throw new Error(`missing cell name at index ${mappedIdx}`);
    return {
      name,
      x: c.minX,
      y: c.minY,
      w: c.maxX - c.minX + 1,
      h: c.maxY - c.minY + 1,
      area: c.area,
    };
  });

  return { boxes, warnings };
}

/**
 * Trims a slice box on `alpha > 12` and computes `foot_y` (from the lowest row with `alpha >= 128`)
 * and `pivot_x` (alpha-weighted centroid of the lowest 35% of the figure or whole figure).
 */
export async function trimAndMeasureFrame(
  rgba: Buffer,
  imgWidth: number,
  imgHeight: number,
  box: SliceBox,
  pivotMode: 'lower_body_centroid' | 'alpha_centroid' = 'lower_body_centroid',
): Promise<TrimmedFrame> {
  let minX = box.x + box.w;
  let minY = box.y + box.h;
  let maxX = -1;
  let maxY = -1;
  let alphaArea = 0;

  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const a = rgba[(y * imgWidth + x) * 4 + 3] as number;
      if (a > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        alphaArea++;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    throw new Error(`frame "${box.name}" is completely transparent`);
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  let groundRow = h - 1;
  for (let ry = h - 1; ry >= 0; ry--) {
    let foundOpaque = false;
    const y = minY + ry;
    for (let x = minX; x <= maxX; x++) {
      if ((rgba[(y * imgWidth + x) * 4 + 3] as number) >= 128) {
        foundOpaque = true;
        break;
      }
    }
    if (foundOpaque) {
      groundRow = ry;
      break;
    }
  }

  const rawFootY = (groundRow + 1) / h;
  const footY = Math.round(Math.min(1.0, Math.max(0.9, rawFootY)) * 1000) / 1000;

  const yStart = pivotMode === 'lower_body_centroid' ? minY + Math.floor(h * 0.65) : minY;
  let sumA = 0;
  let sumAx = 0;
  for (let y = yStart; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = rgba[(y * imgWidth + x) * 4 + 3] as number;
      if (a > 12) {
        sumA += a;
        sumAx += a * (x - minX);
      }
    }
  }
  const pivotX = sumA > 0 ? Math.round(((sumAx / sumA) / w) * 1000) / 1000 : 0.5;

  const data = await sharp(rgba, { raw: { width: imgWidth, height: imgHeight, channels: 4 } })
    .extract({ left: minX, top: minY, width: w, height: h })
    .png()
    .toBuffer();

  return {
    name: box.name,
    data,
    width: w,
    height: h,
    alphaArea,
    footY,
    pivotX,
    sourceBox: [minX, minY, w, h],
  };
}
