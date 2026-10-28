# iOS / App Store

## Checklist

- [ ] Final bundle identifier registered in the Apple Developer portal, set for Debug/Release/Profile
- [ ] Signing team set; distribution certificate + App Store provisioning profile (or automatic signing)
- [ ] A purpose string (`NS…UsageDescription`) for every protected resource the app or its plugins access
- [ ] Purpose strings are specific sentences, localized if the app is
- [ ] `ITSAppUsesNonExemptEncryption` declared
- [ ] Privacy manifest for the Runner target if native code or SDKs use required-reason APIs
- [ ] Only the background modes the app really uses
- [ ] App icon in `Assets.xcassets` (1024×1024, no alpha), launch screen not the Flutter default
- [ ] Human display name
- [ ] `flutter build ipa --release` with a higher build number than the last upload

## Bundle identifier

`PRODUCT_BUNDLE_IDENTIFIER` in `ios/Runner.xcodeproj/project.pbxproj` is the app's
permanent identity in App Store Connect. The template uses `com.example.<name>`. Register
your own id (`uz.yourcompany.appname`), then set it in Xcode → Runner → Signing &
Capabilities for every configuration. Extensions (widgets, notification service) need ids
prefixed by the app id.

## Purpose strings

iOS terminates the app the first time it touches a protected resource without the
matching `Info.plist` key, and App Store Connect rejects uploads whose binary references
those APIs without them (**ITMS-90683: Missing purpose string**).

| Plugin(s) | Key(s) |
|---|---|
| `camera`, `mobile_scanner`, QR/barcode scanners | `NSCameraUsageDescription` (+ `NSMicrophoneUsageDescription` if recording video with audio) |
| `image_picker` | `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` if using `ImageSource.camera` |
| `geolocator`, `location` | `NSLocationWhenInUseUsageDescription` (+ `…AlwaysAndWhenInUse…` for background) |
| `record`, `flutter_sound`, WebRTC/Agora/LiveKit | `NSMicrophoneUsageDescription` |
| `speech_to_text` | `NSSpeechRecognitionUsageDescription`, `NSMicrophoneUsageDescription` |
| `flutter_contacts`, `contacts_service` | `NSContactsUsageDescription` |
| `local_auth` | `NSFaceIDUsageDescription` |
| `flutter_blue_plus`, `flutter_reactive_ble` | `NSBluetoothAlwaysUsageDescription` |
| `permission_handler` | whatever you request, and remove unused ones via Podfile macros |

App Review also rejects vague text (Guideline 5.1.1): "This app needs your camera" or
`TODO` is not enough. Say what feature uses it: *"Used to scan the QR code on your
delivery receipt."*

**Validate:** the checker reads `pubspec.yaml`. A plugin listed but never called can still
trigger ITMS-90683, because the plugin's native code references the API.

## Export compliance

Every build asks whether the app uses non-exempt encryption. Apps that only use HTTPS and
Apple's crypto usually answer *no*; declare it once:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

If the app ships its own crypto (custom VPN, E2E messaging), answer honestly and follow
the export documentation flow instead.

## Privacy manifest

Since 1 May 2024, App Store Connect requires a reason for each "required reason API" used
by the app (`UserDefaults`, file timestamps, system boot time, disk space, active
keyboards) and flags missing ones with **ITMS-91053**. The Flutter engine and maintained
plugins ship their own `PrivacyInfo.xcprivacy`. The Runner target needs one when your
own Swift/Objective-C code (or an SDK without a manifest) uses those APIs, and it is also
where you declare collected data types and tracking domains.

Create it in Xcode (File → New → File → App Privacy), add it to the Runner target, and
keep it consistent with the App Privacy answers in App Store Connect.

## Background modes

`UIBackgroundModes` entries must match a visible feature (Guideline 2.5.4). `location`
needs a clear reason to track in the background; `audio` only for audible playback or
recording; `fetch` / `processing` with BGTaskScheduler identifiers registered. Remove
modes left over from plugin examples.

## App name

`CFBundleDisplayName` is the name under the Home Screen icon; the template sets it to
the package name. Localize it with `InfoPlist.strings` if needed.
