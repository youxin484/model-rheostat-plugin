// Download the React UMD builds the preview harness needs into dev/preview/vendor/.
//
// The harness renders the plugin's real client.js with real React so the control
// can be checked (and screenshotted) without launching DSH. React is fetched
// instead of committed — vendor/ is gitignored, so the repository stays free of
// vendored third-party builds.
//
// Usage: node dev/fetch-react.mjs

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const VERSION = '18.3.1'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'preview', 'vendor')
mkdirSync(OUT, { recursive: true })

const FILES = [
  ['react.js', `https://unpkg.com/react@${VERSION}/umd/react.production.min.js`],
  ['react-dom.js', `https://unpkg.com/react-dom@${VERSION}/umd/react-dom.production.min.js`],
]

for (const [name, url] of FILES) {
  const target = join(OUT, name)
  if (existsSync(target)) {
    console.log(`skip (exists): ${target}`)
    continue
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`)
  writeFileSync(target, Buffer.from(await response.arrayBuffer()))
  console.log(`downloaded: ${target}`)
}
