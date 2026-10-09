# Как да пуснеш Rocket Snail в App Store (и Google Play)

Тук е всичко стъпка по стъпка. Не ти трябва Mac – сглобяването на играта става
в облака на Expo (услугата се казва **EAS**).

> Всички команди се пишат в терминала, в папката на проекта (както при `npx expo start`).

---

## 0. Какво ти трябва

| Какво | Цена | Къде |
|---|---|---|
| Акаунт в Expo | безплатно | https://expo.dev/signup |
| Apple Developer Program | 99 $ на година | https://developer.apple.com/programs/enroll/ |
| (по желание) Google Play Console | 25 $ еднократно | https://play.google.com/console/signup |

Регистрацията в Apple може да отнеме 1–2 дни (проверяват самоличността ти).

---

## 1. Провери името на пакета (само веднъж!)

В `app.json` има два реда:

```
"bundleIdentifier": "com.me7kodev.rocketsnail"   (за iPhone)
"package": "com.me7kodev.rocketsnail"            (за Android)
```

Това е „паспортът“ на играта. Трябва да е уникален в целия свят и **не може да се
сменя след първото качване**. Ако искаш друг (например с твоето име), смени го сега.
Само малки латински букви, цифри и точки.

---

## 2. Публикувай политиката за поверителност

Apple и Google искат линк към страница „Privacy Policy“. Текстът е готов:
`docs/PRIVACY.md`.

Най-лесно:
- Ако хранилището в GitHub е **публично**, линкът е:
  `https://github.com/me7ko-dev/Rocknet-Snail/blob/main/docs/PRIVACY.md`
  (след като промените влязат в клона `main`).
- Ако е **частно**, създай безплатна страница в https://sites.google.com, постави
  текста и използвай нейния адрес.

---

## 3. Влез в Expo и свържи проекта

```
npx eas-cli@latest login
npx eas-cli@latest init
```

Втората команда създава проекта в твоя Expo акаунт и добавя `projectId` в `app.json`.
Запиши промяната в Git.

---

## 4. Сглоби играта за iPhone

```
npx eas-cli@latest build --platform ios --profile production
```

Ще те попита:
- **Apple ID и парола** → въведи тези от Apple Developer акаунта.
- **„Generate a new Apple Distribution Certificate?“** → `Y`
- **„Generate a new Apple Provisioning Profile?“** → `Y`

EAS прави всичко сам. Сглобяването отнема ~15–25 минути. Накрая получаваш линк.

---

## 5. Качи я в App Store Connect

```
npx eas-cli@latest submit --platform ios --latest
```

Първия път ще те пита дали да създаде приложението в App Store Connect – отговори `Y`.
След ~10–30 минути Apple обработва билда и той се появява в **TestFlight**.

### Тествай с TestFlight (препоръчително)

1. Инсталирай **TestFlight** от App Store на iPhone-а си.
2. В https://appstoreconnect.apple.com → твоето приложение → **TestFlight** →
   добави себе си в „Internal Testing“.
3. Отвори TestFlight на телефона и инсталирай Rocket Snail. Това е истинската
   версия, която ще видят хората.

---

## 6. Попълни страницата в магазина

В App Store Connect → твоето приложение:

1. **App Information**: категория *Games → Arcade*, втора *Casual*.
2. **Pricing and Availability**: Free (безплатно), всички държави.
3. **App Privacy**: „Data Not Collected“. Privacy Policy URL – от стъпка 2.
4. **Age Rating**: на всичко „None“/„No“ → 4+.
5. **Версия 1.0.0**:
   - Текстове → копирай от `store/LISTING.md` (английски; после „+“ → Bulgarian за българския).
   - Screenshots → „6.9" Display“ → качи 4-те картинки от `store/app-store/iphone-6.9/en/`
     (за българската страница – от `.../bg/`).
   - „13" iPad Display“ → картинките от `store/app-store/ipad-13/en/`.
   - Build → избери билда от стъпка 5.
   - Support URL → линкът към GitHub хранилището или страницата от стъпка 2.
6. Натисни **Add for Review** → **Submit**.

Прегледът от Apple обикновено отнема 1–3 дни. Ще получиш имейл.

---

## 7. (По желание) Google Play

```
npx eas-cli@latest build --platform android --profile production
```

Създава `.aab` файл. В Google Play Console:
1. Create app → Rocket Snail, Game, Free.
2. Попълни „App content“ (поверителност, реклами: *No ads*, Data safety: *No data collected*,
   Content rating) – отговорите са в `store/LISTING.md`.
3. Main store listing → текстове от `store/LISTING.md`, картинки от `store/google-play/`.
4. Testing → Internal testing → качи `.aab` файла → тествай → после Production.

Първото качване в Google Play се прави ръчно (свали `.aab` от линка на EAS).

Ако искаш само да пробваш истинска Android версия без магазина:
```
npx eas-cli@latest build --platform android --profile preview
```
Това дава `.apk` файл, който се инсталира директно на телефона.

---

## Нова версия по-късно

1. Смени `"version"` в `app.json` (например `1.0.0` → `1.1.0`).
2. Пак стъпки 4 и 5 (номерът на билда се вдига сам).
3. В App Store Connect добави нова версия, избери билда, Submit.

---

## Реклами и покупки по-късно

Кодът е подготвен: `src/services/ads.ts` и `src/services/purchases.ts`.
Те **не работят в Expo Go** – тогава ще трябва „development build“
(`npx eas-cli@latest build --profile development`). Кажи ми, когато решиш, и ще ги добавим.
