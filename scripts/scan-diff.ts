/**
 * Pre-push / CI secret scan: checks every line added by every commit in <base>..HEAD
 * (not just the net diff, so a secret added and later removed is still caught).
 * Usage: node scripts/scan-diff.ts [base-ref]   (default origin/main)
 *        node scripts/scan-diff.ts --all        (every commit reachable from HEAD, root commits included)
 * Never prints matched values; fails closed when the range cannot be scanned.
 */
import { spawnSync } from 'node:child_process';
import { scanText } from '../src/lib/secrets.ts';

// Binary formats produced by tooling; their sources are scanned by ingest before export files are copied.
const BINARY_EXCLUDES = ['png', 'pdf', 'jpg', 'jpeg', 'webp', 'ico', 'woff', 'woff2', 'zip'].map((ext) => `:(exclude,glob)**/*.${ext}`);

function git(args: string[]): { ok: boolean; out: string } {
  const res = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { ok: res.status === 0 && !res.error, out: res.status === 0 ? res.stdout : '' };
}

function fail(message: string): never {
  console.error(`secret-scan: ${message}`);
  process.exit(1);
}

const arg = process.argv[2] ?? 'origin/main';
const all = arg === '--all';
const base = all ? 'root' : arg;
let range: string[];
if (all) {
  range = ['--root', 'HEAD'];
} else {
  if (!git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).ok) fail(`base ref "${base}" not found (fetch it first).`);
  const mergeBase = git(['merge-base', base, 'HEAD']);
  if (!mergeBase.ok) fail(`no merge base between "${base}" and HEAD (shallow clone? fetch full history).`);
  range = [`${mergeBase.out.trim()}..HEAD`];
}

// --text forces textual diffs for any non-excluded file git would classify as binary.
const log = git(['log', '-p', '--text', '--unified=0', '--no-color', '--format=commit %H', ...range, '--', '.', ...BINARY_EXCLUDES]);
if (!log.ok) fail('git log failed; range not scanned.');

let file = '';
let commit = '';
const findings = new Set<string>();
for (const line of log.out.split('\n')) {
  if (line.startsWith('commit ')) commit = line.slice(7, 19);
  else if (line.startsWith('+++ ')) file = line.replace(/^\+\+\+ (b\/)?/, '');
  else if (line.startsWith('+')) {
    for (const hit of scanText(line.slice(1))) findings.add(`${commit} ${file}: ${hit.rule}`);
  }
}

if (findings.size > 0) {
  console.error(`secret-scan: ${findings.size} finding(s) in commits ${base}..HEAD:`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`secret-scan: clean (commits ${base}..HEAD)`);
