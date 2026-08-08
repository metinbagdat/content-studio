#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')

const target = path.resolve(process.cwd(), process.argv[2] || 'vercel.json')
if (!fs.existsSync(target)) {
  console.log('No vercel.json — skip cron validation')
  process.exit(0)
}

const cfg = JSON.parse(fs.readFileSync(target, 'utf8'))
const crons = Array.isArray(cfg.crons) ? cfg.crons : []

for (const c of crons) {
  const schedule = String(c.schedule || '')
  const minute = schedule.trim().split(/\s+/)[0] || ''
  if (minute === '*' || minute.startsWith('*/')) {
    console.error(`Hobby incompatible cron: ${c.path} schedule=${schedule}`)
    process.exit(1)
  }
}

console.log(`OK: ${crons.length} cron(s) Hobby-compatible`)
