#!/usr/bin/env node
/*
 * scripts/lint-ui.mjs
 *
 * Guards the design system. Scans src/ for ad-hoc styling that causes UI drift.
 *
 *   node scripts/lint-ui.mjs           → report only (always exits 0)
 *   node scripts/lint-ui.mjs --strict  → exit 1 if any ERROR-level findings
 *
 * Wire --strict into pre-commit/CI only after the migration (Phase 4),
 * so in-progress work isn't blocked by pre-existing debt.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const STRICT = process.argv.includes("--strict");

const TOKENS_FILE = join("src", "styles", "tokens.css");

const RULES = [
  {
    id: "arbitrary-value",
    severity: "error",
    desc: "Arbitrary value — use the scale or a token",
    exts: [".tsx", ".ts", ".css"],
    re: /\[[^\]]*(?:#[0-9a-fA-F]{3,8}|\d+(?:\.\d+)?(?:px|rem|em|vh|vw)(?![a-z]))[^\]]*\]/g,
  },
  {
    id: "white-alpha-surface",
    severity: "error",
    desc: "White-alpha surface — use surface-overlay / surface-muted",
    exts: [".tsx", ".ts"],
    re: /\bbg-white\/\d{1,3}\b/g,
  },
  {
    id: "raw-palette-color",
    severity: "error",
    desc: "Raw Tailwind palette colour — use status / content / surface tokens",
    exts: [".tsx", ".ts"],
    re: /\b(?:text|bg|border|ring|fill|stroke|from|to|via)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/g,
  },
  {
    id: "hex-literal",
    severity: "warn",
    desc: "Hex/rgb literal in code — reference a token",
    exts: [".tsx", ".ts"],
    re: /#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)/g,
  },
  {
    id: "brand-direct",
    severity: "warn",
    desc: "Direct brand-* usage (deprecated — migrate to semantic tokens)",
    exts: [".tsx", ".ts"],
    re: /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-brand-[\w/-]+/g,
  },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const findings = {};
for (const rule of RULES) findings[rule.id] = [];

let scanned = 0;
for (const file of walk(SRC)) {
  const ext = extname(file);
  const rel = relative(ROOT, file);
  if (rel === TOKENS_FILE) continue; // tokens.css is the source of truth
  const applicable = RULES.filter((r) => r.exts.includes(ext));
  if (applicable.length === 0) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  // Sanctioned expressive/art components may opt out (human-approved only).
  if (lines.slice(0, 10).some((l) => l.includes("ui-lint-disable-file"))) continue;
  scanned++;

  lines.forEach((line, i) => {
    if (line.includes("ui-lint-ignore")) return;
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
    for (const rule of applicable) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        findings[rule.id].push({ file: rel, line: i + 1, match: m[0].slice(0, 60) });
      }
    }
  });
}

const SAMPLE = 12;
let errorCount = 0;
let warnCount = 0;

console.log(`\nUI lint — scanned ${scanned} files in src/\n`);

for (const rule of RULES) {
  const hits = findings[rule.id];
  const tag = rule.severity === "error" ? "ERROR" : "warn ";
  if (rule.severity === "error") errorCount += hits.length;
  else warnCount += hits.length;

  if (hits.length === 0) {
    console.log(`  ok    ${rule.id} — 0`);
    continue;
  }
  console.log(`  ${tag} ${rule.id} — ${hits.length}  (${rule.desc})`);
  for (const h of hits.slice(0, SAMPLE)) {
    console.log(`         ${h.file}:${h.line}  ${h.match}`);
  }
  if (hits.length > SAMPLE) console.log(`         … and ${hits.length - SAMPLE} more`);
}

console.log(`\n  totals: ${errorCount} error(s), ${warnCount} warning(s)\n`);

if (STRICT && errorCount > 0) {
  console.error("Strict mode: failing build due to ERROR findings.");
  process.exit(1);
}
process.exit(0);
