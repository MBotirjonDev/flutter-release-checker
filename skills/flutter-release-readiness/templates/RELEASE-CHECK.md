# Release check: {{app}} {{version}}

| | |
|---|---|
| Commit | `{{commit}}` |
| Date | {{date}} |
| Stores | {{Google Play / App Store}} |
| Release type | {{first release / update}} |

## Verdict

| Store | Verdict | Blockers | Other issues |
|---|---|---:|---:|
| Google Play | {{Ready / Ready after N fixes / Not ready}} | {{n}} | {{n}} |
| App Store | {{…}} | {{n}} | {{n}} |

{{2–3 sentences: the most important thing to fix and how long it takes.}}

## Blockers

### 1. {{title}} ({{Play / App Store}})

**Where:** `{{file}}:{{line}}`

**Why it blocks:** {{store rule, with date or guideline number}}

**Fix**
```diff
- {{before}}
+ {{after}}
```

---

## Other issues

| Severity | Issue | Where | Fix |
|---|---|---|---|
| high | {{…}} | `{{file}}:{{line}}` | {{…}} |

## Only you can do this

- [ ] {{e.g. Create the upload keystore and fill android/key.properties (do not commit it)}}
- [ ] {{e.g. Play Console → App content → Data safety: declare …}}
- [ ] {{e.g. App Store Connect → App Privacy: …}}
- [ ] {{e.g. Add a demo account in the review notes}}

## Release commands

```bash
{{flutter build appbundle … / flutter build ipa …}}
```

_Checked with [Flutter Release Checker](https://github.com/MBotirjonDev/flutter-release-checker). Store requirements change; confirm time-bound items in Play Console and App Store Connect._
