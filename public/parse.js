/* Conference-screenshot parser. Pure functions over ImageData-like objects
 * ({data: Uint8ClampedArray RGBA, width, height}) so it runs in the browser
 * and in Node (for tuning). No DOM access here. */
(function (root) {
  'use strict';

  // Card grid measured on a 1920x1080 meeting screen.
  const LAYOUT = {
    refW: 1920, refH: 1080,
    cols: 4, rows: 4,
    x0: 147, y0: 224,      // top-left card
    w: 326, h: 178,        // card size
    dx: 400, dy: 210,      // pitch
    name: { x: 8, y: 144, w: 276, h: 28 },   // name strip text area (relative to card)
    icon: { x: 2, y: 18, w: 120, h: 120 },   // portrait square (relative to card)
    xmark: { x: 104, y: 8, w: 136, h: 132 }, // where the red death X is drawn
  };

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
  function cardRects(W, H, cal) {
    const { s, ox, oy } = transform(W, H, cal);
    const out = [];
    for (let r = 0; r < LAYOUT.rows; r++) {
      for (let c = 0; c < LAYOUT.cols; c++) {
        const x = ox + (LAYOUT.x0 + c * LAYOUT.dx) * s;
        const y = oy + (LAYOUT.y0 + r * LAYOUT.dy) * s;
        const sub = (k) => ({
          x: x + LAYOUT[k].x * s, y: y + LAYOUT[k].y * s,
          w: LAYOUT[k].w * s, h: LAYOUT[k].h * s,
        });
        out.push({
          index: r * LAYOUT.cols + c, row: r, col: c,
          card: { x, y, w: LAYOUT.w * s, h: LAYOUT.h * s },
          name: sub('name'), icon: sub('icon'), xmark: sub('xmark'),
        });
      }
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
    for (let i = 0; i < d.length; i += 4) {
      const L = lum(d, i);
      const ink = lightBg ? L < thr : L > thr;
      const v = ink ? 0 : 255;
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

  /** Classify every slot. Returns [{index, occupied, dead, rects, stats}] */
  function analyze(img, cal) {
    return cardRects(img.width, img.height, cal).map((rc) => {
      const iconS = regionStats(img, rc.icon);
      const nameS = regionStats(img, rc.name);
      const xS = regionStats(img, rc.xmark);
      // Empty slots are near-uniform dark panels; occupied ones have a portrait
      // (high variance) and either a white strip (alive) or text (dead).
      const occupied = iconS.std > 18 && (nameS.std > 25 || nameS.mean > 150);
      // Dead cards: dimmed (dark) name strip and a red X right of the portrait.
      const dead = occupied && (xS.red > 0.06 || (nameS.mean < 140 && xS.red > 0.02));
      return { index: rc.index, occupied, dead, rects: rc, stats: { icon: iconS, name: nameS, xmark: xS } };
    });
  }

  /** Normalise OCR output into a player name. */
  function cleanName(s) {
    return (s || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 16);
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
    const tol = name.length <= 4 ? 1 : 2;
    return best !== null && bd <= tol ? best : null;
  }

  const api = { voteName, levenshtein, snapName, LAYOUT, DEFAULT_CAL, transform, cardRects, regionStats, crop, nameBitmap, analyze, cleanName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GGDParse = api;
})(typeof self !== 'undefined' ? self : this);
