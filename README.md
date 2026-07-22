# Q Adventures — Cebu Scooter Rental

Одностраничный сайт-прототип аренды скутеров/мотоциклов в Себу: витрина парка байков,
фильтр по категориям, модалка бронирования (даты, цена, Pros/Cons), футер с контактами.

## Структура

```
Q Adventures Scooter Rental.dc.html   # исходник — HTML-шаблон + логика (класс Component)
support.js                            # рантайм: шаблонизация/состояние для .dc.html
image-slot.js                         # веб-компонент <image-slot> для картинок
images/                               # фото байков, hero и story
```

`Q Adventures Scooter Rental.dc.html` — это «Design Component»: обычный читаемый HTML
с инлайн-стилями плюс класс логики `Component` в теге `<script>`. Правки видны в
`git diff` построчно.

## Запуск

Файлу нужен HTTP-сервер (из-за подгрузки `support.js` / `image-slot.js`), просто
двойной клик по файлу не сработает. Из папки репозитория:

```bash
python3 -m http.server 8000
# затем открыть в браузере:
# http://localhost:8000/Q%20Adventures%20Scooter%20Rental.dc.html
```

Любой другой статический сервер (`npx serve`, Live Server и т.п.) тоже подойдёт.

## Версионирование

- Коммитьте всё содержимое этой папки как есть.
- НЕ коммитьте собранный бандл (`github-pages-export/index.html`) — там ассеты
  заинлайнены в base64, диффы нечитаемы. Он уже в `.gitignore`.
- Бинарные ассеты в `images/` git хранит как есть.

## Первичная инициализация git

```bash
git init
git add .
git commit -m "Initial import: Q Adventures scooter rental prototype"
```
