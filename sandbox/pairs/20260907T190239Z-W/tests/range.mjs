// HTTP Range support for the mirror server.
//
// DuckDB-WASM reads a parquet file with `Range: bytes=start-end` requests, one
// per column chunk. A server that ignores the header and returns 200 with the
// whole 1.45 MB file either makes DuckDB throw an IO error or re-downloads the
// entire file for every chunk. Either way the identity path never completes,
// and the control case fails for a reason that has nothing to do with the
// cartridge under test. This is the missing piece that made the rig unable to
// run the identity path at all.
import fs from 'node:fs';

/* Serve `target` honouring a Range header if present. Returns true when it
   handled the response. Only single ranges are supported, which is all DuckDB
   sends. */
export function serveWithRange(req, res, target, contentType) {
  const size = fs.statSync(target).size;
  const range = req.headers.range;
  const base = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
  };

  if (!range) {
    res.writeHead(200, { ...base, 'Content-Length': size });
    fs.createReadStream(target).pipe(res);
    return true;
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
  if (!m) {
    res.writeHead(416, { ...base, 'Content-Range': `bytes */${size}` }).end();
    return true;
  }
  let start = m[1] === '' ? null : Number(m[1]);
  let end = m[2] === '' ? null : Number(m[2]);
  if (start === null && end === null) {
    res.writeHead(416, { ...base, 'Content-Range': `bytes */${size}` }).end();
    return true;
  }
  // suffix range: bytes=-N means the last N bytes
  if (start === null) { start = Math.max(0, size - end); end = size - 1; }
  if (end === null || end >= size) end = size - 1;
  if (start > end || start >= size) {
    res.writeHead(416, { ...base, 'Content-Range': `bytes */${size}` }).end();
    return true;
  }
  res.writeHead(206, {
    ...base,
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': end - start + 1,
  });
  fs.createReadStream(target, { start, end }).pipe(res);
  return true;
}

export function mimeFor(file) {
  // jsdelivr's `+esm` bundles carry no extension. Served as octet-stream,
  // Chromium refuses them as module scripts and the identity path dies at the
  // DuckDB import - which is what the control case was reporting.
  if (file.endsWith('+esm') || /[\/]npm[\/].*[\/][^.\/]+$/.test(file)) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.parquet')) return 'application/vnd.apache.parquet';
  if (file.endsWith('.wasm')) return 'application/wasm';
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.json') || file.endsWith('.geojson')) return 'application/json; charset=utf-8';
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

/* Preflight for CORS on range requests from a worker. */
export function serveOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Max-Age': '86400',
  }).end();
}
