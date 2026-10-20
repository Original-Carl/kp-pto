// Inherit stage gate: everything the site consumes but didn't write is pinned
// or allowlisted. Node built-ins only, so this check has no supply chain itself.
//   1. GitHub Actions pinned to full commit SHAs; container images by digest
//      (every YAML file under .github/, including local composite actions).
//   2. No page (every *.html at the repo root) loads anything from third
//      parties: the CSP comes before anything
//      that loads, allows only the sources in CSP_ALLOWED, and every URL that
//      loads a resource (attributes, srcset, inline and external CSS) resolves
//      to the site's own origin. Navigation links (<a href>) aren't loads.
//   3. Self-hosted fonts match the sha256 in fonts/sources.json.
// The runtime CSP is the real control; this catches mistakes before they ship.
// Run: node scripts/check-inherit.mjs
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Directive -> sources allowed beyond 'self' / 'none'. Anything else fails.
export const CSP_ALLOWED = {
  "img-src": ["data:"],
};

const SITE = "https://kp-pto.org";
const FONT_FILE = /\.(woff2?|ttf|otf|eot)$/i;
// Tags whose URL attributes fetch something (or, for <base>, redirect what does).
const LOADING_TAGS = new Set([
  "script", "link", "img", "iframe", "frame", "source", "video", "audio", "embed",
  "object", "track", "base", "image", "input", "use", "feimage",
]);
const URL_ATTRS = ["src", "href", "xlink:href", "data", "poster", "background", "action", "formaction"];
const SRCSET_ATTRS = ["srcset", "imagesrcset"];
// <link rel> values that don't fetch a resource.
const NON_LOADING_REL = new Set(["canonical", "alternate", "author", "license", "me", "help", "bookmark"]);
// Matches a whole tag, honoring quoted attribute values that contain ">".
const TAG = /<([a-z][a-z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

// ---------- 1. Actions and images ----------

export function checkActionPins(files) {
  const errors = [];
  for (const [file, text] of Object.entries(files)) {
    text.split("\n").forEach((line, i) => {
      const where = `${file}:${i + 1}`;
      const code = line.replace(/\s#.*$/, "");
      for (const m of code.matchAll(/(?:^|[{,\s-])["']?uses["']?\s*:\s*["']?([^\s"',}]+)/g)) {
        const ref = m[1];
        const ok = ref.startsWith("./")
          || /^docker:\/\/.+@sha256:[0-9a-f]{64}$/.test(ref)
          || /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(ref);
        if (!ok) errors.push(`${where}: action "${ref}" is not pinned to a full commit SHA`);
      }
      // image:, container:, and any *_IMAGE / *-image env var (e.g. SEMGREP_IMAGE: …).
      const keyed = /(?:^|[{,\s-])["']?(?:[\w-]*[_-])?(?:image|container)["']?\s*:\s*["']?([^\s"',}]+)/i.exec(code);
      const images = [
        ...(keyed && !keyed[1].startsWith("${{") ? [keyed[1]] : []),
        ...[...code.matchAll(/\b((?:ghcr\.io|docker\.io|quay\.io|gcr\.io|public\.ecr\.aws|mcr\.microsoft\.com)\/[^\s"']+)/g)].map((x) => x[1]),
      ];
      const run = /\bdocker\s+(?:run|pull)\b(.*)$/.exec(code);
      if (run) {
        // First non-flag argument on the same line, unless it's a $VARIABLE (checked where it's set).
        const args = run[1].trim().split(/\s+/).filter(Boolean);
        for (let a = 0; a < args.length; a++) {
          if (args[a].startsWith("-")) { if (/^-(?:v|w|e|p|-name|-entrypoint|-network|-user)$/.test(args[a])) a++; continue; }
          if (!args[a].startsWith("$") && !args[a].startsWith('"$')) images.push(args[a]);
          break;
        }
      }
      for (const image of new Set(images)) {
        if (!/@sha256:[0-9a-f]{64}/.test(image)) errors.push(`${where}: image "${image}" is not pinned by digest`);
      }
    });
  }
  return errors;
}

// ---------- 2. Page loads ----------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", colon: ":", sol: "/", bsol: "\\", tab: "\t", newline: "\n", period: "." };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (whole, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? whole;
  });
}

// True if a URL would be fetched from anywhere but the site itself.
export function isThirdParty(raw) {
  const value = decodeEntities(raw).trim();
  if (value === "" || value.startsWith("#") || /^data:/i.test(value)) return false;
  try {
    return new URL(value, `${SITE}/`).origin !== SITE;
  } catch {
    return true; // unparseable: fail closed
  }
}

export function parseAttrs(body) {
  const attrs = {};
  for (const m of body.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

function tags(html) {
  return [...html.replace(/<!--[\s\S]*?-->/g, "").matchAll(TAG)].map((m) => ({
    name: m[1].toLowerCase(), attrs: parseAttrs(m[2]), index: m.index,
  }));
}

export function parseCsp(html) {
  const meta = tags(html).find((t) => t.name === "meta" && (t.attrs["http-equiv"] || "").toLowerCase() === "content-security-policy");
  if (!meta) return null;
  const csp = {};
  for (const part of decodeEntities(meta.attrs.content || "").split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) csp[name.toLowerCase()] = sources;
  }
  return { csp, index: meta.index };
}

export function checkCsp(html, file = "index.html") {
  const parsed = parseCsp(html);
  if (!parsed) return [`${file}: no Content-Security-Policy <meta> tag`];
  const { csp, index } = parsed;
  const errors = [];
  if (!csp["default-src"]) errors.push(`${file} CSP: missing default-src`);
  for (const [directive, sources] of Object.entries(csp)) {
    const extra = CSP_ALLOWED[directive] || [];
    for (const source of sources) {
      if (source === "'self'" || source === "'none'" || extra.includes(source)) continue;
      errors.push(`${file} CSP ${directive}: "${source}" is not on the allowlist (scripts/check-inherit.mjs CSP_ALLOWED)`);
    }
  }
  // A <meta> CSP only governs what comes after it.
  const early = tags(html).find((t) => t.index < index && ["script", "link", "style", "base", "img", "iframe"].includes(t.name));
  if (early) errors.push(`${file}: <${early.name}> appears before the CSP <meta>, so the CSP doesn't cover it`);
  return errors;
}

export function checkHtmlLoads(html, file = "index.html") {
  const errors = [];
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const { name, attrs } of tags(stripped)) {
    if (attrs.style) errors.push(...checkCssLoads(`${file} <${name} style>`, decodeEntities(attrs.style)));
    if (!LOADING_TAGS.has(name)) continue;
    if (name === "link") {
      const rels = (attrs.rel || "").toLowerCase().split(/\s+/).filter(Boolean);
      if (rels.length && rels.every((r) => NON_LOADING_REL.has(r))) continue;
    }
    for (const a of URL_ATTRS) {
      if (a in attrs && isThirdParty(attrs[a])) errors.push(`${file}: <${name} ${a}="${attrs[a]}"> loads from a third party`);
    }
    for (const a of SRCSET_ATTRS) {
      if (!(a in attrs)) continue;
      for (const candidate of decodeEntities(attrs[a]).split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url && isThirdParty(url)) errors.push(`${file}: <${name} ${a}> candidate "${url}" loads from a third party`);
      }
    }
  }
  for (const m of stripped.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    errors.push(...checkCssLoads(`${file} <style>`, m[1]));
  }
  return errors;
}

export function checkCssLoads(file, css) {
  const errors = [];
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // url(...) in any case, and every quoted string (covers @import "…", image-set("…"), src: "…").
  const candidates = [
    ...[...code.matchAll(/url\(\s*(["']?)([\s\S]*?)\1\s*\)/gi)].map((m) => m[2]),
    ...[...code.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]),
  ];
  for (const value of candidates) {
    if (/^data:/i.test(value.trim())) continue;
    if (value.includes("\\")) { errors.push(`${file}: "${value}" uses a CSS escape; write the URL plainly`); continue; }
    if (/[:/]/.test(value) && isThirdParty(value)) errors.push(`${file}: "${value}" loads from a third party`);
  }
  return errors;
}

// ---------- 3. Fonts ----------

export function checkFonts(manifest, files, hashOf) {
  const errors = [];
  const listed = manifest.fonts || {};
  for (const file of files.filter((f) => FONT_FILE.test(f))) {
    if (!listed[file]) {
      errors.push(`fonts/${file}: not listed in fonts/sources.json`);
      continue;
    }
    const actual = hashOf(file);
    if (actual !== listed[file].sha256) errors.push(`fonts/${file}: sha256 ${actual} doesn't match fonts/sources.json`);
  }
  for (const file of Object.keys(listed)) {
    if (!files.includes(file)) errors.push(`fonts/sources.json lists ${file}, which doesn't exist`);
  }
  return errors;
}

// ---------- CLI ----------

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

function main(root) {
  const read = (p) => readFileSync(join(root, p), "utf8");
  const yamls = Object.fromEntries(walk(join(root, ".github"))
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => [relative(root, f), readFileSync(f, "utf8")]));
  const pages = readdirSync(root).filter((f) => f.endsWith(".html"));
  const cssFiles = readdirSync(join(root, "css")).filter((f) => f.endsWith(".css"));
  const fontFiles = readdirSync(join(root, "fonts"));
  const hashOf = (f) => createHash("sha256").update(readFileSync(join(root, "fonts", f))).digest("hex");

  const errors = [
    ...checkActionPins(yamls),
    ...(pages.length ? [] : ["no *.html pages found at the repo root"]),
    ...pages.flatMap((f) => [...checkCsp(read(f), f), ...checkHtmlLoads(read(f), f)]),
    ...cssFiles.flatMap((f) => checkCssLoads(`css/${f}`, read(`css/${f}`))),
    ...checkFonts(JSON.parse(read("fonts/sources.json")), fontFiles, hashOf),
  ];
  if (errors.length) {
    process.stderr.write(`Inherit check failed (${errors.length}):\n${errors.map((e) => `  - ${e}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Inherit check passed: ${Object.keys(yamls).length} YAML files pinned, CSP and page loads allowlisted on ${pages.length} pages, ${fontFiles.filter((f) => FONT_FILE.test(f)).length} fonts verified.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
}
