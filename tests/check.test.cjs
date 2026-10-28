'use strict';
/** Zero-dependency tests:  node tests/check.test.cjs   (or: npm test) */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKILL = path.join(ROOT, 'skills', 'flutter-release-readiness');
const CHECK = path.join(SKILL, 'scripts', 'check.cjs');
const { check, toSarif, appRootOf } = require(CHECK);
const RULES = require(path.join(SKILL, 'scripts', 'rules.cjs'));
const ALL = [...RULES, ...RULES.project];
const VULN = path.join(__dirname, 'fixtures', 'vuln_app');
const CLEAN = path.join(__dirname, 'fixtures', 'clean_app');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-test-'));

console.log('\nflutter-release-readiness tests\n');
const vuln = check(VULN);
const hits = new Set(vuln.leads.map((l) => l.rule));

test('every rule fires on the vulnerable fixture', () => {
  const missing = ALL.map((r) => r.id).filter((id) => !hits.has(id));
  assert.deepStrictEqual(missing, [], `rules with no positive fixture: ${missing.join(', ')}`);
});

test('clean fixture produces zero leads', () => {
  const clean = check(CLEAN);
  assert.strictEqual(clean.leads.length, 0, JSON.stringify(clean.leads.map((l) => `${l.rule} ${l.file}:${l.line}`)));
});

test('rule ids are unique and well-formed', () => {
  const ids = ALL.map((r) => r.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate rule id');
  for (const r of ALL) {
    assert.match(r.id, /^FRC-(AND|IOS|DART|POL)-\d{3}$/);
    assert.ok(['blocker', 'high', 'medium', 'low', 'info'].includes(r.severity), `${r.id} severity`);
    assert.ok(['play', 'app-store', 'both'].includes(r.store), `${r.id} store`);
    if (r.pattern) assert.ok(r.pattern.flags.includes('g'), `${r.id} pattern needs the g flag`);
    for (const k of ['title', 'message', 'fix']) assert.ok(r[k] && r[k].length > 10, `${r.id} ${k}`);
  }
});

test('every rule guide anchor exists in its checks file', () => {
  const slug = (h) => h.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  for (const r of ALL) {
    const [file, anchor] = r.guide.split('#');
    const md = fs.readFileSync(path.join(SKILL, 'checks', file), 'utf8');
    const anchors = md.split('\n').filter((l) => /^#{1,4} /.test(l)).map((l) => slug(l.replace(/^#+ /, '')));
    assert.ok(anchors.includes(anchor), `${r.id}: ${r.guide} not found`);
  }
});

test('debug signing is detected only inside the release block', () => {
  const lead = vuln.leads.find((l) => l.rule === 'FRC-AND-002');
  assert.match(lead.snippet, /signingConfig = signingConfigs\.debug/);
  const dir = path.join(tmp, 'debug_block', 'android', 'app');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'build.gradle'), 'android { buildTypes {\n debug { signingConfig signingConfigs.debug }\n release { signingConfig signingConfigs.release }\n} }\n');
  assert.ok(!check(path.join(tmp, 'debug_block')).leads.some((l) => l.rule === 'FRC-AND-002'));
});

test('targetSdk rule ignores current levels and flutter.targetSdkVersion', () => {
  for (const [line, expect] of [['targetSdk = 34', true], ['targetSdk = 35', false], ['targetSdkVersion 36', false], ['targetSdk = flutter.targetSdkVersion', false]]) {
    const dir = path.join(tmp, `sdk_${expect}_${line.replace(/\W/g, '')}`, 'android', 'app');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'build.gradle'), `android { defaultConfig { ${line} } }\n`);
    const got = check(path.resolve(dir, '..', '..')).leads.some((l) => l.rule === 'FRC-AND-003');
    assert.strictEqual(got, expect, line);
  }
});

