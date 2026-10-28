#!/usr/bin/env node
'use strict';
/**
 * flutter-release-readiness checker (zero dependencies).
 *
 *   node check.cjs <flutter-project-or-monorepo> [--out leads.json] [--sarif leads.sarif]
 *                  [--store play|app-store|both] [--min-severity low] [--fail-on blocker]
 *                  [--include-examples] [--quiet]
 *
 * Finds what usually gets a Flutter build rejected by Google Play or the App Store,
 * or broken in release. Output is a list of LEADS; the skill workflow confirms them.
 *
 * Suppress a reviewed line with a trailing comment:  // frc-ignore: FRC-XXX-000 reason
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RULES = require('./rules.cjs');
const PROJECT_RULES = RULES.project;

const VERSION = '0.1.0';
const TOOL = 'flutter-release-readiness';
const SEVERITIES = ['info', 'low', 'medium', 'high', 'blocker'];
const STORES = ['play', 'app-store', 'both'];
const SKIP_DIRS = new Set([
  '.git', '.dart_tool', 'build', 'node_modules', 'Pods', '.symlinks', '.gradle', '.idea',
  '.vscode', '.fvm', 'ephemeral', '.pub-cache', 'coverage', '.plugin_symlinks', 'DerivedData',
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const TEST_PATH = /(^|\/)(test|integration_test|test_driver|fixtures?)\/|_test\.dart$/;
// Example apps inside packages are not shipped; skipped unless --include-examples.
const EXAMPLE_PATH = /(^|\/)(example|examples)\//;

function parseArgs(argv) {
  const args = { dir: null, out: null, sarif: null, store: 'both', minSeverity: 'info', failOn: null, quiet: false, includeExamples: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--sarif') args.sarif = argv[++i];
    else if (a === '--store') args.store = argv[++i];
    else if (a === '--min-severity') args.minSeverity = argv[++i];
    else if (a === '--fail-on') args.failOn = argv[++i];
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--include-examples') args.includeExamples = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a === '-v' || a === '--version') args.version = true;
    else if (!args.dir) args.dir = a;
    else throw new Error(`Unexpected argument: ${a}`);
  }
  if (!STORES.includes(args.store)) throw new Error(`--store must be one of ${STORES.join(', ')}`);
  for (const [key, flag] of [['minSeverity', '--min-severity'], ['failOn', '--fail-on']]) {
    if (args[key] && !SEVERITIES.includes(args[key])) throw new Error(`${flag} must be one of ${SEVERITIES.join(', ')}`);
  }
  return args;
}

function* walk(dir, root) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(full, root);
    } else if (e.isFile()) {
      yield path.relative(root, full).split(path.sep).join('/');
    }
  }
}

function lineInfo(text, index) {
  let line = 1;
  let start = 0;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) { line++; start = i + 1; }
  }
  let end = text.indexOf('\n', index);
  if (end === -1) end = text.length;
  return { line, column: index - start + 1, text: text.slice(start, end) };
}

const redact = (s) => s
  .replace(/(password|storePassword|keyPassword)\s*=\s*\S+/gi, '$1=…')
  .replace(/[A-Za-z0-9_\-+/=]{32,}/g, (t) => (/\d/.test(t) && /[A-Za-z]/.test(t) ? t.slice(0, 6) + '…' : t))
  .trim()
  .slice(0, 200);

// The Flutter app a file belongs to: the folder that holds android/, ios/ or lib/.
function appRootOf(rel) {
  const m = rel.match(/^(.*?\/)?(android|ios|lib|macos|web)\//);
  if (m) return m[1] || '';
  return rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
}

function makeGitIgnoreCheck(root) {
  let isRepo = false;
  try { execFileSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' }); isRepo = true; } catch { /* not a repo or no git */ }
  return (rel) => {
    if (!isRepo) return false;
    try { execFileSync('git', ['-C', root, 'check-ignore', '-q', rel], { stdio: 'ignore' }); return true; } catch { return false; }
  };
}

