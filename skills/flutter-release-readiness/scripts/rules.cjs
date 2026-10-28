'use strict';
/**
 * Release-readiness rules for flutter-release-readiness.
 *
 * Every hit is a LEAD: something that commonly gets a Flutter build rejected by
 * Google Play / the App Store, crashes in release, or ships a dev setting. The
 * skill workflow confirms each one against the real project before reporting it.
 *
 * File rules (module.exports):
 *   id              FRC-<AREA>-<NNN>   AREA: AND IOS DART POL
 *   files           RegExp tested against the path, or a function(path) → bool
 *   pattern         RegExp with the `g` flag; each match is one lead
 *   when            optional function(match) → bool; keep the lead only if true
 *   exclude         optional RegExp; drop if the PATH or the matched LINE matches
 *   fileRequires    optional RegExp the whole file must match
 *   fileAbsent      optional RegExp the whole file must NOT match (file-level rule: first match only)
 *   pubspecRequires optional RegExp the app's pubspec.yaml must match
 *   nearbyExclude   optional { pattern, before }: drop if one of the `before` lines above matches
 *   once            true: report only the first match in a file
 *   pathOnly        true: the file's presence is the lead (no content read); skipped when git ignores it
 *   severity        blocker | high | medium | low | info
 *                   blocker = the store rejects the build, or the release build is broken
 *   store           play | app-store | both
 *   guide           checks/<FILE>.md#anchor
 *
 * Project rules (module.exports.project): cross-file checks, function(ctx) → leads.
 */

const GRADLE = /(^|\/)android\/app\/build\.gradle(\.kts)?$/;
const MAIN_MANIFEST = /(^|\/)android\/app\/src\/main\/AndroidManifest\.xml$/;
const ANY_MANIFEST = /(^|\/)android\/app\/src\/\w+\/AndroidManifest\.xml$/;
const RUNNER_PLIST = /(^|\/)ios\/Runner\/Info\.plist$/;
const PBXPROJ = /(^|\/)ios\/Runner\.xcodeproj\/project\.pbxproj$/;
const PUBSPEC = /(^|\/)pubspec\.yaml$/;
const LIB_DART = /(^|\/)lib\/.+\.dart$/;
const pkgs = (...names) => new RegExp(`^\\s{2}(${names.join('|')})\\s*:`, 'm');

// iOS purpose strings: missing ones crash the app on first access and fail App Store
// processing with ITMS-90683. Keyed by the plugins that need them.
const PURPOSE_STRINGS = [
  ['002', 'NSCameraUsageDescription', 'camera', ['camera', 'mobile_scanner', 'qr_code_scanner', 'qr_code_scanner_plus', 'ai_barcode_scanner', 'flutter_barcode_scanner']],
  ['003', 'NSPhotoLibraryUsageDescription', 'photo library', ['image_picker', 'photo_manager', 'wechat_assets_picker', 'image_gallery_saver', 'image_gallery_saver_plus', 'gal', 'multi_image_picker']],
  ['004', 'NSLocationWhenInUseUsageDescription', 'location', ['geolocator', 'location', 'flutter_background_geolocation', 'background_location']],
  ['005', 'NSMicrophoneUsageDescription', 'microphone', ['record', 'flutter_sound', 'speech_to_text', 'audio_waveforms', 'agora_rtc_engine', 'flutter_webrtc', 'livekit_client']],
  ['006', 'NSContactsUsageDescription', 'contacts', ['flutter_contacts', 'contacts_service', 'fast_contacts']],
  ['007', 'NSFaceIDUsageDescription', 'Face ID', ['local_auth']],
  ['008', 'NSBluetoothAlwaysUsageDescription', 'Bluetooth', ['flutter_blue_plus', 'flutter_reactive_ble', 'flutter_blue', 'universal_ble']],
  ['009', 'NSSpeechRecognitionUsageDescription', 'speech recognition', ['speech_to_text']],
].map(([n, key, what, plugins]) => ({
  id: `FRC-IOS-${n}`,
  title: `Missing ${key} (${what})`,
  severity: 'blocker',
  store: 'app-store',
  files: RUNNER_PLIST,
  pubspecRequires: pkgs(...plugins),
  fileAbsent: new RegExp(`<key>${key}</key>`),
  pattern: /<dict>/g,
  guide: 'IOS.md#purpose-strings',
  message: `pubspec.yaml uses a plugin that accesses the ${what} (${plugins.join(', ')}), but Info.plist has no ${key}. iOS kills the app on first access, and App Store Connect rejects the upload (ITMS-90683).`,
  fix: `Add <key>${key}</key><string>…a sentence saying why your app needs the ${what}…</string> to ios/Runner/Info.plist.`,
}));

