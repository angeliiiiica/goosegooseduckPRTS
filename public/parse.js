/* Conference-screenshot parser. Pure functions over ImageData-like objects
 * ({data: Uint8ClampedArray RGBA, width, height}) so it runs in the browser
 * and in Node (for tuning). No DOM access here. */
(function (root) {
  'use strict';

  // Card grids measured on a 1920x1080 meeting screen. All rects relative to the card.
  //  grid: chat closed, 4x4 cards.
  //  chat: chat panel open on the right; smaller cards, 4 in the top row then 3 per row.
  const LAYOUTS = {
    grid: {
      refW: 1920, refH: 1080,
      x0: 147, y0: 224,      // top-left card
      w: 326, h: 178,        // card size
      dx: 400, dy: 210,      // pitch
      pos: (i) => [i % 4, Math.floor(i / 4)],
      strip: { x: 4, y: 142, w: 318, h: 34 },   // whole name strip
      name: { x: 8, y: 144, w: 312, h: 28 },    // name text area
      icon: { x: 2, y: 18, w: 120, h: 120 },    // portrait square
      xmark: { x: 104, y: 8, w: 136, h: 132 },  // where the red death X is drawn
    },
    chat: {
      refW: 1920, refH: 1080,
      x0: 74, y0: 202,
      w: 264, h: 150,
      dx: 346, dy: 175.6,
      pos: (i) => (i < 4 ? [i, 0] : [(i - 4) % 3, 1 + Math.floor((i - 4) / 3)]),
      strip: { x: 4, y: 115, w: 256, h: 30 },
      name: { x: 6, y: 117, w: 254, h: 28 },
      icon: { x: 0, y: 8, w: 104, h: 104 },
      xmark: { x: 80, y: 4, w: 110, h: 106 },
    },
  };
  const SLOTS = 16;
  const LAYOUT = LAYOUTS.grid;

  const DEFAULT_CAL = { offX: 0, offY: 0, scale: 1 };

  /** Map reference-space coords onto the screenshot. UI scales with height
   *  and is centred horizontally (holds for 16:9; calibration covers the rest). */
  function transform(W, H, cal) {
    cal = Object.assign({}, DEFAULT_CAL, cal || {});
    const s = Math.min(W / LAYOUT.refW, H / LAYOUT.refH) * cal.scale;
    const ox = (W - LAYOUT.refW * s) / 2 + cal.offX * s;
    const oy = (H - LAYOUT.refH * s) / 2 + cal.offY * s;
    return { s, ox, oy };
  }

  /** All 16 card rectangles in screenshot pixel space. */
  function cardRects(W, H, cal, layout) {
    const L = LAYOUTS[layout] || LAYOUT;
    const { s, ox, oy } = transform(W, H, cal);
    const out = [];
    for (let i = 0; i < SLOTS; i++) {
      const [c, r] = L.pos(i);
      const x = ox + (L.x0 + c * L.dx) * s;
      const y = oy + (L.y0 + r * L.dy) * s;
      const sub = (k) => ({
        x: x + L[k].x * s, y: y + L[k].y * s,
        w: L[k].w * s, h: L[k].h * s,
      });
      out.push({
        index: i, row: r, col: c,
        card: { x, y, w: L.w * s, h: L.h * s },
        name: sub('name'), icon: sub('icon'), xmark: sub('xmark'), strip: sub('strip'),
      });
    }
    return out;
  }

  function lum(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

  function clampRect(img, r) {
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(img.width, Math.ceil(r.x + r.w)), y1 = Math.min(img.height, Math.ceil(r.y + r.h));
    return { x0, y0, x1, y1 };
  }

  /** Luma mean/std, fraction of "X-red" pixels, fraction of bright pixels. */
  function regionStats(img, r) {
    const { x0, y0, x1, y1 } = clampRect(img, r);
    const d = img.data, W = img.width;
    let n = 0, sum = 0, sq = 0, red = 0, bright = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        const L = lum(d, i);
        sum += L; sq += L * L; n++;
        const R = d[i], G = d[i + 1], B = d[i + 2];
        if (R > 150 && G < 60 && B < 60 && R - G > 110) red++;
        if (L > 200) bright++;
      }
    }
    if (!n) return { mean: 0, std: 0, red: 0, bright: 0 };
    const mean = sum / n;
    return { mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)), red: red / n, bright: bright / n };
  }

  /** Bilinear crop+resize into a fresh ImageData-like object. */
  function crop(img, r, outW, outH) {
    const out = { width: outW, height: outH, data: new Uint8ClampedArray(outW * outH * 4) };
    const d = img.data, W = img.width, H = img.height;
    for (let y = 0; y < outH; y++) {
      const sy = Math.min(H - 1, Math.max(0, r.y + (y + 0.5) * r.h / outH - 0.5));
      const y0 = Math.floor(sy), y1 = Math.min(H - 1, y0 + 1), fy = sy - y0;
      for (let x = 0; x < outW; x++) {
        const sx = Math.min(W - 1, Math.max(0, r.x + (x + 0.5) * r.w / outW - 0.5));
        const x0 = Math.floor(sx), x1 = Math.min(W - 1, x0 + 1), fx = sx - x0;
        const o = (y * outW + x) * 4;
        for (let k = 0; k < 4; k++) {
          const a = d[(y0 * W + x0) * 4 + k], b = d[(y0 * W + x1) * 4 + k];
          const c = d[(y1 * W + x0) * 4 + k], e = d[(y1 * W + x1) * 4 + k];
          out.data[o + k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
        }
      }
    }
    return out;
  }

  /** Clear ink blobs that can't be part of the name: specks, and blobs cut by the crop edge
   *  such as the strip's border lines, a role badge hanging over the right end or a label
   *  poking in from below. Glyphs sit inside the crop with a margin, so they rarely touch an edge. */
  function dropStrayBlobs(ink, w, h, minArea) {
    const seen = new Uint8Array(w * h), stack = [];
    for (let start = 0; start < w * h; start++) {
      if (!ink[start] || seen[start]) continue;
      const blob = [];
      let x0 = w, x1 = 0, y0 = h, y1 = 0;
      seen[start] = 1; stack.push(start);
      while (stack.length) {
        const p = stack.pop(); blob.push(p);
        const x = p % w, y = (p / w) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && ink[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
        if (x < w - 1 && ink[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
        if (y > 0 && ink[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
        if (y < h - 1 && ink[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
      }
      const edges = (x0 === 0) + (x1 === w - 1) + (y0 === 0) + (y1 === h - 1);
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const stray = blob.length < minArea
        || (edges && (edges >= 2 || bw > 1.5 * h || bh < 0.35 * h));
      if (stray) for (const p of blob) ink[p] = 0;
    }
  }

  /** Name strip -> upscaled, binarised black-on-white bitmap for OCR.
   *  Live cards: dark text on white. Dead cards: light text on dark. */
  function nameBitmap(img, rect, upscale) {
    upscale = upscale || 4;
    const w = Math.max(1, Math.round(rect.w * upscale)), h = Math.max(1, Math.round(rect.h * upscale));
    const c = crop(img, rect, w, h);
    const d = c.data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += lum(d, i);
    const mean = sum / (w * h);
    const lightBg = mean > 128;
    // Otsu threshold on luma
    const hist = new Array(256).fill(0);
    for (let i = 0; i < d.length; i += 4) hist[Math.round(lum(d, i))]++;
    const total = w * h;
    let sumAll = 0; for (let t = 0; t < 256; t++) sumAll += t * hist[t];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sumAll - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t; }
    }
    const ink = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const L = lum(d, i);
      ink[p] = (lightBg ? L < thr : L > thr) ? 1 : 0;
    }
    dropStrayBlobs(ink, w, h, 1.5 * upscale * upscale);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = ink[p] ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    // white padding helps tesseract with tight crops
    const pad = Math.round(8 * upscale);
    const P = { width: w + pad * 2, height: h + pad * 2, data: new Uint8ClampedArray((w + pad * 2) * (h + pad * 2) * 4).fill(255) };
    for (let y = 0; y < h; y++) {
      P.data.set(d.subarray(y * w * 4, (y + 1) * w * 4), ((y + pad) * P.width + pad) * 4);
    }
    return { bitmap: P, lightBg };
  }

  /** Name strip shape: how much of it is one flat colour (a plate with a little text on it), that
   *  colour's luma, and the mean luma of the portrait just above it. */
  function stripInfo(img, rc) {
    const { x0, y0, x1, y1 } = clampRect(img, rc.strip);
    const d = img.data, W = img.width;
    const hist = new Array(16).fill(0);
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) { hist[Math.min(15, lum(d, (y * W + x) * 4) >> 4)]++; n++; }
    }
    if (!n) return { flat: 0, luma: 0, above: 0 };
    let mode = 0;
    for (let b = 1; b < 16; b++) if (hist[b] > hist[mode]) mode = b;
    const flat = (hist[mode] + (hist[mode - 1] || 0) + (hist[mode + 1] || 0)) / n;
    const above = regionStats(img, { x: rc.strip.x, y: rc.strip.y - rc.strip.h * 0.6, w: rc.strip.w, h: rc.strip.h * 0.4 });
    return { flat, luma: mode * 16 + 8, above: above.mean };
  }

  /** A live card's name strip: flat and clearly brighter than the portrait above it. */
  const liveStrip = (si) => si.flat > 0.55 && si.luma - si.above > 50;

  /** Classify every slot of one layout. */
  function classify(img, cal, layout) {
    return cardRects(img.width, img.height, cal, layout).map((rc) => {
      const iconS = regionStats(img, rc.icon);
      const nameS = regionStats(img, rc.name);
      const xS = regionStats(img, rc.xmark);
      const si = stripInfo(img, rc);
      // Empty slots are near-uniform dark panels; occupied ones have a portrait (high variance) above
      // a flat name plate: white with dark text (alive) or dimmed with light text (dead). The flat plate
      // keeps a busy picture that isn't a meeting screen from passing as a row of cards.
      const occupied = iconS.std > 18 && si.flat > 0.5 && (nameS.std > 25 || nameS.mean > 150);
      // Dead cards: dimmed (dark) name strip and a red X right of the portrait.
      const dead = occupied && (xS.red > 0.06 || (nameS.mean < 140 && xS.red > 0.02));
      return { index: rc.index, occupied, dead, live: occupied && liveStrip(si), rects: rc, stats: { icon: iconS, name: nameS, xmark: xS } };
    });
  }

  /** Which card layout the screenshot uses: the one whose live name strips line up with more cards,
   *  then (a screen where every card is dead) the one that finds more cards at all. */
  function detectLayout(img, cal) {
    let best = 'grid', bestScore = -1;
    for (const id of Object.keys(LAYOUTS)) {
      const slots = classify(img, cal, id);
      const score = slots.filter((x) => x.live).length * 100 + slots.filter((x) => x.occupied).length;
      if (score > bestScore) { best = id; bestScore = score; }
    }
    return best;
  }

  /** Classify every slot. Returns [{index, occupied, dead, live, rects, stats}]. A meeting always has a
   *  few players alive; with fewer than MIN_LIVE white name strips this isn't one (or the boxes are off
   *  the cards), and every slot counts as empty rather than reading junk off a map or a desktop. */
  const MIN_LIVE = 3;
  function analyze(img, cal, layout) {
    const slots = classify(img, cal, layout);
    if (slots.filter((x) => x.live).length < MIN_LIVE) for (const x of slots) { x.occupied = false; x.dead = false; x.live = false; }
    return slots;
  }

  /** Cards fill the grid from the first slot; a gap means some boxes are probably off their cards. */
  function tidyGrid(slots) {
    const first = slots.findIndex((x) => !x.occupied);
    return first < 0 || slots.slice(first).every((x) => !x.occupied);
  }

  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

  /** Normalise OCR output into a player name: Latin letters, digits, _ and Chinese characters.
   *  Spaces are dropped (tesseract puts them between Chinese characters). */
  function cleanName(s) {
    return Array.from((s || '').normalize('NFKC').toUpperCase())
      .filter((ch) => /[A-Z0-9_]/.test(ch) || CJK.test(ch)).join('').slice(0, 20);
  }

  /** Pick a name from several OCR passes: sum confidence per candidate. */
  function voteName(results) {
    const score = new Map();
    for (const r of results) {
      const t = cleanName(r.text); if (!t) continue;
      const e = score.get(t) || { sum: 0, max: 0 };
      e.sum += r.confidence; e.max = Math.max(e.max, r.confidence);
      score.set(t, e);
    }
    let best = '', bs = null;
    for (const [t, e] of score) {
      if (!bs || e.sum > bs.sum || (e.sum === bs.sum && e.max > bs.max)) { best = t; bs = e; }
    }
    return { name: best, confidence: bs ? bs.max : 0 };
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  /** Snap an OCR'd name onto a known one if it's within a small edit distance. */
  function snapName(name, known) {
    let best = null, bd = Infinity;
    for (const k of known) {
      const d = levenshtein(name, k);
      if (d < bd) { bd = d; best = k; }
    }
    // a Chinese character carries more than a letter: a 2-character name must match exactly
    const tol = CJK.test(name) ? (name.length <= 2 ? 0 : name.length <= 5 ? 1 : 2) : name.length <= 4 ? 1 : 2;
    return best !== null && bd <= tol ? best : null;
  }

  const hasCJK = (s) => CJK.test(s);

  const api = { tidyGrid, hasCJK, voteName, levenshtein, snapName, LAYOUT, LAYOUTS, DEFAULT_CAL, detectLayout, transform, cardRects, regionStats, crop, nameBitmap, analyze, cleanName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GGDParse = api;
})(typeof self !== 'undefined' ? self : this);