function check(rootDir, opts = {}) {
  const minIdx = SEVERITIES.indexOf(opts.minSeverity || 'info');
  const store = opts.store || 'both';
  const keep = (r) => SEVERITIES.indexOf(r.severity) >= minIdx && (store === 'both' || r.store === store || r.store === 'both');
  const root = path.resolve(rootDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${rootDir}`);

  const files = [];
  let examplesSkipped = 0;
  for (const rel of walk(root, root)) {
    if (TEST_PATH.test(rel)) continue;
    if (!opts.includeExamples && EXAMPLE_PATH.test(rel)) { examplesSkipped++; continue; }
    files.push(rel);
  }
  const cache = new Map();
  const read = (rel) => {
    if (!cache.has(rel)) {
      let text = '';
      try {
        const full = path.join(root, rel);
        if (fs.statSync(full).size <= MAX_FILE_BYTES) text = fs.readFileSync(full, 'utf8');
      } catch { /* unreadable */ }
      cache.set(rel, text.includes('\u0000') ? '' : text);
    }
    return cache.get(rel);
  };
  const pubspecFor = (rel) => {
    const file = `${appRootOf(rel)}pubspec.yaml`;
    return files.includes(file) ? { file, text: read(file) } : null;
  };
  const gitIgnored = makeGitIgnoreCheck(root);

  const leads = [];
  const push = (rule, file, text, index) => {
    const info = text ? lineInfo(text, index) : { line: 1, column: 1, text: file };
    leads.push({
      rule: rule.id, title: rule.title, severity_hint: rule.severity, store: rule.store,
      file, line: info.line, column: info.column, snippet: redact(info.text),
      guide: rule.guide, message: rule.message, fix: rule.fix,
    });
  };

  let filesChecked = 0;
  for (const rel of files) {
    const rules = RULES.filter((r) => keep(r) && (typeof r.files === 'function' ? r.files(rel) : r.files.test(rel)));
    if (!rules.length) continue;
    filesChecked++;
    for (const rule of rules) {
      if (rule.exclude && rule.exclude.test(rel)) continue;
      if (rule.pathOnly) { if (!gitIgnored(rel)) push(rule, rel, '', 0); continue; }
      if (rule.pubspecRequires) {
        const ps = pubspecFor(rel);
        if (!ps || !rule.pubspecRequires.test(ps.text)) continue;
      }
      const text = read(rel);
      if (!text) continue;
      if (rule.fileRequires && !rule.fileRequires.test(text)) continue;
      if (rule.fileAbsent && rule.fileAbsent.test(text)) continue;
      const fileLevel = Boolean(rule.fileRequires || rule.fileAbsent);
      const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g';
      const re = new RegExp(rule.pattern.source, flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        if (rule.when && !rule.when(m)) continue;
        const info = lineInfo(text, m.index + (m[0].length - m[0].trimStart().length));
        if (rule.exclude && rule.exclude.test(info.text)) continue;
        if (rule.nearbyExclude) {
          const above = text.slice(0, m.index).split('\n');
          if (rule.nearbyExclude.pattern.test(above.slice(Math.max(0, above.length - 1 - rule.nearbyExclude.before)).join('\n'))) continue;
        }
        const ignore = info.text.match(/frc-ignore(?::\s*([A-Z0-9,\- ]+))?/);
        if (ignore && (!ignore[1] || ignore[1].includes(rule.id))) continue;
        push(rule, rel, text, m.index + (m[0].length - m[0].trimStart().length));
        if (fileLevel || rule.once) break;
      }
    }
  }

  // Project rules run once per Flutter app (a pubspec.yaml with a flutter: section).
  const apps = files.filter((f) => /(^|\/)pubspec\.yaml$/.test(f) && /^flutter\s*:/m.test(read(f)))
    .map((f) => f.slice(0, f.length - 'pubspec.yaml'.length));
  for (const app of apps) {
    const appFiles = files.filter((f) => f.startsWith(app) && appRootOf(f) === app);
    const ctx = {
      files: appFiles,
      read,
      pubspec: { file: `${app}pubspec.yaml`, text: read(`${app}pubspec.yaml`) },
      lead: (file, text, index) => ({ file, text, index }),
    };
    for (const rule of PROJECT_RULES.filter(keep)) {
      for (const hit of rule.check(ctx)) push(rule, hit.file, hit.text, hit.index);
    }
  }

  leads.sort((a, b) =>
    SEVERITIES.indexOf(b.severity_hint) - SEVERITIES.indexOf(a.severity_hint) ||
    a.file.localeCompare(b.file) || a.line - b.line);
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const l of leads) counts[l.severity_hint]++;

  return {
    tool: `${TOOL}/check`,
    version: VERSION,
    target: path.basename(root),
    generated_at: new Date().toISOString(),
    store,
    apps: apps.map((a) => a || '.'),
    files_checked: filesChecked,
    example_files_skipped: examplesSkipped,
    rules_loaded: RULES.length + PROJECT_RULES.length,
    counts,
    note: 'Leads are release-readiness hints. Confirm each one against the project before acting on it.',
    leads,
  };
}

const SARIF_LEVEL = { blocker: 'error', high: 'error', medium: 'warning', low: 'note', info: 'note' };
function toSarif(result) {
  const all = [...RULES, ...PROJECT_RULES];
  const used = new Set(result.leads.map((l) => l.rule));
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: TOOL, version: VERSION, informationUri: 'https://github.com/MBotirjonDev/flutter-release-checker',
          rules: all.filter((r) => used.has(r.id)).map((r) => ({
            id: r.id,
            shortDescription: { text: r.title },
            fullDescription: { text: r.message },
            help: { text: `${r.fix}\n\nGuide: skills/${TOOL}/checks/${r.guide}` },
            properties: { tags: ['release', r.store] },
          })),
        },
      },
      results: result.leads.map((l) => ({
        ruleId: l.rule,
        level: SARIF_LEVEL[l.severity_hint],
        message: { text: `${l.title}. ${l.message}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: l.file }, region: { startLine: l.line, startColumn: l.column } } }],
      })),
    }],
  };
}

