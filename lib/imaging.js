/**
 * Mondiro Toolbox — xu ly anh (Node/Jimp), port 1:1 tu ban Python/numpy da test truoc do
 * (blur doc + lightness HSL, smart crop, resize theo %).
 * Dung Jimp (thuan JS, khong native binding) de electron-builder khong phai build lai
 * native module cho tung may.
 */

const { Jimp, ResizeStrategy } = require("jimp");

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Motion blur tuyen tinh theo chieu DOC (tuong duong Angle=-90 trong Photoshop). */
function directionalBlurVertical(plane, width, height, distance) {
  distance = Math.max(1, Math.round(distance));
  if (distance <= 1) return Float64Array.from(plane);

  const half = Math.floor(distance / 2);
  const acc = new Float64Array(width * height);

  for (let off = -half; off < distance - half; off++) {
    for (let y = 0; y < height; y++) {
      let sy = y + off;
      if (sy < 0) sy = 0;
      else if (sy >= height) sy = height - 1;
      const srcRow = sy * width;
      const dstRow = y * width;
      for (let x = 0; x < width; x++) {
        acc[dstRow + x] += plane[srcRow + x];
      }
    }
  }
  for (let i = 0; i < acc.length; i++) acc[i] /= distance;
  return acc;
}

/** Ban chuyen ngu (port) truc tiep tu colorsys.rgb_to_hls / hls_to_rgb cua Python. */
function rgbToHls(r, g, b) {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const l = (minc + maxc) / 2;
  if (maxc === minc) return [0, l, 0];

  const diff = maxc - minc;
  const s = l <= 0.5 ? diff / (maxc + minc) : diff / (2 - maxc - minc);

  let h;
  if (r === maxc) h = (g - b) / diff;
  else if (g === maxc) h = 2 + (b - r) / diff;
  else h = 4 + (r - g) / diff;

  h = (h / 6) % 1;
  if (h < 0) h += 1;
  return [h, l, s];
}

function _v(m1, m2, hue) {
  hue = ((hue % 1) + 1) % 1;
  if (hue < 1 / 6) return m1 + (m2 - m1) * hue * 6;
  if (hue < 0.5) return m2;
  if (hue < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - hue) * 6;
  return m1;
}

function hlsToRgb(h, l, s) {
  if (s === 0) return [l, l, l];
  const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
  const m1 = 2 * l - m2;
  return [_v(m1, m2, h + 1 / 3), _v(m1, m2, h), _v(m1, m2, h - 1 / 3)];
}

/**
 * Blur Symbols — motion blur doc + chinh Lightness (giu Hue/Saturation), giu alpha.
 * Ghi de len chinh file dau vao (giong hanh vi ban Python/Photoshop cu).
 */
async function blurSymbol(filePath, blurDistance, lightness) {
  const img = await Jimp.read(filePath);
  const { width, height, data } = img.bitmap;
  const n = width * height;

  const R = new Float64Array(n);
  const G = new Float64Array(n);
  const B = new Float64Array(n);
  const A = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    R[i] = data[o];
    G[i] = data[o + 1];
    B[i] = data[o + 2];
    A[i] = data[o + 3];
  }

  if (blurDistance && blurDistance > 0) {
    // premultiply de mau khong lem ra vung trong suot khi blur
    const PR = new Float64Array(n);
    const PG = new Float64Array(n);
    const PB = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const af = A[i] / 255;
      PR[i] = R[i] * af;
      PG[i] = G[i] * af;
      PB[i] = B[i] * af;
    }

    const bPR = directionalBlurVertical(PR, width, height, blurDistance);
    const bPG = directionalBlurVertical(PG, width, height, blurDistance);
    const bPB = directionalBlurVertical(PB, width, height, blurDistance);
    const bA = directionalBlurVertical(A, width, height, blurDistance);

    for (let i = 0; i < n; i++) {
      const af = Math.max(bA[i] / 255, 1e-6);
      R[i] = bPR[i] / af;
      G[i] = bPG[i] / af;
      B[i] = bPB[i] / af;
      A[i] = bA[i];
    }
  }

  for (let i = 0; i < n; i++) {
    R[i] = clamp(R[i], 0, 255);
    G[i] = clamp(G[i], 0, 255);
    B[i] = clamp(B[i], 0, 255);
  }

  if (lightness) {
    const amount = clamp(lightness, -100, 100) / 100;
    for (let i = 0; i < n; i++) {
      const [h, l, s] = rgbToHls(R[i] / 255, G[i] / 255, B[i] / 255);
      let lNew = amount >= 0 ? l + (1 - l) * amount : l * (1 + amount);
      lNew = clamp(lNew, 0, 1);
      const [r2, g2, b2] = hlsToRgb(h, lNew, s);
      R[i] = r2 * 255;
      G[i] = g2 * 255;
      B[i] = b2 * 255;
    }
  }

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    data[o] = clamp(Math.round(R[i]), 0, 255);
    data[o + 1] = clamp(Math.round(G[i]), 0, 255);
    data[o + 2] = clamp(Math.round(B[i]), 0, 255);
    data[o + 3] = clamp(Math.round(A[i]), 0, 255);
  }

  await img.write(filePath);
}

