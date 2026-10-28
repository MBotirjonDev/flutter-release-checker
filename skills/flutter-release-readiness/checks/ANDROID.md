# Android / Google Play

Store requirements change every year. Treat dates and API levels here as the baseline
the checker enforces, and confirm against the
[Play Console policy center](https://support.google.com/googleplay/android-developer/topic/9858052)
before a release.

## Checklist

- [ ] Final `applicationId` and `namespace` (never `com.example.*`); it is permanent after the first upload
- [ ] Release build signed with your **upload key**, loaded from `key.properties` that is not in git
- [ ] Play App Signing enabled (recommended; lets you reset a lost upload key)
- [ ] `targetSdk` meets the current Play requirement
- [ ] `INTERNET` in `src/main/AndroidManifest.xml` if the app talks to a network
- [ ] Only permissions the app uses; restricted ones have a Play Console declaration
- [ ] Human app name in `android:label`, adaptive launcher icon, no template icon
- [ ] `flutter build appbundle --release` (AAB, not APK) with a higher build number than the last upload
- [ ] Consider `--obfuscate --split-debug-info=build/symbols` and upload the symbols for crash reports

## Application id

`applicationId` (in `android/app/build.gradle` or `.kts`) is the app's identity on Google
Play and on the device. Play Console refuses `com.example` ids, and once a version is
uploaded the id can never change: a new id means a new app with zero installs and reviews.
Use a reverse domain you control (`uz.yourcompany.appname`). Keep `namespace` in sync and
move `MainActivity.kt` to the matching package.

## Release signing

The Flutter template ships:

```groovy
release {
    // TODO: Add your own signing config for the release build.
    signingConfig = signingConfigs.debug
}
```

Debug-signed bundles are rejected by Play Console. Set up an upload key once:

```bash
keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

```kotlin
// android/app/build.gradle.kts
val keystoreProperties = Properties().apply {
    rootProject.file("key.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
android {
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }
    buildTypes { release { signingConfig = signingConfigs.getByName("release") } }
}
```

**Validate:** a `hasKeystore ? release : debug` fallback is fine for CI builds that are
never uploaded; flag it only if the store build could take the debug branch.

## Target SDK

Google Play requires new apps and updates to target a recent API level. Since
**31 August 2025** that is **API 35 (Android 15)**; the bar typically rises each August.
Apps below the bar cannot be uploaded (existing apps also stop being shown to users on
newer devices). On current Flutter, `targetSdk = flutter.targetSdkVersion` follows the
SDK; a hard-coded number needs a manual bump. Test edge-to-edge layout and
the photo picker after raising it.

## INTERNET permission

`flutter create` puts `<uses-permission android:name="android.permission.INTERNET"/>` in
`src/debug/` and `src/profile/` manifests only. Debug builds work; the store build has no
network. Plugins can add the permission through manifest merging (Firebase does, `http`
and `dio` do not), so **validate** with the merged manifest:
`build/app/intermediates/merged_manifests/release/**/AndroidManifest.xml`, or just add it
to `src/main/AndroidManifest.xml`.

## Restricted permissions

These need a declaration form in Play Console and a use case Google accepts. Without one
the release is rejected, or the app is removed later:

| Permission | Policy | Usual alternative |
|---|---|---|
| `READ_SMS`, `RECEIVE_SMS`, `SEND_SMS`, call log permissions | SMS & Call Log | SMS Retriever / User Consent API for OTP |
| `MANAGE_EXTERNAL_STORAGE` | All files access | Storage Access Framework, MediaStore |
| `QUERY_ALL_PACKAGES` | Package visibility | `<queries>` for specific packages or intents |
| `ACCESS_BACKGROUND_LOCATION` | Background location | Foreground location while in use |
| `REQUEST_INSTALL_PACKAGES` | Request install packages | Only for app stores / file managers |
| `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` | Photo & video permissions | Android photo picker (`image_picker` uses it) |
| `USE_FULL_SCREEN_INTENT` | Full-screen intent | Only calling / alarm apps |
| `USE_EXACT_ALARM` | Exact alarms | `SCHEDULE_EXACT_ALARM` or inexact alarms |
| `FOREGROUND_SERVICE_*` | Foreground service types (target 34+) | WorkManager for deferrable work |
| `BIND_ACCESSIBILITY_SERVICE` | Accessibility API | Only real accessibility tools |

Plugins can add permissions too; check the merged manifest and remove unwanted ones with
`tools:node="remove"`.

## Keystore in the repo

`key.properties`, `*.jks` and `*.keystore` must never be committed. Anyone with the repo
can sign builds as you. The checker skips files git ignores; anything it reports is
either tracked or the project is not a git repo. If a key was pushed: rotate the upload
key (Play Console → App integrity → Request upload key reset) and purge history.

## App name

`android:label` is the name under the launcher icon. The template sets it to the Dart
package name (`my_shop`). Use the product name, or `@string/app_name` with translations in
`res/values-*/strings.xml`.
