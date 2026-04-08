/**
 * Writes solid-brand PNG + ICO into public/ (no extra npm deps).
 * Run: node scripts/gen-favicon.js
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')

// Brand: #0d9488, desk mark in white (32×32)
const W = 32
const H = 32
const R = 8 // rx in SVG → approximate with rounded rect mask in pixels

function insideRoundRect(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false
  const r = Math.min(R, W / 2, H / 2)
  const x0 = 0
  const y0 = 0
  const x1 = W - 1
  const y1 = H - 1
  if (x >= x0 + r && x <= x1 - r) return true
  if (y >= y0 + r && y <= y1 - r) return true
  const corners = [
    [x0 + r, y0 + r],
    [x1 - r, y0 + r],
    [x0 + r, y1 - r],
    [x1 - r, y1 - r],
  ]
  const rr = r * r
  for (const [cx, cy] of corners) {
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy <= rr) return true
  }
  return false
}

function pixel(x, y) {
  if (!insideRoundRect(x, y)) return [0, 0, 0, 0]
  const teal = [13, 148, 136, 255]
  // White desk strokes (match favicon.svg boxes)
  const white = [255, 255, 255, 255]
  // y bands: top bar 12-14, mid 16-17.5, legs area 19-24
  if (y >= 12 && y < 14 && x >= 7 && x < 25) return white
  if (y >= 16 && y < 18 && x >= 7 && x < 25) return white
  if (y >= 19 && y < 24) {
    if (x >= 9 && x < 11) return white
    if (x >= 21 && x < 23) return white
    if (y >= 19 && y < 21 && x >= 9 && x < 23) return white
  }
  return teal
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcIn = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcIn), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function buildPng() {
  const raw = []
  for (let y = 0; y < H; y++) {
    raw.push(0) // filter: None
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = pixel(x, y)
      raw.push(r, g, b, a)
    }
  }
  const rawBuf = Buffer.from(raw)
  const idat = zlib.deflateSync(rawBuf, { level: 9 })

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Minimal ICO with single 32×32 BMP (BGRA bottom-up) + AND mask */
function buildIcoFromRgba(getRgba) {
  const w = 32
  const h = 32
  const rowSize = ((w * 32 + 31) >> 5) << 2 // BMP row padding
  const pxSize = rowSize * h
  const andRow = ((w + 31) >> 5) << 2
  const andSize = andRow * h
  const bmpSize = 40 + pxSize + andSize

  const buf = Buffer.alloc(6 + 16 + bmpSize)
  let o = 0
  buf.writeUInt16LE(0, o)
  o += 2
  buf.writeUInt16LE(1, o)
  o += 2
  buf.writeUInt16LE(1, o)
  o += 2
  // entry
  buf[o] = w === 256 ? 0 : w
  o += 1
  buf[o] = h === 256 ? 0 : h
  o += 1
  buf[o] = 0
  o += 1
  buf[o] = 0
  o += 1
  buf.writeUInt16LE(1, o)
  o += 2
  buf.writeUInt32LE(bmpSize, o)
  o += 4
  buf.writeUInt32LE(22, o)
  o += 4

  buf.writeUInt32LE(40, o)
  o += 4
  buf.writeInt32LE(w, o)
  o += 4
  buf.writeInt32LE(h * 2, o)
  o += 4
  buf.writeUInt16LE(1, o)
  o += 2
  buf.writeUInt16LE(32, o)
  o += 4
  buf.writeUInt32LE(0, o)
  o += 4
  buf.writeUInt32LE(pxSize, o)
  o += 4
  buf.writeInt32LE(0, o)
  o += 4
  buf.writeInt32LE(0, o)
  o += 4
  buf.writeUInt32LE(0, o)
  o += 4
  buf.writeUInt32LE(0, o)
  o += 4

  for (let y = h - 1; y >= 0; y--) {
    const rowStart = o
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = getRgba(x, y)
      buf[o++] = b
      buf[o++] = g
      buf[o++] = r
      buf[o++] = a
    }
    while (o < rowStart + rowSize) buf[o++] = 0
  }
  buf.fill(0, o, o + andSize)
  return buf
}

const pngBuf = buildPng()
fs.writeFileSync(path.join(PUBLIC, 'favicon-32.png'), pngBuf)

const icoBuf = buildIcoFromRgba(pixel)
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), icoBuf)

console.log('Wrote public/favicon-32.png and public/favicon.ico')