test('purpose-string rules depend on the plugins in pubspec.yaml', () => {
  const dir = path.join(tmp, 'no_plugins');
  copyDir(CLEAN, dir);
  fs.writeFileSync(path.join(dir, 'ios', 'Runner', 'Info.plist'), '<plist><dict><key>ITSAppUsesNonExemptEncryption</key><false/></dict></plist>\n');
  fs.writeFileSync(path.join(dir, 'pubspec.yaml'), 'name: shop\nversion: 1.0.1+2\ndependencies:\n  http: ^1.2.2\nflutter:\n  uses-material-design: true\n');
  const r = check(dir);
  assert.ok(!r.leads.some((l) => /^FRC-IOS-00[2-9]$|FRC-IOS-015/.test(l.rule)), JSON.stringify(r.leads.map((l) => l.rule)));
});

test('bundle id is reported once per project file, RunnerTests ignored', () => {
  const ids = vuln.leads.filter((l) => l.rule === 'FRC-IOS-001');
  assert.strictEqual(ids.length, 1);
  assert.ok(!ids[0].snippet.includes('RunnerTests'));
});

test('package example apps are skipped unless --include-examples', () => {
  const dir = path.join(tmp, 'mono');
  copyDir(CLEAN, dir);
  copyDir(VULN, path.join(dir, 'packages', 'ui_kit', 'example'));
  assert.strictEqual(check(dir).leads.length, 0);
  assert.ok(check(dir, { includeExamples: true }).leads.length > 10);
});

test('monorepo: each app is checked with its own pubspec', () => {
  const dir = path.join(tmp, 'apps');
  copyDir(CLEAN, path.join(dir, 'apps', 'shop'));
  copyDir(VULN, path.join(dir, 'apps', 'courier'));
  const r = check(dir);
  assert.deepStrictEqual(r.apps.sort(), ['apps/courier/', 'apps/shop/']);
  assert.ok(r.leads.length > 10 && r.leads.every((l) => l.file.startsWith('apps/courier/')));
  assert.strictEqual(appRootOf('apps/shop/ios/Runner/Info.plist'), 'apps/shop/');
  assert.strictEqual(appRootOf('android/app/build.gradle'), '');
});

test('git-ignored key.properties is not reported', () => {
  const dir = path.join(tmp, 'gitrepo');
  copyDir(VULN, dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  fs.writeFileSync(path.join(dir, '.gitignore'), 'android/key.properties\n');
  assert.ok(!check(dir).leads.some((l) => l.rule === 'FRC-AND-006'));
  fs.writeFileSync(path.join(dir, '.gitignore'), '');
  assert.ok(check(dir).leads.some((l) => l.rule === 'FRC-AND-006'));
});

test('passwords never appear in output', () => {
  assert.ok(!JSON.stringify(vuln).includes('not-a-real-password'));
});

test('--store filters rules', () => {
  const play = check(VULN, { store: 'play' });
  assert.ok(play.leads.every((l) => l.store === 'play' || l.store === 'both'));
  assert.ok(play.leads.length < vuln.leads.length);
});

test('frc-ignore suppresses a reviewed line', () => {
  const dir = path.join(tmp, 'ignore');
  copyDir(CLEAN, dir);
  fs.writeFileSync(path.join(dir, 'lib', 'config.dart'), "const a = 'http://localhost:8080'; // frc-ignore: FRC-DART-001 web build only\nconst b = 'http://localhost:9090';\n");
  assert.strictEqual(check(dir).leads.filter((l) => l.rule === 'FRC-DART-001').length, 1);
});

test('SARIF output is well-formed', () => {
  const sarif = toSarif(vuln);
  assert.strictEqual(sarif.version, '2.1.0');
  assert.strictEqual(sarif.runs[0].results.length, vuln.leads.length);
});

test('CLI --fail-on blocker exits 1 on vuln and 0 on clean; --out/--sarif write files', () => {
  let code = 0;
  try { execFileSync('node', [CHECK, VULN, '--fail-on', 'blocker', '--quiet']); } catch (e) { code = e.status; }
  assert.strictEqual(code, 1);
  const out = path.join(tmp, 'o', 'leads.json');
  const sarif = path.join(tmp, 'o', 'leads.sarif');
  execFileSync('node', [CHECK, CLEAN, '--fail-on', 'info', '--out', out, '--sarif', sarif, '--quiet']);
  assert.strictEqual(JSON.parse(fs.readFileSync(out, 'utf8')).leads.length, 0);
  assert.strictEqual(JSON.parse(fs.readFileSync(sarif, 'utf8')).version, '2.1.0');
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