function printHuman(result) {
  const colors = { blocker: 35, high: 31, medium: 33, low: 36, info: 90 };
  const tty = process.stdout.isTTY;
  const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
  const storeLabel = { play: 'Play', 'app-store': 'App Store', both: 'both' };
  console.log(`\n${TOOL} · ${result.target} · ${result.apps.length} app(s) · ${result.files_checked} files · ${result.rules_loaded} rules\n`);
  if (!result.leads.length) { console.log('No release blockers found by the checker. Run the full skill workflow for the store checklist.\n'); return; }
  for (const l of result.leads) {
    console.log(`${c(colors[l.severity_hint], l.severity_hint.toUpperCase().padEnd(8))} ${l.rule.padEnd(12)} ${l.title}  ${c(90, `[${storeLabel[l.store]}]`)}`);
    console.log(`         ${l.file}:${l.line}`);
    if (l.snippet !== l.file) console.log(`         ${c(90, l.snippet)}`);
  }
  const summary = SEVERITIES.slice().reverse().map((s) => `${s}: ${result.counts[s]}`).join('  ');
  console.log(`\n${result.leads.length} leads  (${summary})`);
  console.log('Leads are hints. Confirm each one (see SKILL.md) before changing the project.\n');
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (args.version) { console.log(VERSION); return; }
  if (args.help || !args.dir) {
    console.log('Usage: node check.cjs <flutter-project-dir> [--out leads.json] [--sarif leads.sarif] [--store play|app-store|both] [--min-severity info|low|medium|high|blocker] [--fail-on <severity>] [--include-examples] [--quiet]');
    process.exit(args.help ? 0 : 2);
  }
  let result;
  try { result = check(args.dir, { store: args.store, minSeverity: args.minSeverity, includeExamples: args.includeExamples }); } catch (e) { console.error(e.message); process.exit(2); }
  if (args.out) writeJson(args.out, result);
  if (args.sarif) writeJson(args.sarif, toSarif(result));
  if (!args.quiet) printHuman(result);
  if (args.failOn) {
    const threshold = SEVERITIES.indexOf(args.failOn);
    if (result.leads.some((l) => SEVERITIES.indexOf(l.severity_hint) >= threshold)) process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { check, toSarif, appRootOf, SEVERITIES, VERSION };
