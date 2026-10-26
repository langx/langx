// Venus's character rules, as the generator reads them. data/character.json is canonical for the
// machine; the character bible, kept outside the repo, is the human document. grammar.mjs,
// lib/score.mjs and lint-quips.mjs all import from here, so a rule changes in one place.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const CHARACTER_FILE = path.join(HERE, '../data/character.json')
export const CHARACTER = JSON.parse(fs.readFileSync(CHARACTER_FILE, 'utf8'))
