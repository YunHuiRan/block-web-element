// 生成 Chrome 扩展图标（16 / 48 / 128）
// 纯 Node.js 实现 PNG 编码，无外部依赖
// 用法: node scripts/generate-icons.js

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---- PNG 编码工具 ----
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // 每行前加 filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 绘制 ----
// 绘制一个圆角蓝色底 + 白色 "B" 字的图标
function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  const bg = [9, 132, 227, 255]; // #0984E3
  const bgLight = [11, 154, 255, 255];

  const barColor = [255, 255, 255, 255]; // 白色

  const radius = size * 0.22;
  const padding = size * 0.2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // 圆角矩形背景
      const dx = Math.min(x, size - 1 - x, Math.max(0, size - 1 - x));
      const dy = Math.min(y, size - 1 - y, Math.max(0, size - 1 - y));

      const nx = Math.max(
        radius -
          (x < radius
            ? radius - x
            : x > size - 1 - radius
              ? x - (size - 1 - radius)
              : 0),
        0,
      );
      const ny = Math.max(
        radius -
          (y < radius
            ? radius - y
            : y > size - 1 - radius
              ? y - (size - 1 - radius)
              : 0),
        0,
      );

      const inCornerRadius = nx * nx + ny * ny <= radius * radius;
      const inRect = x >= 0 && x < size && y >= 0 && y < size;

      const inBg = inRect && inCornerRadius;

      if (!inBg) {
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
        continue;
      }

      // 渐变背景（左上 -> 右下 轻微渐变）
      const t = (x + y) / (2 * size);
      pixels[idx] = Math.round(bg[0] + (bgLight[0] - bg[0]) * t);
      pixels[idx + 1] = Math.round(bg[1] + (bgLight[1] - bg[1]) * t);
      pixels[idx + 2] = Math.round(bg[2] + (bgLight[2] - bg[2]) * t);
      pixels[idx + 3] = 255;
    }
  }

  // 画白色 "B"（用简单像素块模拟）
  // B 的竖线 + 两个半圆
  const w = size;
  const stroke = Math.max(2, Math.round(size * 0.12));
  const top = Math.round(size * 0.28);
  const bottom = Math.round(size * 0.72);
  const leftX = Math.round(size * 0.32);
  const midY = Math.round(size * 0.5);

  function setPx(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= w) return;
    const idx = (Math.round(y) * w + Math.round(x)) * 4;
    pixels[idx] = barColor[0];
    pixels[idx + 1] = barColor[1];
    pixels[idx + 2] = barColor[2];
    pixels[idx + 3] = barColor[3];
  }

  // 竖线
  for (let y = top; y <= bottom; y++) {
    for (let sx = 0; sx < stroke; sx++) {
      setPx(leftX + sx, y);
    }
  }

  // 上圆弧（B 的上面两个圆角组成的 "凸起"，这里简化为两个小矩形模拟上下环）
  const ringWidth = Math.round(size * 0.42);
  const ringHeight = Math.round((midY - top) * 0.6);

  // 上环
  for (let y = top - ringHeight / 2; y < top + ringHeight / 2; y++) {
    for (let x = leftX + stroke; x < leftX + ringWidth; x++) {
      setPx(x, y);
    }
  }
  // 上环右竖边
  for (let y = top - ringHeight / 2; y < top + ringHeight / 2; y++) {
    for (let sx = 0; sx < stroke; sx++) {
      setPx(leftX + ringWidth - sx, y);
    }
  }

  // 下环
  for (let y = midY - ringHeight / 3; y < midY + ringHeight / 3; y++) {
    for (let x = leftX + stroke; x < leftX + ringWidth; x++) {
      setPx(x, y);
    }
  }
  // 下环右竖边
  for (let y = midY - ringHeight / 3; y < midY + ringHeight / 3; y++) {
    for (let sx = 0; sx < stroke; sx++) {
      setPx(leftX + ringWidth - sx, y);
    }
  }

  // 下大环（底部）
  const bottomRingTop = Math.round(size * 0.56);
  const bottomRingHeight = Math.round((bottom - bottomRingTop) * 0.7);
  for (let y = bottomRingTop; y < bottomRingTop + bottomRingHeight; y++) {
    for (let x = leftX + stroke; x < leftX + ringWidth; x++) {
      setPx(x, y);
    }
  }
  for (let y = bottomRingTop; y < bottomRingTop + bottomRingHeight; y++) {
    for (let sx = 0; sx < stroke; sx++) {
      setPx(leftX + ringWidth - sx, y);
    }
  }

  return encodePng(size, size, pixels);
}

// ---- 主流程 ----
const iconsDir = path.join(__dirname, "..", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [16, 48, 128];
for (const size of sizes) {
  const png = drawIcon(size);
  const file = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ 已生成 ${file} (${png.length} bytes)`);
}

console.log("图标生成完毕 ✅");
