/**
 * Pre-push secret scan: checks lines added on this branch relative to a base ref.
 * Usage: node scripts/scan-diff.ts [base-ref]   (default origin/main)
 */
import { execFileSync } from 'node:child_process';
import { scanText } from '../src/lib/secrets.ts';

const base = process.argv[2] ?? 'origin/main';
const diff = execFileSync('git', ['diff', '--unified=0', '--no-color', `${base}...HEAD`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

let file = '';
const findings: string[] = [];
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) file = line.replace(/^\+\+\+ (b\/)?/, '');
  else if (line.startsWith('+') && !line.startsWith('+++')) {
    for (const hit of scanText(line.slice(1))) findings.push(`${file}: ${hit.rule}`);
  }
}

if (findings.length > 0) {
  console.error(`secret-scan: ${findings.length} finding(s) in outgoing diff vs ${base}:`);
  for (const f of [...new Set(findings)]) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`secret-scan: clean (diff vs ${base})`);
