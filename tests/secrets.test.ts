import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { BINARY_LIMITS, scanBinary, scanText, UNSCANNABLE } from '../src/lib/secrets.ts';

describe('scanText', () => {
  it('flags a GitHub token and reports its line, not its value', () => {
    const hits = scanText(`ok\ntoken ghp_${'a'.repeat(36)}\n`);
    expect(hits).toEqual([{ rule: 'github-token', line: 2 }]);
  });

  it('flags a stateless GitHub installation token', () => {
    const token = 'ghs_' + '12345_' + 'eyJ' + 'hbGciOiJSUzI1NiJ9.eyJpc3MiOjF9.sig';
    expect(scanText(token).map((h) => h.rule)).toContain('github-installation-token');
  });

  it('flags credential assignments', () => {
    expect(scanText('OPENROUTER_API_KEY' + '=' + 'abcd1234efgh5678ijkl').map((h) => h.rule)).toContain('credential-assignment');
  });

  it('ignores placeholders and prose about secrets', () => {
    expect(scanText('API_KEY=${API_KEY}\nAPI_KEY=<your-key>\nRotate the API key after a leak.')).toEqual([]);
  });
});

describe('scanBinary', () => {
  const token = () => 'ghp_' + 'B'.repeat(36);
  it('finds a secret inside a deflated PDF stream', () => {
    const body = deflateSync(Buffer.from(`BT (${token()}) Tj ET`));
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj <</Filter /FlateDecode>> stream\n'), body, Buffer.from('\nendstream\nendobj\n')]);
    expect(scanText(pdf.toString('latin1'))).toEqual([]);
    expect(scanBinary(pdf).map((h) => h.rule)).toContain('github-token');
  });

  it('finds a secret inside a PNG zTXt chunk', () => {
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
    };
    const ztxt = Buffer.concat([Buffer.from('Comment\0\0', 'latin1'), deflateSync(Buffer.from(token()))]);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('zTXt', ztxt), chunk('IEND', Buffer.alloc(0))]);
    expect(scanBinary(png).map((h) => h.rule)).toContain('github-token');
  });

  const pdfWith = (dict: string, body: Buffer) =>
    Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj ${dict} stream\n`), body, Buffer.from('\nendstream\nendobj\n')]);

  it('uses /Length, so "endstream" bytes inside compressed data cannot hide the rest', () => {
    const body = deflateSync(Buffer.from(`endstream padding ${token()}`));
    expect(scanBinary(pdfWith(`<</Length ${body.length} /Filter /FlateDecode>>`, body)).map((h) => h.rule)).toContain('github-token');
  });

  it('fails closed on filter chains it cannot decode and on corrupt Flate data', () => {
    expect(scanBinary(pdfWith('<</Filter [/ASCII85Decode /FlateDecode]>>', Buffer.from('<~garbage~>')))).toEqual([{ rule: UNSCANNABLE, line: 0 }]);
    expect(scanBinary(pdfWith('<</Filter /FlateDecode>>', Buffer.from('not deflate')))).toEqual([{ rule: UNSCANNABLE, line: 0 }]);
  });

  it('skips image codecs', () => {
    expect(scanBinary(pdfWith('<</Filter /DCTDecode>>', Buffer.from([0xff, 0xd8, 0xff])))).toEqual([]);
  });

  it('fails closed when a stream inflates past the limit', () => {
    const saved = BINARY_LIMITS.maxInflated;
    BINARY_LIMITS.maxInflated = 1024;
    try {
      expect(scanBinary(pdfWith('<</Filter /FlateDecode>>', deflateSync(Buffer.alloc(10_000, 0x41))))).toEqual([{ rule: UNSCANNABLE, line: 0 }]);
    } finally {
      BINARY_LIMITS.maxInflated = saved;
    }
  });

  it('scans a huge newline-free line in bounded windows and still finds a token at the end', () => {
    const line = 'A'.repeat(200_000) + ' ' + token();
    const t0 = performance.now();
    expect(scanText(line).map((h) => h.rule)).toContain('github-token');
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
