/**
 * Minimal deterministic ZIP writer (PKWARE APPNOTE 6.3, no ZIP64): deflate via node:zlib, CRC-32 via zlib.crc32.
 * Same inputs → byte-identical archive (fixed timestamp, fixed order, no extra fields).
 */
import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipFile {
  /** POSIX path inside the archive; no leading slash, no "..". */
  name: string;
  data: Uint8Array;
}

const DEFLATE = 8;
const STORE = 0;
const UTF8_FLAG = 0x0800;

/** DOS date/time for an ISO date (seconds are stored in 2 s units). */
export function dosDateTime(iso: string): { date: number; time: number } {
  const d = new Date(iso);
  const year = Math.max(1980, d.getUTCFullYear());
  return {
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
  };
}

export function createZip(files: ZipFile[], modified = '1980-01-01T00:00:00Z'): Uint8Array {
  const { date, time } = dosDateTime(modified);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const seen = new Set<string>();

  for (const file of files) {
    if (!file.name || file.name.startsWith('/') || file.name.split('/').includes('..')) throw new Error(`unsafe zip entry name: ${file.name}`);
    if (seen.has(file.name)) throw new Error(`duplicate zip entry: ${file.name}`);
    seen.add(file.name);

    const name = Buffer.from(file.name, 'utf8');
    const raw = Buffer.from(file.data);
    const deflated = deflateRawSync(raw, { level: 9 });
    // Already-compressed formats (PNG, PDF) often grow when deflated; store them instead.
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const crc = crc32(raw) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(useDeflate ? DEFLATE : STORE, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by: UNIX, spec 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(useDeflate ? DEFLATE : STORE, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs: regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, body);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  if (offset > 0xffffffff || files.length > 0xffff) throw new Error('archive too large for non-ZIP64 writer');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, ...centrals, end]));
}
