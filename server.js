const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

/*
Set this to the folder that contains PX.
Example:
If your real folder is:
C:\reports\PX

then set:
const DATA_ROOT = 'C:/reports';

If PX.html and PX folder are in same current folder, keep process.cwd().
*/
const DATA_ROOT = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(text);
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function safeResolve(baseRoot, requestedPath) {
  const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(baseRoot, normalized);
  const allowedRoot = path.resolve(baseRoot);

  if (!resolved.startsWith(allowedRoot)) {
    throw new Error('Invalid path');
  }
  return resolved;
}

function readDirectoryInfo(absPath) {
  const entries = fs.readdirSync(absPath, { withFileTypes: true });

  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      dirs.push(entry.name);
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }

  dirs.sort((a, b) => a.localeCompare(b));
  files.sort((a, b) => a.localeCompare(b));

  return { dirs, files };
}

function serveStaticFile(reqPath, res) {
  let targetPath;

  if (reqPath === '/' || reqPath === '/px.html') {
    targetPath = path.join(process.cwd(), 'px.html');
  } else {
    targetPath = path.join(process.cwd(), reqPath);
  }

  if (!fileExists(targetPath)) {
    sendText(res, 404, 'Not found');
    return;
  }

  const ext = path.extname(targetPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(targetPath, (err, data) => {
    if (err) {
      sendText(res, 500, 'Failed to read file');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function handleListDirs(query, res) {
  try {
    const requestedPath = query.path || '';
    const absPath = safeResolve(DATA_ROOT, requestedPath);

    if (!fileExists(absPath)) {
      sendJson(res, 404, { error: 'Path does not exist', path: requestedPath });
      return;
    }

    const stat = fs.statSync(absPath);
    if (!stat.isDirectory()) {
      sendJson(res, 400, { error: 'Path is not a directory', path: requestedPath });
      return;
    }

    const info = readDirectoryInfo(absPath);
    sendJson(res, 200, {
      path: requestedPath,
      absolutePath: absPath,
      dirs: info.dirs,
      files: info.files
    });
  } catch (err) {
    sendJson(res, 400, { error: err.message || 'Failed to list directory' });
  }
}

function handleReadHtml(query, res) {
  try {
    const requestedPath = query.path || '';
    const absPath = safeResolve(DATA_ROOT, requestedPath);

    if (!fileExists(absPath)) {
      sendJson(res, 404, { error: 'File does not exist', path: requestedPath });
      return;
    }

    const stat = fs.statSync(absPath);
    if (!stat.isFile()) {
      sendJson(res, 400, { error: 'Path is not a file', path: requestedPath });
      return;
    }

    if (path.extname(absPath).toLowerCase() !== '.html') {
      sendJson(res, 400, { error: 'Only .html files are allowed', path: requestedPath });
      return;
    }

    const content = fs.readFileSync(absPath, 'utf8');
    sendJson(res, 200, {
      path: requestedPath,
      absolutePath: absPath,
      content
    });
  } catch (err) {
    sendJson(res, 400, { error: err.message || 'Failed to read HTML file' });
  }
}

function handleRequest(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/listDirs') {
    handleListDirs(parsed.query, res);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/readHtml') {
    handleReadHtml(parsed.query, res);
    return;
  }

  if (req.method === 'GET') {
    serveStaticFile(pathname, res);
    return;
  }

  sendText(res, 405, 'Method not allowed');
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`DATA_ROOT = ${DATA_ROOT}`);
});