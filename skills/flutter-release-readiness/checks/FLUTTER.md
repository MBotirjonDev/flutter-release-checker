# Flutter project & build

## Checklist

- [ ] No development hosts reachable from release code
- [ ] Config per environment via `--dart-define` / `--dart-define-from-file` or flavors
- [ ] `pubspec.yaml` has no `dependency_overrides` (or each one is justified)
- [ ] Git dependencies pinned with `ref:`
- [ ] `pubspec.lock` committed for apps
- [ ] Version and build number bumped for every upload
- [ ] `flutter analyze` clean, tests pass, `flutter build` for both platforms succeeds from a clean checkout
- [ ] Crash reporting (Crashlytics/Sentry) initialized with release symbols uploaded
- [ ] Debug-only UI (test login buttons, env switchers) guarded by `kDebugMode` or removed

## Dev server URLs

`http://localhost`, `http://10.0.2.2` (Android emulator), `127.0.0.1` and LAN addresses
only exist on the developer's machine. In a release build they mean a broken app, and
reviewers reject apps that don't work. Read the base URL from the build:

```dart
const apiBase = String.fromEnvironment('API_URL', defaultValue: 'https://api.example.uz');
```

```bash
flutter run --dart-define=API_URL=http://10.0.2.2:8000
flutter build appbundle --dart-define=API_URL=https://api.example.uz
```

**Validate:** is the address reachable from release code? Code under `if (kDebugMode)`,
a test-login helper only wired to a debug button, or a user-editable self-hosting field
with a placeholder are not blockers; say which one it is.

## Dependency overrides

`dependency_overrides` forces a version every package must accept, even ones it was not
tested with. Common reason: a fix not yet published. Before release, check that the
override is still needed and add a comment with the upstream issue link.

## Git dependencies

```yaml
shop_ui:
  git:
    url: https://github.com/example-org/shop_ui.git
    ref: v2.3.1          # tag or full commit sha
```

Without `ref`, `flutter pub get` on a clean machine (CI, a new laptop) may fetch a newer
commit than the one you tested. `pubspec.lock` pins it for existing checkouts, but only if
the lock file is committed and nobody runs `pub upgrade`.

## Version and build number

`version: 1.4.0+27` means version name `1.4.0` (shown to users) and build number `27`
(Android `versionCode`, iOS `CFBundleVersion`). Both stores reject an upload whose build
number is not higher than the last one. Override per build with
`flutter build … --build-name=1.4.0 --build-number=28`, or let CI use the run number.

## Pubspec description

`description: A new Flutter project.` is never shown in the stores, but it is a quick sign
the project metadata (name, description, icons, app name) was never finished.
