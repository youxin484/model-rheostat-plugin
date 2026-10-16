// Inject the official DeepSeek fish-logo geometry from the installed DSH app into
// .dsh-plugin/client.js at the /*__FISH_LOGO__*/ marker.
//
// Why: the slider thumb draws the official brand mark. Copying a ~3.4 KB path by
// hand invites transcription errors, so this script reads the canonical
// FISH_LOGO_PATH / FISH_LOGO_VIEWBOX straight out of the DSH app bundle
// (app.asar) and splices them in byte-exactly. Re-run it after a DSH upgrade to
// pick up any change to the official artwork.
//
// Usage:
//   node scripts/extract-fish-logo.mjs                 # inject at the marker
//   node scripts/extract-fish-logo.mjs --force         # refresh an existing injection
//   node scripts/extract-fish-logo.mjs --asar <path>   # explicit app.asar
//
// The asar path is taken from --asar, then $DSH_ASAR, then a short list of
// well-known install locations.

import { openSync, readSync, closeSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PRIMITIVES = 'dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js'
const MARKER = '/*__FISH_LOGO__*/'
const TARGET = join(dirname(fileURLToPath(import.meta.url)), '..', '.dsh-plugin', 'client.js')

const argv = process.argv.slice(2)
const force = argv.includes('--force')
const explicit = (() => {
  const i = argv.indexOf('--asar')
  if (i !== -1 && argv[i + 1] !== undefined) return argv[i + 1]
  const inline = argv.find((a) => a.startsWith('--asar='))
  return inline === undefined ? undefined : inline.slice('--asar='.length)
})()

/** Conventional desktop install locations, tried after --asar / $DSH_ASAR. */
const CANDIDATES = [
  explicit,
  process.env.DSH_ASAR,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'),
  process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'DeepSeek Harness', 'resources', 'app.asar'),
  '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar',
  '/opt/DeepSeek Harness/resources/app.asar',
].filter(Boolean)

function resolveAsar() {
  for (const candidate of CANDIDATES) if (existsSync(candidate)) return candidate
  throw new Error(
    'app.asar not found. Pass --asar <path> or set $DSH_ASAR.\n' +
      'Tried:\n  ' +
      CANDIDATES.join('\n  ') +
      '\nTip: app.asar sits next to the app executable, under resources/.\n' +
      "  Windows: (Get-Process 'DeepSeek Harness').Path  →  ..\\resources\\app.asar",
  )
}

/** Read one exact member out of an asar archive without extracting the whole thing. */
function readAsarFile(asarPath, wanted) {
  const fd = openSync(asarPath, 'r')
  try {
    const sizeBuf = Buffer.alloc(8)
    readSync(fd, sizeBuf, 0, 8, 0)
    const pickleSize = sizeBuf.readUInt32LE(4)
    const headerBuf = Buffer.alloc(pickleSize)
    readSync(fd, headerBuf, 0, pickleSize, 8)
    const jsonSize = headerBuf.readUInt32LE(4)
    const header = JSON.parse(headerBuf.toString('utf8', 8, 8 + jsonSize))
    const base = 8 + pickleSize

    let node = header
    for (const part of wanted.split('/')) {
      node = node.files?.[part]
      if (node === undefined) throw new Error(`not found in asar: ${wanted}`)
    }
    const buf = Buffer.alloc(node.size)
    readSync(fd, buf, 0, node.size, base + Number(node.offset))
    return buf.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

if (!existsSync(TARGET)) throw new Error(`target not found: ${TARGET}`)

const current = readFileSync(TARGET, 'utf8')

// Decide idempotency BEFORE resolving app.asar: on an install whose location we
// cannot guess, an unconditional run must still be a harmless no-op.
if (!current.includes(MARKER) && !force) {
  console.log('marker absent — already injected, nothing to do (use --force to refresh from app.asar)')
  process.exit(0)
}

const asar = resolveAsar()
const source = readAsarFile(asar, PRIMITIVES)

const viewBox = source.match(/FISH_LOGO_VIEWBOX\s*=\s*\{\s*width:\s*([\d.]+)\s*,\s*height:\s*([\d.]+)\s*\}/)
const path = source.match(/FISH_LOGO_PATH\s*=\s*"([^"]+)"/)
if (viewBox === null || path === null) {
  throw new Error('could not locate FISH_LOGO_VIEWBOX / FISH_LOGO_PATH in the installed primitives build')
}

const injection = [
  '\t\t/** Slider-thumb logo width in px; height follows the official viewBox ratio. */',
  '\t\tvar FISH_LOGO_SIZE = 12;',
  `\t\tvar FISH_LOGO_VIEWBOX = { width: ${viewBox[1]}, height: ${viewBox[2]} };`,
  `\t\tvar FISH_LOGO_PATH = "${path[1]}";`,
].join('\n')

if (!current.includes(MARKER)) {
  // Detect the previous injection by matching, not by comparing before/after:
  // re-extracting from the same DSH build yields byte-identical text, so the
  // replaced string legitimately equals the original and a string compare would
  // misreport that as "nothing matched".
  const previous = /\t\t\/\*\* Slider-thumb logo width[\s\S]*?var FISH_LOGO_PATH = "[^"]+";/
  if (!previous.test(current)) {
    throw new Error('marker absent and no previous injection matched — refusing to guess')
  }
  const replaced = current.replace(previous, injection)
  if (replaced === current) {
    console.log(`already up to date (identical geometry) — verified against ${asar}`)
  } else {
    writeFileSync(TARGET, replaced)
    console.log(`re-injected (forced) from ${asar}`)
  }
} else {
  writeFileSync(TARGET, current.replace(MARKER, injection))
  console.log(`injected viewBox=${viewBox[1]}x${viewBox[2]} path=${path[1].length} chars from ${asar}`)
}
