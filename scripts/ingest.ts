/**
 * Ingest INSTANTS (read-only) into the committed content snapshot.
 * Usage: INSTANTS_DIR=/path/to/INSTANTS npm run ingest   (CONTENT_DIR overrides the output, default ./content)
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { IngestError, runIngest } from '../src/lib/ingest/run.ts';

// Default: INSTANTS checked out next to this repo's main checkout (…/{INSTANTS,instants-web}).
// Resolved via the git common dir so it also works from a worktree under .worktrees/.
function defaultInstantsDir(): string {
  const gitCommonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: import.meta.dirname,
    encoding: 'utf8',
  }).trim();
  return resolve(dirname(gitCommonDir), '..', 'INSTANTS');
}

const sourceDir = process.env.INSTANTS_DIR || defaultInstantsDir();
const outDir = resolve(process.env.CONTENT_DIR || 'content');

try {
  const { manifest, excluded, missingExports } = runIngest({ sourceDir, outDir });
  const { counts } = manifest;
  console.log(`ingest: ${counts.entries} entries in ${counts.topics} topics → ${outDir}`);
  console.log(`  files: md ${counts.files.md}, mermaid ${counts.files.mermaid}, excalidraw ${counts.files.excalidraw}`);
  console.log(`  exports: png ${counts.exports.png}, pdf ${counts.exports.pdf}; missing ${missingExports.length}`);
  for (const m of missingExports) console.log(`    missing ${m.format}/${m.slug}.${m.kind}`);
  if (manifest.source?.dirty) console.warn('  warning: INSTANTS has uncommitted changes in md/ mermaid/ excalidraw/');
  if (excluded.length > 0) {
    console.warn(`  SECRET SCAN: ${excluded.length} file(s) left out — add to "Blocked on me" in PROGRESS.md:`);
    for (const e of excluded) console.warn(`    ${e.path} (${e.rules.join(', ')})`);
  }
} catch (err) {
  if (err instanceof IngestError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
