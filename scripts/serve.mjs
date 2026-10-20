// Minimal static server for _site/ (Node built-ins only), used by the browser
// tests. Behaves like GitHub Pages where it matters: "/" serves index.html,
// unknown paths get 404.html with a 404 status. Python's http.server dropped
// connections under parallel test load, which made the tests flaky.
// Run: node scripts/serve.mjs [port]   (default 4173, serves ./_site)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "_site");
const PORT = Number(process.argv[2] || 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

async function send(res, status, file) {
  const body = await readFile(file);
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + sep)) throw new Error("outside _site");
    await send(res, 200, file);
  } catch {
    try {
      await send(res, 404, join(ROOT, "404.html"));
    } catch {
      res.writeHead(404).end("Not found");
    }
  }
}).listen(PORT, "127.0.0.1", () => process.stdout.write(`Serving _site/ at http://127.0.0.1:${PORT}/\n`));
