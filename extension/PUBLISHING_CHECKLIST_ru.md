# Чеклист публикации MAXSEC (Chrome / Edge / Firefox)

## Обязательное перед публикацией
- [ ] Указать контакты поддержки (email/website) в карточке Store и в Privacy Policy.
- [ ] Проверить `manifest_version`, имя, версия, иконки, popup/options страницы.
- [ ] Подготовить иконки (16/32/48/128) и скриншоты UI расширения.
- [ ] Проверить текст разрешений и обоснование каждого разрешения.
- [ ] Проверить, что в описании явно указано: **шифрование только на клиенте**.
- [ ] Приложить Privacy Policy URL или текст согласно требованиям Store.

## Техническая проверка
- [ ] Убедиться, что расширение корректно загружается как unpacked.
- [ ] Проверить режимы OFF/READ/SECURE на реальном web.max.ru.
- [ ] Проверить ручную crypto-панель (`manual/manual.html`).
- [ ] Проверить fallback-поведение при изменении DOM.
- [ ] Прогнать тесты: `npm test`.

## Chrome Web Store
- [ ] Подготовить store listing: short description, full description, категория, язык.
- [ ] Заполнить privacy practices в консоли (что собирается/не собирается).
- [ ] Загрузить пакет и пройти review.

## Edge Add-ons
- [ ] Импортировать listing из Chrome или заполнить вручную.
- [ ] Проверить соответствие Microsoft policies (privacy + permissions).

## Firefox Add-ons (AMO)
- [ ] Подготовить совместимую сборку/манифест для Firefox (при необходимости адаптация API).
- [ ] Проверить `browser.*`/`chrome.*` совместимость.
- [ ] Добавить privacy policy и пройти AMO review.
