import fs from 'node:fs'
import path from 'node:path'

const pkgName = '@content-studio/core'
const root = process.cwd()
const targetModules = [
  ['adminKey', 'adminKey'],
  ['auth', 'auth'],
  ['platforms/formats', 'platforms/formats'],
  ['platforms/limits', 'platforms/limits'],
  ['platforms/targets', 'platforms/targets'],
]

const searchRoots = ['apps/web', 'apps/worker', 'lib', 'packages/core/src', 'scripts']

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

let changed = 0
for (const rel of searchRoots) {
  for (const file of walk(path.join(root, rel))) {
    let content = fs.readFileSync(file, 'utf8')
    const orig = content
    for (const [oldMod, newMod] of targetModules) {
      const escaped = oldMod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      content = content.replace(
        new RegExp(`from\\s+(['"])@/lib/${escaped}\\1`, 'g'),
        `from $1${pkgName}/${newMod}$1`,
      )
      content = content.replace(
        new RegExp(`from\\s+(['"])(?:\\.\\./)+${escaped}\\1`, 'g'),
        `from $1${pkgName}/${newMod}$1`,
      )
      content = content.replace(
        new RegExp(`from\\s+(['"])\\./${escaped}\\1`, 'g'),
        `from $1${pkgName}/${newMod}$1`,
      )
    }
    if (content !== orig) {
      fs.writeFileSync(file, content)
      changed++
    }
  }
}

const authPath = path.join(root, 'packages/core/src/auth.ts')
let auth = fs.readFileSync(authPath, 'utf8')
auth = auth.replace(
  /from\s+(['"])(@\/lib\/adminKey|@content-studio\/core\/adminKey)\1/,
  "from './adminKey'",
)
fs.writeFileSync(authPath, auth)

console.log(`codemod: ${changed} file(s)`)
