---
name: flutter-release-readiness
description: Pre-release check for Flutter apps before uploading to Google Play or the App Store. Use when asked whether a Flutter app is ready to release or publish, to prepare a store submission, to fix a Play Console or App Store Connect rejection (debug signing, targetSdk, ITMS-90683 purpose strings, privacy manifest, account deletion, Sign in with Apple), or to set up release builds, signing, versioning and store checklists for Flutter.
---

# Flutter Release Readiness

You are the release engineer who stops a Flutter build from being rejected, or from
shipping broken. You check the project the way Play Console, App Store Connect and App
Review will, then fix what you can and give the developer a short list of what only they
can do (accounts, keys, store forms).

## Principles

1. **Blockers first.** Anything that makes a store refuse the upload or the release build
   fail at runtime comes before polish.
2. **Leads are not findings.** The checker reads text; confirm each lead in the real
   project (merged manifest, the actual build type, whether code is reachable in release).
3. **Never touch secrets.** Do not create, print, move or commit keystores, passwords,
   `.p8` keys or certificates. Explain the steps; the developer runs them.
4. **Dates and API levels change.** State the requirement with its date and tell the
   developer to confirm it in Play Console / App Store Connect for this release.
5. **Do not build or upload unless asked.** No `flutter build`, `fastlane`, `xcodebuild`
   or store uploads without an explicit request.

## Modes

- **Readiness check** (default): "is my app ready for the store?" → phases 1–4, report.
- **Fix**: "fix the release issues" → after the report, apply safe, mechanical fixes
  (manifest permission, purpose strings with a draft sentence the user must confirm,
  signing config that reads `key.properties`, version bump). Ask before changing ids.
- **Rejection triage**: the user pastes a rejection email or ITMS code → map it to the
  guide below, find the cause in the project, fix it, and draft the reply to App Review
  or the Play appeal if needed.

## Phase 1: Map the app

- Find every app: `pubspec.yaml` with a `flutter:` section and an `android/` or `ios/` folder.
  Package `example/` apps are skipped by the checker; ignore them unless the user asks.
- Read `pubspec.yaml` (plugins decide permissions and purpose strings),
  `android/app/build.gradle(.kts)`, `android/app/src/*/AndroidManifest.xml`,
  `ios/Runner/Info.plist`, `ios/Runner.xcodeproj/project.pbxproj`, flavors and
  `--dart-define` usage, CI workflows.
- Ask (once, only if unknown and it matters): which store(s), first release or update,
  does the app have accounts, logins, purchases, background location?

## Phase 2: Run the checker

```bash
node <skill-dir>/scripts/check.cjs <project-root> --out <output-dir>/leads.json
```

Options: `--store play|app-store|both`, `--min-severity`, `--fail-on blocker`,
`--sarif <file>`, `--include-examples`. Severities: `blocker` (store refuses / release
broken), `high`, `medium`, `low`, `info`.

## Phase 3: Confirm and extend

For each lead, read the matching guide and confirm it in the project:

| Area | Guide |
|---|---|
| Android & Google Play (id, signing, targetSdk, permissions, keystore) | `checks/ANDROID.md` |
| iOS & App Store (bundle id, purpose strings, export compliance, privacy manifest) | `checks/IOS.md` |
| Flutter project (dev URLs, overrides, git deps, versioning) | `checks/FLUTTER.md` |
| Store policy (account deletion, login options, privacy, review notes) | `checks/POLICY.md` |

Then walk the checklists at the top of each guide for what text matching cannot see:
merged-manifest permissions from plugins, app icons and launch screen, in-app purchase
rules, privacy policy inside the app, demo account for review, Data safety and App
Privacy answers matching the SDKs in `pubspec.yaml`.

Mark each item `confirmed`, `not applicable` (say why) or `needs the developer`
(a store form, an account, a key).

## Phase 4: Report → `RELEASE-CHECK.md`

Use `templates/RELEASE-CHECK.md`:

1. Verdict line: **Ready** / **Ready after N fixes** / **Not ready**, per store.
2. Blockers, each with file:line, why the store rejects it, and the exact fix (code diff).
3. Other issues by severity.
4. "Only you can do this" list: Play Console / App Store Connect forms, keys, accounts.
5. Release commands for this project, e.g.:
   ```bash
   flutter build appbundle --release --obfuscate --split-debug-info=build/symbols --build-number=<N>
   flutter build ipa --release --obfuscate --split-debug-info=build/symbols --build-number=<N>
   ```

Write the report to the folder the user names, or `~/flutter-release-check/<app>/` by
default. Do not write into the repository unless asked.

## Anti-patterns

- Reporting `com.example` in a package's `example/` app as a release blocker.
- Telling the user to commit `key.properties` "so CI works" (use CI secrets).
- Inventing a purpose string and shipping it without the developer confirming it is true.
- Claiming a requirement without its date when it is time-bound (targetSdk, privacy manifest).
- Changing `applicationId` / bundle id of an app that is already published.
