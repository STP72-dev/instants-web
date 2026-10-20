import { serveSnapshot, snapshotPaths } from '../../lib/snapshot-files.ts';

export const getStaticPaths = () => snapshotPaths('files');
export const GET = serveSnapshot('files');
