# Flutter Release Checker 🇺🇿

**Flutter ilovangizni Google Play va App Store'ga birinchi urinishda chiqaring.**

Bu agent skill Flutter loyihasini Play Console, App Store Connect va App Review qanday
tekshirsa, xuddi shunday tekshiradi. Yonida bog'liqliksiz checker ham bor: kompyuterda va
CI'da ishlaydi.

[English README](README.md)

## Nega kerak

`flutter create` ishlaydigan ilova beradi, lekin do'kon qabul qiladigan ilova emas.
Birinchi relizda deyarli hamma shu xatolarga uchraydi:

- `com.example` paket nomi, release build'ning **debug kalit** bilan imzolangani, eski `targetSdk`
- `INTERNET` ruxsati faqat debug manifestda: do'kondagi ilovada **internet ishlamaydi**
- **ITMS-90683**: qo'shilgan plagin uchun Info.plist'da ruxsat matni yo'q
- ilova ichida **akkauntni o'chirish** imkoniyati yo'q (Apple 5.1.1(v), Google Play)
- Google orqali kirish bor, lekin **Sign in with Apple** yo'q (Apple 4.8)

Har biri bir necha kunlik qayta ko'rib chiqishga sabab bo'ladi.

## Tez boshlash

```bash
npx skills add https://github.com/MBotirjonDev/flutter-release-checker --skill flutter-release-readiness --global
```

So'ng agentga yozing:

```
is my flutter app ready for the app store?
```

Faqat checker (Node 18+, Flutter SDK kerak emas):

```bash
node skills/flutter-release-readiness/scripts/check.cjs path/to/your_app
```

## Natija

Agent har bir topilmani loyihada tasdiqlaydi, xavfsiz tuzatishlarni kiritadi va
`RELEASE-CHECK.md` yozadi. Unda har bir do'kon bo'yicha xulosa, tuzatish kodi bilan
blokerlar va faqat siz to'ldira oladigan formalar ro'yxati bo'ladi.

Agent kalit fayllar va parollarni hech qachon yaratmaydi, ko'rsatmaydi va commit qilmaydi.

MIT litsenziyasi. Google, Apple yoki Flutter jamoasi bilan bog'liq emas.