module.exports = [
  // ---------------------------------------------------------------- Android
  {
    id: 'FRC-AND-001',
    title: 'Template applicationId (com.example)',
    severity: 'blocker',
    store: 'play',
    files: GRADLE,
    pattern: /\bapplicationId\s*(=\s*)?["']com\.example\.[^"']*["']/g,
    guide: 'ANDROID.md#application-id',
    message: 'Google Play does not accept package names starting with com.example. The applicationId can never change after the first upload.',
    fix: 'Pick your final reverse-domain id (e.g. uz.yourcompany.app) and set it in android/app/build.gradle (applicationId and namespace) before the first upload.',
  },
  {
    id: 'FRC-AND-002',
    title: 'Release build signed with the debug key',
    severity: 'blocker',
    store: 'play',
    files: GRADLE,
    pattern: /(?<=\brelease\s*\{[^}]*?)\bsigningConfig\s*(=\s*)?signingConfigs\.(debug\b|getByName\(\s*["']debug["']\s*\))/g,
    guide: 'ANDROID.md#release-signing',
    message: 'The Flutter template signs release builds with the debug key ("TODO: Add your own signing config"). Play Console rejects debug-signed bundles.',
    fix: 'Create an upload keystore, load it from key.properties (kept out of git), and point buildTypes.release.signingConfig at signingConfigs.release.',
  },
  {
    id: 'FRC-AND-003',
    title: 'targetSdk below the Google Play requirement',
    severity: 'blocker',
    store: 'play',
    files: GRADLE,
    pattern: /\btargetSdk(Version)?\s*(=\s*)?(\d{2})\b/g,
    when: (m) => Number(m[3]) < 35,
    guide: 'ANDROID.md#target-sdk',
    message: 'Google Play requires new apps and app updates to target Android 15 (API 35) since 31 August 2025, and raises the bar every year. Lower targets are rejected at upload.',
    fix: 'Use targetSdk = flutter.targetSdkVersion on a current Flutter, or set 35+ and test runtime-permission and edge-to-edge changes.',
  },
  {
    id: 'FRC-AND-004',
    title: 'INTERNET permission missing from the release manifest',
    severity: 'high',
    store: 'play',
    files: MAIN_MANIFEST,
    pubspecRequires: pkgs('http', 'dio', 'web_socket_channel', 'cached_network_image', 'graphql_flutter', 'chopper', 'retrofit', 'supabase_flutter', 'google_fonts', 'socket_io_client', 'grpc'),
    fileAbsent: /android\.permission\.INTERNET/,
    pattern: /<manifest\b/g,
    guide: 'ANDROID.md#internet-permission',
    message: 'The Flutter template only declares INTERNET in the debug and profile manifests. Network calls work in debug and silently fail in the release build, unless a plugin adds the permission through manifest merging.',
    fix: 'Add <uses-permission android:name="android.permission.INTERNET"/> to android/app/src/main/AndroidManifest.xml.',
  },
  {
    id: 'FRC-AND-005',
    title: 'Permission that needs a Play Console declaration',
    severity: 'medium',
    store: 'play',
    files: ANY_MANIFEST,
    pattern: /android\.permission\.(READ_SMS|RECEIVE_SMS|SEND_SMS|READ_CALL_LOG|WRITE_CALL_LOG|PROCESS_OUTGOING_CALLS|MANAGE_EXTERNAL_STORAGE|QUERY_ALL_PACKAGES|ACCESS_BACKGROUND_LOCATION|REQUEST_INSTALL_PACKAGES|READ_MEDIA_IMAGES|READ_MEDIA_VIDEO|USE_FULL_SCREEN_INTENT|USE_EXACT_ALARM|BIND_ACCESSIBILITY_SERVICE|FOREGROUND_SERVICE_[A-Z_]+)\b/g,
    guide: 'ANDROID.md#restricted-permissions',
    message: 'Google Play restricts this permission. Without a matching use case and a declaration form in Play Console, the release is rejected or the app is removed later.',
    fix: 'Remove it if a narrower API exists (photo picker instead of READ_MEDIA_*, intent instead of SMS), otherwise fill in the Play Console declaration and show the feature in the review video.',
  },
  {
    id: 'FRC-AND-006',
    title: 'Signing keystore or key.properties in the project',
    severity: 'high',
    store: 'play',
    files: /(^|\/)(key\.properties|[^/]+\.(jks|keystore))$/,
    exclude: /(^|\/)debug\.keystore$/,
    pathOnly: true,
    guide: 'ANDROID.md#keystore-in-the-repo',
    message: 'A committed upload key plus its password lets anyone who sees the repo sign builds as you. Git history keeps it even after deletion.',
    fix: 'Add key.properties and *.jks to android/.gitignore, keep them in a password manager or CI secrets, and if they were pushed, reset the upload key in Play Console.',
  },
  {
    id: 'FRC-AND-007',
    title: 'App label looks like the project name',
    severity: 'low',
    store: 'play',
    files: MAIN_MANIFEST,
    pattern: /android:label\s*=\s*"([a-z][a-z0-9]*_[a-z0-9_]+)"/g,
    guide: 'ANDROID.md#app-name',
    message: 'The launcher shows this label under the icon. The template uses the Dart package name (my_app), which looks unfinished.',
    fix: 'Set a human name: android:label="My App", or @string/app_name for translations.',
  },

  // ---------------------------------------------------------------- iOS
  {
    id: 'FRC-IOS-001',
    title: 'Template bundle identifier (com.example)',
    severity: 'high',
    store: 'app-store',
    files: PBXPROJ,
    pattern: /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*"?com\.example\.[^;"]*"?;/g,
    exclude: /RunnerTests/,
    once: true,
    guide: 'IOS.md#bundle-identifier',
    message: 'The bundle id is the app\'s permanent identity in App Store Connect and cannot be changed after the first upload. com.example belongs to the template.',
    fix: 'Register your own id in the Apple Developer portal and set it in Xcode (Runner → Signing & Capabilities) for every configuration.',
  },
  ...PURPOSE_STRINGS,
  {
    id: 'FRC-IOS-015',
    title: 'image_picker without NSCameraUsageDescription',
    severity: 'medium',
    store: 'app-store',
    files: RUNNER_PLIST,
    pubspecRequires: pkgs('image_picker'),
    fileAbsent: /<key>NSCameraUsageDescription<\/key>/,
    pattern: /<dict>/g,
    guide: 'IOS.md#purpose-strings',
    message: 'image_picker documents NSCameraUsageDescription as required. If the app ever calls pickImage(source: ImageSource.camera), iOS terminates it without this key. Gallery-only apps can ship without it.',
    fix: 'Add <key>NSCameraUsageDescription</key> with a specific reason, or confirm ImageSource.camera is never used.',
  },
  {
    id: 'FRC-IOS-010',
    title: 'Empty or placeholder purpose string',
    severity: 'high',
    store: 'app-store',
    files: RUNNER_PLIST,
    pattern: /<key>NS\w+UsageDescription<\/key>\s*<string>\s*(TODO[^<]*|FIXME[^<]*|test|description|permission|\$\([^)]*\)|)\s*<\/string>/gi,
    guide: 'IOS.md#purpose-strings',
    message: 'App Review rejects vague or empty permission texts (Guideline 5.1.1). The text must say what the data is used for.',
    fix: 'Write a specific sentence, e.g. "Used to scan the QR code on your order receipt."',
  },
  {
    id: 'FRC-IOS-011',
    title: 'Export compliance not declared',
    severity: 'info',
    store: 'app-store',
    files: RUNNER_PLIST,
    fileAbsent: /ITSAppUsesNonExemptEncryption/,
    pattern: /<dict>/g,
    guide: 'IOS.md#export-compliance',
    message: 'Without ITSAppUsesNonExemptEncryption, every build waits in App Store Connect / TestFlight for the export compliance question.',
    fix: 'If the app only uses HTTPS and OS crypto, add <key>ITSAppUsesNonExemptEncryption</key><false/>. Otherwise answer the questionnaire honestly.',
  },
  {
    id: 'FRC-IOS-012',
    title: 'Display name looks like the project name',
    severity: 'low',
    store: 'app-store',
    files: RUNNER_PLIST,
    pattern: /<key>CFBundle(Display)?Name<\/key>\s*<string>([a-z][a-z0-9]*_[a-z0-9_]+)<\/string>/g,
    guide: 'IOS.md#app-name',
    message: 'The Home Screen shows CFBundleDisplayName. The template sets it to the Dart package name.',
    fix: 'Set CFBundleDisplayName to the real app name (and localize it in InfoPlist.strings if needed).',
  },
  {
    id: 'FRC-IOS-013',
    title: 'Background modes to justify in review',
    severity: 'info',
    store: 'app-store',
    files: RUNNER_PLIST,
    pattern: /<key>UIBackgroundModes<\/key>/g,
    guide: 'IOS.md#background-modes',
    message: 'App Review rejects background modes the app does not visibly need (Guideline 2.5.4), and location/audio modes get extra scrutiny.',
    fix: 'Keep only the modes the app uses, and explain each one in the review notes.',
  },

  // ---------------------------------------------------------------- Dart / pubspec
  {
    id: 'FRC-DART-001',
    title: 'Development server URL in app code',
    severity: 'medium',
    store: 'both',
    files: LIB_DART,
    pattern: /['"]https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?/g,
    exclude: /kDebugMode|kReleaseMode|isDebug|\bdev\b|develop|\b(hint|hintText|placeholder|labelText|helperText|example)\b/i,
    nearbyExclude: { pattern: /kDebugMode|!kReleaseMode|kProfileMode|assert\(|\b(test|demo|debug)\w*\s*\(/i, before: 6 },
    guide: 'FLUTTER.md#dev-server-urls',
    message: 'A localhost / emulator / LAN address only works on the developer machine. If release code can reach it, the store build shows a network error, and reviewers reject apps that do not work.',
    fix: 'Read the base URL from --dart-define / flavors (String.fromEnvironment("API_URL")) and make the release default your production https URL.',
  },
  {
    id: 'FRC-DART-002',
    title: 'dependency_overrides in pubspec.yaml',
    severity: 'medium',
    store: 'both',
    files: PUBSPEC,
    pattern: /^dependency_overrides\s*:/gm,
    guide: 'FLUTTER.md#dependency-overrides',
    message: 'Overrides force versions the packages were not tested with. Fine while debugging, risky in a store build.',
    fix: 'Remove the override once upstream is fixed, or pin the fork with a git ref and a comment saying why.',
  },
  {
    id: 'FRC-DART-003',
    title: 'Git dependency without a pinned ref',
    severity: 'low',
    store: 'both',
    files: PUBSPEC,
    pattern: /^(\s+)git:\s*(?:['"]?https?:\/\/[^\s'"]+['"]?\s*$|\n((?:\1\s+\w+:[^\n]*\n?)+))/gm,
    when: (m) => !/\bref\s*:/.test(m[2] || ''),
    guide: 'FLUTTER.md#git-dependencies',
    message: 'Without ref:, every clean build can pull a different commit of this package, so the store build may not be the one you tested.',
    fix: 'Add ref: <tag or commit sha> under the git: entry.',
  },
  {
    id: 'FRC-DART-004',
    title: 'Template version (1.0.0+1)',
    severity: 'info',
    store: 'both',
    files: PUBSPEC,
    pattern: /^version:\s*1\.0\.0\+1\s*$/gm,
    guide: 'FLUTTER.md#version-and-build-number',
    message: 'Fine for the very first upload. Every later upload needs a higher build number (the part after +), or both stores reject it.',
    fix: 'Bump the build number for every upload (flutter build … --build-number, or edit version: x.y.z+N).',
  },
  {
    id: 'FRC-DART-005',
    title: 'Template description in pubspec.yaml',
    severity: 'info',
    store: 'both',
    files: PUBSPEC,
    pattern: /^description:\s*["']?A new Flutter (project|application)\.?["']?\s*$/gm,
    guide: 'FLUTTER.md#pubspec-description',
    message: 'Not shown in the stores, but a sign the project metadata was never filled in.',
    fix: 'Write a one-line description of the app.',
  },
];

// ---------------------------------------------------------------- project rules
const SIGNUP = /createUserWithEmailAndPassword|\.signUp\s*\(|signUpWithEmail|\bregisterUser\s*\(|['"]\/?(api\/)?(auth\/)?(register|signup|sign-up)['"]/;
const DELETION = /\.delete\s*\(\s*\)|deleteUser|deleteAccount|delete_account|deleteMe\b|removeAccount|accountDeletion|['"]\/?(api\/)?(auth\/)?(account|user|me)['"][^\n]*\.delete\b|\bdelete\s*\(\s*['"][^'"]*(account|user|me)['"]/i;

module.exports.project = [
  {
    id: 'FRC-POL-001',
    title: 'Account creation without in-app account deletion',
    severity: 'high',
    store: 'both',
    guide: 'POLICY.md#account-deletion',
    message: 'Apple (Guideline 5.1.1(v)) and Google Play both require apps that let users create an account to also let them delete it, starting from inside the app.',
    fix: 'Add a "Delete account" action in settings that deletes the account and its data on the server (and on Google Play, also publish a web deletion link in the Data safety form).',
    check(ctx) {
      const dart = ctx.files.filter((f) => LIB_DART.test(f));
      let signup = null;
      for (const f of dart) {
        const text = ctx.read(f);
        if (DELETION.test(text)) return [];
        if (!signup) {
          const m = SIGNUP.exec(text);
          if (m) signup = { file: f, index: m.index, text };
        }
      }
      return signup ? [ctx.lead(signup.file, signup.text, signup.index)] : [];
    },
  },
  {
    id: 'FRC-POL-002',
    title: 'Third-party login without Sign in with Apple',
    severity: 'medium',
    store: 'app-store',
    guide: 'POLICY.md#third-party-login',
    message: 'Guideline 4.8: an iOS app that offers Google/Facebook/other third-party login must also offer an equivalent privacy-focused login option. Sign in with Apple is the usual way to satisfy it.',
    fix: 'Add sign_in_with_apple (and the capability in Xcode), or document in review notes which exemption applies (e.g. company accounts only).',
    check(ctx) {
      if (!ctx.pubspec || !ctx.files.some((f) => RUNNER_PLIST.test(f))) return [];
      const m = pkgs('google_sign_in', 'flutter_facebook_auth', 'flutter_login_facebook', 'twitter_login').exec(ctx.pubspec.text);
      if (!m || pkgs('sign_in_with_apple', 'the_apple_sign_in').test(ctx.pubspec.text)) return [];
      return [ctx.lead(ctx.pubspec.file, ctx.pubspec.text, m.index + m[0].indexOf(m[1]))];
    },
  },
  {
    id: 'FRC-IOS-014',
    title: 'No app privacy manifest (PrivacyInfo.xcprivacy)',
    severity: 'low',
    store: 'app-store',
    guide: 'IOS.md#privacy-manifest',
    message: 'Since May 2024 App Store Connect flags apps whose own code uses "required reason" APIs (UserDefaults, file timestamps, disk space, boot time) without declaring them (ITMS-91053). Flutter and most plugins ship their own manifests; the Runner target may still need one.',
    fix: 'In Xcode: File → New → File → App Privacy, add it to the Runner target, and declare the APIs and data types your native code and SDKs use.',
    check(ctx) {
      const plist = ctx.files.find((f) => RUNNER_PLIST.test(f));
      if (!plist || ctx.files.some((f) => /(^|\/)ios\/Runner\/PrivacyInfo\.xcprivacy$/.test(f))) return [];
      return [ctx.lead(plist, ctx.read(plist), 0)];
    },
  },
];
