import { serveSnapshot, snapshotPaths } from '../../lib/snapshot-files.ts';

export const getStaticPaths = () => snapshotPaths('exports');
export const GET = serveSnapshot('exports');
