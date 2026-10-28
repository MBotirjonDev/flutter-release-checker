# Contributing

Every rejection you hit is a check someone else does not have to learn the hard way.

## Add a check (≈15 minutes)

1. **Open an issue** with the *New rule* template: paste the Play Console / App Store
   Connect message or ITMS code if you have one.
2. Add the rule to `skills/flutter-release-readiness/scripts/rules.cjs`:
   - next free id: `FRC-<AREA>-<NNN>` (`AND IOS DART POL`)
   - file rule: `files`, `pattern` (with `g`), optional `when`, `exclude`, `nearbyExclude`,
     `fileRequires` / `fileAbsent`, `pubspecRequires`, `once`, `pathOnly`
   - cross-file rule: add to `module.exports.project` with a `check(ctx)` function
   - `severity` (`blocker` only if the store refuses the build or release is broken),
     `store`, `guide`, `message`, `fix`
   - time-bound requirements: put the date in `message`
3. Add a positive case to `tests/fixtures/vuln_app/` and keep `tests/fixtures/clean_app/`
   clean (add a tricky negative case if your rule could misfire).
4. Add or extend the section in `checks/*.md` (the `guide` anchor must exist).
5. Update the checks table in `README.md`.
6. `npm test`: all green, no new dependencies.

Please run your check against a couple of published open-source Flutter apps and mention
the false-positive count in the PR.

## Ground rules

- Zero runtime dependencies. Node ≥ 18 standard library only.
- Never put real keystores, passwords, company names or personal data in fixtures.
- Link the official policy page for every store rule.
- Found a vulnerability *in this project*? See [SECURITY.md](SECURITY.md).
- Be kind in reviews. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
