import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { topicZip, topicZipFiles } from '../src/lib/downloads.ts';
import { manifest } from '../src/lib/content.ts';
import { createZip, dosDateTime } from '../src/lib/zip.ts';

const tmp = mkdtempSync(join(tmpdir(), 'iweb-zip-'));
const write = (name: string, bytes: Uint8Array) => {
  const p = join(tmp, name);
  writeFileSync(p, bytes);
  return p;
};
// Independent reader: Python's zipfile validates CRCs and both directories.
const pyList = (path: string) =>
  JSON.parse(
    execFileSync('python3', ['-I', '-c', 'import sys,json,zipfile\nz=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None\nprint(json.dumps([[i.filename,i.file_size] for i in z.infolist()]))', path], { encoding: 'utf8' }),
  ) as Array<[string, number]>;

describe('createZip', () => {
  it('writes an archive other tools read back exactly', () => {
    const text = new TextEncoder().encode('hello hello hello hello\n'.repeat(50));
    const bin = new Uint8Array([0, 1, 2, 3, 255]);
    const path = write('a.zip', createZip([{ name: 't/a.txt', data: text }, { name: 't/ő.bin', data: bin }], '2026-10-20T12:27:48Z'));
    expect(pyList(path)).toEqual([
      ['t/a.txt', text.length],
      ['t/ő.bin', 5],
    ]);
    const out = execFileSync('python3', ['-I', '-c', 'import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("t/a.txt"))', path]);
    expect(new Uint8Array(out)).toEqual(text);
  });

  it('is deterministic and rejects unsafe names', () => {
    const files = [{ name: 'x/y.txt', data: new Uint8Array([1, 2, 3]) }];
    expect(createZip(files, '2026-01-01T00:00:00Z')).toEqual(createZip(files, '2026-01-01T00:00:00Z'));
    expect(() => createZip([{ name: '../evil', data: new Uint8Array() }])).toThrow(/unsafe/);
    expect(() => createZip([{ name: '/abs', data: new Uint8Array() }])).toThrow(/unsafe/);
    expect(() => createZip([...files, ...files])).toThrow(/duplicate/);
  });

  it('encodes DOS timestamps', () => {
    expect(dosDateTime('2026-10-20T12:27:48Z')).toEqual({ date: ((2026 - 1980) << 9) | (10 << 5) | 20, time: (12 << 11) | (27 << 5) | 24 });
  });
});

describe('topic archives (committed snapshot)', () => {
  it.each(manifest.topics.map((t) => t.slug))('%s zip holds README + every file of the topic', (slug) => {
    const expected = topicZipFiles(slug).map((f) => [f.name, f.data.length]);
    const listed = pyList(write(`${slug}.zip`, topicZip(slug)));
    expect(listed).toEqual(expected);
    const entries = manifest.entries.filter((e) => e.topic === slug);
    const fileCount = entries.reduce((n, e) => n + Object.values(e.formats).reduce((m, f) => m + 1 + Object.keys(f!.exports).length, 0), 0);
    expect(listed.length).toBe(fileCount + 1);
  });

  it('README lists entries in reading order', () => {
    const readme = new TextDecoder().decode(topicZipFiles('nonconformist')[0].data);
    expect(readme.split('\n')[0]).toBe('NONCONFORMIST — INSTANTS topic archive');
    expect(readme).toMatch(/01\. NONCONFORMIST — hell YEAH, release facts/);
    expect(readme).toMatch(/Not exported yet:\n {4}md\/nonconformist-techtoon-ep01-overview\.pdf/);
  });

  it('archived bytes equal the snapshot files', () => {
    const f = topicZipFiles('git').find((x) => x.name.endsWith('.mmd'))!;
    expect(Buffer.from(f.data)).toEqual(readFileSync(join(import.meta.dirname, '..', 'content', f.name.replace(/^git\//, ''))));
  });
});