/** Smart Crop — crop theo bbox alpha, giu doi xung tam anh (giong Milo_Crop.py). */
async function smartCrop(filePath) {
  const img = await Jimp.read(filePath);
  const { width, height, data } = img.bitmap;

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const a = data[(row + x) * 4 + 3];
      if (a > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return; // anh hoan toan trong suot, khong lam gi ca

  const left = minX, top = minY, right = maxX + 1, bottom = maxY + 1;
  const trimLeft = left, trimRight = width - right;
  const trimTop = top, trimBottom = height - bottom;
  const cropX = Math.min(trimLeft, trimRight);
  const cropY = Math.min(trimTop, trimBottom);
  const newW = width - 2 * cropX;
  const newH = height - 2 * cropY;

  if (newW === width && newH === height) return;

  img.crop({ x: cropX, y: cropY, w: newW, h: newH });
  await img.write(filePath);
}

/** Doc kich thuoc anh (khong sua file) — dung de UI hien thi/kiem tra truoc khi resize theo pixel. */
async function getImageSize(filePath) {
  const img = await Jimp.read(filePath);
  return { width: img.bitmap.width, height: img.bitmap.height };
}

/** Resize theo % (ghi de file goc, giong Milo_Resize.py nhung dung % thay vi slider). */
async function resizeImagePercent(filePath, percent) {
  const img = await Jimp.read(filePath);
  const scale = percent / 100;
  const w = Math.max(1, Math.round(img.bitmap.width * scale));
  const h = Math.max(1, Math.round(img.bitmap.height * scale));
  img.resize({ w, h, mode: ResizeStrategy.BICUBIC });
  await img.write(filePath);
}

/**
 * Resize theo pixel (ghi de file goc). Chi can truyen 1 chieu (width HOAC height),
 * chieu con lai se duoc tu tinh theo dung ti le khung hinh GOC cua tung file
 * (moi file tu tinh rieng dua tren kich thuoc that cua no, phu hop khi batch nhieu
 * file co ti le khac nhau). Neu truyen ca 2 chieu, resize dung kich thuoc do
 * (co the lam meo ti le neu khong khop voi anh goc).
 */
async function resizeImagePixel(filePath, { width, height } = {}) {
  const img = await Jimp.read(filePath);
  const origW = img.bitmap.width;
  const origH = img.bitmap.height;

  let w = width > 0 ? width : null;
  let h = height > 0 ? height : null;
  if (!w && !h) return; // khong co chieu nao hop le, khong lam gi ca

  if (w && !h) h = Math.round(origH * (w / origW));
  else if (h && !w) w = Math.round(origW * (h / origH));

  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  img.resize({ w, h, mode: ResizeStrategy.BICUBIC });
  await img.write(filePath);
}

module.exports = {
  blurSymbol, smartCrop, resizeImagePercent, resizeImagePixel, getImageSize,
  rgbToHls, hlsToRgb, directionalBlurVertical,
};
