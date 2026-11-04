/**
 * Publish scan (issue #37): fails when anything the public site serves carries a secret or personal data.
 * Usage: node scripts/scan-publish.ts <dir> [<dir> ...] [--allow <file>]   (default allowlist: publish-scan.allow.json)
 * Example: node scripts/scan-publish.ts content dist   ·   in Release: the html dir extracted from the image.
 * Prints file:line and rule only, never the matched value. Fails closed: a missing or empty directory is an error.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { applyAllowlist, parseAllowlist, scanTree, type PublishFinding } from '../src/lib/publish-scan.ts';

function fail(message: string): never {
  console.error(`publish-scan: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const allowAt = args.indexOf('--allow');
const allowFile = allowAt >= 0 ? args[allowAt + 1] : join(import.meta.dirname, '..', 'publish-scan.allow.json');
if (allowAt >= 0 && !allowFile) fail('--allow needs a file.');
const dirs = allowAt >= 0 ? args.filter((_, i) => i !== allowAt && i !== allowAt + 1) : args;
if (dirs.length === 0) fail('give at least one directory to scan.');

let allow;
try {
  allow = existsSync(allowFile) ? parseAllowlist(readFileSync(allowFile, 'utf8')) : [];
} catch (err) {
  fail((err as Error).message);
}

const findings: PublishFinding[] = [];
let scanned = 0;
for (const dir of dirs) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`"${dir}" is not a directory.`);
  const res = scanTree(dir, basename(dir.replace(/\/+$/, '')) || dir);
  if (res.scanned === 0) fail(`"${dir}" is empty; nothing was scanned.`);
  scanned += res.scanned;
  findings.push(...res.findings);
}

const { kept, allowed } = applyAllowlist(findings, allow);
if (kept.length > 0) {
  console.error(`publish-scan: ${kept.length} finding(s) in ${scanned} file(s):`);
  for (const f of kept) console.error(`  - ${f.path}:${f.line} ${f.rule}`);
  process.exit(1);
}
console.log(`publish-scan: clean (${scanned} file(s) in ${dirs.join(', ')}; ${allowed.length} allowlisted)`);
