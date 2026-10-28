# Store policy (the rejections that are not about code)

Policies change. Quote guideline numbers from the current
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and
[Google Play Developer Policy Center](https://play.google.com/about/developer-content-policy/)
when you report these.

## Checklist

- [ ] In-app account deletion if users can create accounts
- [ ] Equivalent privacy-focused login option on iOS when third-party login is offered
- [ ] Privacy policy URL in both store listings **and** inside the app
- [ ] Google Play Data safety form and App Store privacy "nutrition label" match what the app and its SDKs collect
- [ ] Digital goods and subscriptions use in-app purchase where required; restore purchases button on iOS
- [ ] Demo account (or demo mode) and review notes for any login-gated app
- [ ] No placeholder content, broken links, "beta" labels or test data in screens and screenshots
- [ ] Content rating questionnaire (Play) and age rating (App Store) filled in honestly
- [ ] Google Play: new personal developer accounts must run a closed test before production access

## Account deletion

**Apple 5.1.1(v)** (since June 2022): apps that support account creation must let users
initiate account deletion from within the app. Deactivating or "contact support" is not
enough. **Google Play** (since 2024): apps with account creation must offer deletion in
the app **and** through a web link declared in the Data safety form, and delete the
associated data (or explain what is retained and why).

```dart
Future<void> deleteAccount() async {
  await api.delete('/me');                         // server deletes the account and its data
  await FirebaseAuth.instance.currentUser?.delete(); // may require recent login
}
```

**Validate:** the checker only looks for sign-up calls and any deletion call in `lib/`.
Confirm the deletion is reachable in the UI (Settings → Delete account) and that the
server really deletes the data.

## Third-party login

**Apple 4.8:** if an iOS app uses a third-party or social login (Google, Facebook, …) as
the primary account, it must also offer an equivalent login option that limits data
collection to name and email, lets users keep their email private, and does not track
them. Sign in with Apple meets all three and is the usual answer. Exemptions exist: the
app only uses your own company's accounts, is an education/enterprise app with existing
accounts, is a client for a specific third-party service, or uses government/eID login.

```yaml
dependencies:
  sign_in_with_apple: ^6.1.0
```

Also enable the *Sign in with Apple* capability in Xcode and in the App ID.
