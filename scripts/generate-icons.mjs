// Generates the placeholder PWA icons (a peach circle on a cream background)
// with no dependencies: a minimal PNG encoder on top of node:zlib.
// Run with `npm run gen:icons`; the output is committed in public/icons.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BACKGROUND = [0xff, 0xf4, 0xe8] // cream
const PEACH = [0xf4, 0xa2, 0x6b]
const LEAF = [0x6a, 0x9a, 0x5b]

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let offset = 0
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y)
      raw[offset++] = r
      raw[offset++] = g
      raw[offset++] = b
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// `scale` is the peach diameter relative to the icon: smaller for maskable
// icons so the shape stays inside the safe zone.
function peachIcon(size, scale) {
  const center = size / 2
  const radius = (size * scale) / 2
  const leafCenterX = center + radius * 0.35
  const leafCenterY = center - radius * 0.95
  const leafRadius = radius * 0.22
  return encodePng(size, (x, y) => {
    const dx = x + 0.5 - center
    const dy = y + 0.5 - center
    if (dx * dx + dy * dy <= radius * radius) return PEACH
    const lx = x + 0.5 - leafCenterX
    const ly = y + 0.5 - leafCenterY
    if ((lx * lx) / 2 + ly * ly <= leafRadius * leafRadius) return LEAF
    return BACKGROUND
  })
}

mkdirSync(outDir, { recursive: true })
const icons = [
  ['icon-192.png', 192, 0.7],
  ['icon-512.png', 512, 0.7],
  ['icon-maskable-512.png', 512, 0.55],
  ['apple-touch-icon-180.png', 180, 0.7],
]
for (const [name, size, scale] of icons) {
  writeFileSync(join(outDir, name), peachIcon(size, scale))
  console.log(`wrote public/icons/${name}`)
}
