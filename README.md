<div align="center">

# Flutter Release Checker

<h3>Ship your Flutter app to Google Play and the App Store on the first try.</h3>

<p>An agent skill that checks a Flutter project the way Play Console, App Store Connect and App Review will,<br>
plus a zero-dependency checker for your laptop and your CI.</p>

[![tests](https://github.com/MBotirjonDev/flutter-release-checker/actions/workflows/test.yml/badge.svg)](https://github.com/MBotirjonDev/flutter-release-checker/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![rules](https://img.shields.io/badge/checks-29-58a6ff)](#checks)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[**Quick start**](#quick-start) · [**Checks**](#checks) · [**How it works**](#how-the-skill-works) · [**Contribute**](#roadmap--help-wanted) · [🇺🇿 O'zbekcha](README.uz.md)

</div>

---

> ```
> is my flutter app ready for the app store?
> ```

## Why this exists

`flutter create` gives you an app that runs, not an app the stores accept. The same
rejections hit almost every first release:

- **Play Console:** `com.example` package name, release signed with the **debug key**,
  `targetSdk` below the yearly requirement, restricted permissions without a declaration
- **Release-only bug:** `INTERNET` permission only in the debug manifest, so the store
  build has **no network**; API base URL still `http://10.0.2.2`
- **App Store Connect:** **ITMS-90683 missing purpose string** for a plugin you added,
  placeholder permission texts, no privacy manifest (**ITMS-91053**)
- **App Review:** no **in-app account deletion** (5.1.1(v)), Google login without an
  equivalent option such as **Sign in with Apple** (4.8)

Each one costs a review cycle, often days. This tool finds them before you upload.

## Quick start

### 1. As an agent skill (recommended)

```bash
npx skills add https://github.com/MBotirjonDev/flutter-release-checker --skill flutter-release-readiness --global
```

Or copy `skills/flutter-release-readiness/` into `~/.claude/skills/` (Claude Code) or
your agent's skills folder. Then, in your Flutter project:

```
is my flutter app ready for the app store?
```
```
fix the release issues for google play
```
```
App Review rejected us with ITMS-90683, what do I change?
```

The agent confirms every lead, applies the safe fixes, and writes a `RELEASE-CHECK.md`
with a per-store verdict, the blockers with diffs, and the store forms only you can fill in.

### 2. As a standalone checker

Node 18+ only. No `npm install`, no Flutter SDK needed.

```bash
git clone https://github.com/MBotirjonDev/flutter-release-checker
node flutter-release-checker/skills/flutter-release-readiness/scripts/check.cjs path/to/your_app
```

```
BLOCKER  FRC-AND-001  Template applicationId (com.example)  [Play]
         android/app/build.gradle:12
         applicationId = "com.example.my_shop"
BLOCKER  FRC-AND-002  Release build signed with the debug key  [Play]
         android/app/build.gradle:23
         signingConfig = signingConfigs.debug
BLOCKER  FRC-IOS-002  Missing NSCameraUsageDescription (camera)  [App Store]
         ios/Runner/Info.plist:4
HIGH     FRC-AND-004  INTERNET permission missing from the release manifest  [Play]
         android/app/src/main/AndroidManifest.xml:1
HIGH     FRC-POL-001  Account creation without in-app account deletion  [both]
         lib/main.dart:7
...
```

Options: `--store play|app-store|both`, `--fail-on blocker`, `--min-severity medium`,
`--out leads.json`, `--sarif leads.sarif`, `--include-examples`, `--quiet`.

Works on monorepos: every `pubspec.yaml` with a `flutter:` section is checked with its
own plugins. Package `example/` apps are skipped by default. A `key.properties` that git
ignores is not reported.

### 3. In GitHub Actions

```yaml
# .github/workflows/release-check.yml
name: release-check
on: [pull_request]
jobs:
  release-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MBotirjonDev/flutter-release-checker@v0
        with:
          store: both        # play | app-store | both
          fail-on: blocker   # info | low | medium | high | blocker | none
```

## How the skill works

| Phase | What happens |
|---|---|
| 1. Map | find every app, read pubspec, Gradle, manifests, Info.plist, Xcode project, flavors |
| 2. Check | run the checker; severities are `blocker`, `high`, `medium`, `low`, `info` |
| 3. Confirm | read the guide for each lead and confirm it in the real project (merged manifest, release build type, reachable code); walk the store checklists text matching can't see |
| 4. Report | `RELEASE-CHECK.md`: verdict per store, blockers with diffs, "only you can do this" list, exact build commands |

It never creates, prints or commits keystores and passwords, and never builds or uploads
unless you ask.

## Checks

| Check | What it looks for | Severity | Store |
|---|---|---|---|
| `FRC-AND-001` | Template applicationId (com.example) | blocker | Play |
| `FRC-AND-002` | Release build signed with the debug key | blocker | Play |
| `FRC-AND-003` | targetSdk below the Google Play requirement | blocker | Play |
| `FRC-AND-004` | INTERNET permission missing from the release manifest | high | Play |
| `FRC-AND-005` | Permission that needs a Play Console declaration | medium | Play |
| `FRC-AND-006` | Signing keystore or key.properties in the project | high | Play |
| `FRC-AND-007` | App label looks like the project name | low | Play |
| `FRC-IOS-001` | Template bundle identifier (com.example) | high | App Store |
| `FRC-IOS-002` | Missing NSCameraUsageDescription (camera) | blocker | App Store |
| `FRC-IOS-003` | Missing NSPhotoLibraryUsageDescription (photo library) | blocker | App Store |
| `FRC-IOS-004` | Missing NSLocationWhenInUseUsageDescription (location) | blocker | App Store |
| `FRC-IOS-005` | Missing NSMicrophoneUsageDescription (microphone) | blocker | App Store |
| `FRC-IOS-006` | Missing NSContactsUsageDescription (contacts) | blocker | App Store |
| `FRC-IOS-007` | Missing NSFaceIDUsageDescription (Face ID) | blocker | App Store |
| `FRC-IOS-008` | Missing NSBluetoothAlwaysUsageDescription (Bluetooth) | blocker | App Store |
| `FRC-IOS-009` | Missing NSSpeechRecognitionUsageDescription (speech recognition) | blocker | App Store |
| `FRC-IOS-010` | Empty or placeholder purpose string | high | App Store |
| `FRC-IOS-011` | Export compliance not declared | info | App Store |
| `FRC-IOS-012` | Display name looks like the project name | low | App Store |
| `FRC-IOS-013` | Background modes to justify in review | info | App Store |
| `FRC-IOS-014` | No app privacy manifest (PrivacyInfo.xcprivacy) | low | App Store |
| `FRC-IOS-015` | image_picker without NSCameraUsageDescription | medium | App Store |
| `FRC-DART-001` | Development server URL in app code | medium | both |
| `FRC-DART-002` | dependency_overrides in pubspec.yaml | medium | both |
| `FRC-DART-003` | Git dependency without a pinned ref | low | both |
| `FRC-DART-004` | Template version (1.0.0+1) | info | both |
| `FRC-DART-005` | Template description in pubspec.yaml | info | both |
| `FRC-POL-001` | Account creation without in-app account deletion | high | both |
| `FRC-POL-002` | Third-party login without Sign in with Apple | medium | App Store |

Guides with the reasoning, dates and fixes:
[`ANDROID.md`](skills/flutter-release-readiness/checks/ANDROID.md) ·
[`IOS.md`](skills/flutter-release-readiness/checks/IOS.md) ·
[`FLUTTER.md`](skills/flutter-release-readiness/checks/FLUTTER.md) ·
[`POLICY.md`](skills/flutter-release-readiness/checks/POLICY.md)

Suppress a reviewed line with `// frc-ignore: FRC-DART-001 web demo build`.

Store requirements change (targetSdk rises every August). Time-bound checks state their
date; confirm them in Play Console and App Store Connect before each release.

Tested against [`flutter/samples`](https://github.com/flutter/samples) (33 demo apps,
correctly flagged as not store-ready) and three published apps: Immich, AppFlowy and
LocalSend. On those, the one blocker it reported was real: AppFlowy's release build
type still points at the debug signing config, as its own comment notes.

## Roadmap — help wanted

- [ ] Merged-manifest mode: read `build/app/intermediates/merged_manifests` when present
- [ ] Default Flutter launcher icon and launch screen detection
- [ ] Android 16 KB page size readiness for native libraries
- [ ] In-app purchase rules: digital goods sold through external payment links
- [ ] Privacy manifest contents vs. SDKs in `pubspec.yaml`
- [ ] Flavor-aware checks (`productFlavors`, Xcode schemes)
- [ ] macOS and Flutter Web release checks

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © Botirjon ([@MBotirjonDev](https://github.com/MBotirjonDev)). Not affiliated with Google, Apple or the Flutter team.
