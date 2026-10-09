# Текстове за App Store и Google Play

Копирай ги в App Store Connect / Google Play Console. Английският е основният език,
българският се добавя като втори („Localization“ → Bulgarian).

Картинките са в папките:

- `store/app-store/iphone-6.9/` – за iPhone (6.9" дисплей, 2868×1320)
- `store/app-store/ipad-13/` – за iPad (13" дисплей, 2752×2064)
- `store/google-play/phone/` – за Google Play (1920×1080)
- `store/google-play/feature-graphic.png` – банерът за Google Play (1024×500)
- Иконата за магазините е `assets/icon.png` (1024×1024, без прозрачност)

Всички са нарисувани от кода на играта (`npm run assets`).

---

## English

**Name:** Rocket Snail

**Subtitle (App Store, max 30):** Hold to fly, let go to fall

**Short description (Google Play, max 80):** A cute snail with a rocket! Dodge birds and hoses, collect lettuce.

**Promotional text (max 170):** Strap a rocket to a snail and see how far you can fly! Unlock party hats, crowns, rainbow rockets and more.

**Description:**

Meet the bravest snail in the garden – it has a rocket on its back!

Hold your finger on the screen to fly up, let go to fall. Dodge birds, falling leaves, garden hoses and raindrops, and collect crunchy lettuce on the way. The longer you fly, the faster it gets!

• One-finger controls – easy to learn, hard to master
• Fly from sunny day into a golden sunset and a starry night
• Collect lettuce and unlock cute hats and colourful rockets
• Beat your own record – a flag shows where your best flight ended
• Happy music, sound effects and gentle vibrations
• English and Bulgarian
• No ads, no purchases, no internet needed
• No data collected – your progress stays on your device

**Keywords (App Store, max 100):** snail,rocket,arcade,casual,endless,flying,cute,kids,garden,one tap,runner,offline

**Category:** Games → Arcade (second: Casual)

---

## Български

**Име:** Rocket Snail

**Подзаглавие (до 30 знака):** Задръж, за да летиш!

**Кратко описание (Google Play, до 80):** Сладък охлюв с ракета! Пази се от птици и маркучи, събирай маруля.

**Промо текст (до 170):** Сложи ракета на охлюв и виж колко далеч ще стигнеш! Отключи парти шапки, корони, ракети в цветовете на дъгата и още.

**Описание:**

Запознай се с най-смелия охлюв в градината – той има ракета на гърба си!

Задръж пръст на екрана, за да летиш нагоре, пусни, за да паднеш. Пази се от птици, падащи листа, градински маркучи и капки дъжд и събирай хрупкава маруля по пътя. Колкото по-дълго летиш, толкова по-бързо става!

• Управление с един пръст – лесно за научаване, трудно за овладяване
• Полет от слънчев ден през златен залез до звездна нощ
• Събирай маруля и отключвай сладки шапки и цветни ракети
• Подобри рекорда си – флагче показва докъде си стигнал
• Весела музика, звуци и леки вибрации
• Английски и български език
• Без реклами, без покупки, без интернет
• Не събира данни – напредъкът остава на устройството ти

**Ключови думи (до 100):** охлюв,ракета,аркада,игра,летене,деца,градина,безкрайна,маруля,офлайн

---

## Отговори на въпросите в магазините

**App Store → App Privacy:** „Data Not Collected“ (не събираме данни).

**App Store → Age Rating:** на всички въпроси „None“ / „No“ → резултат **4+**.

**Google Play → Data safety:** „No data collected“, „No data shared“.

**Google Play → Content rating (IARC):** категория „Game“, на всички въпроси „No“ → **Everyone / PEGI 3**.

**Google Play → Target audience:** може да избереш и „Under 13“ – играта няма реклами и не събира данни.

**Privacy Policy URL:** адресът, на който публикуваш `docs/PRIVACY.md` (виж `docs/RELEASE.md`, стъпка 2).

**Export compliance (App Store):** играта не използва криптиране – вече е отбелязано в `app.json`, няма да те питат.
