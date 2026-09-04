# UX review — 14 experimental improvements

Branch: `ux/14-experience-improvements`

These changes are experimental and are **not** accepted product decisions yet. Review each item independently and mark it as keep / change / remove before merging the branch.

## 1. Book work summary

Open any book in Parent mode.

Check:
- a compact `Работа над книгой` block is visible near the top;
- it shows illustration progress or a completed state;
- `Продолжить работу` opens the first unfinished page; for a finished book, `Проверить страницы` opens page 1.

## 2. Previous / next page workflow

Open one page in Parent mode.

Check:
- the expanded editor has previous/next page controls;
- after a page already has an illustration, a large `Готово → перейти к странице ...` action is available;
- when uploading an image, `Сохранить и открыть страницу ...` is offered when there is a next page.

## 3. Less technical language in normal Parent mode

Open the Parent book list, a book, Characters and Helper.

Check:
- book cards use human-readable states instead of raw lifecycle values;
- ZIP import/export and story-pattern controls are under technical sections rather than primary actions;
- internal character ID is no longer shown in the main character header.

## 4. New book: agent-first as the primary path

Open `Новая книга`.

Check:
- `Создать с агентом` is the primary option;
- the old manual draft form still exists but is collapsed under `Создать пустой черновик вручную`.

## 5. Helper feels conversational

Open `Помощник`.

Check:
- the page asks `Что хотите сделать?` instead of presenting a tool console;
- quick actions have human labels;
- `Покажи мои книги` and `Покажи персонажей` work without slash commands;
- if no text model is configured, a creative request gets a friendly explanation instead of a technical `unrecognized` error;
- technical slash commands are still discoverable only in the collapsed technical help.

## 6. Parent book cards show visual progress

Open Parent `Книги`.

Check each card for:
- cover preview;
- `готово / всего` illustration count;
- readable status;
- `Готово` or `Продолжить · осталось ...` instead of a long technical description.

## 7. Page filtering and direct jump

Open a book with multiple pages.

Check:
- filters `Все`, `Без иллюстрации`, `Готовые`;
- counters on each filter;
- `Перейти к №` opens the requested page;
- the selected page can remain visible temporarily even when its state no longer matches the active filter.

## 8. Drag-and-drop image upload with preview

Try page illustration, environment reference, cover and character reference uploads.

Check:
- file can be selected by click or dropped into the area;
- selected image is previewed before saving;
- file name and relevant format hint remain visible.

## 9. Illustration workflow is explicitly ordered

Open an expanded page.

Check that the main illustration block reads naturally as:
1. `Скопировать промпт`;
2. `Создать изображение`;
3. `Загрузить готовую иллюстрацию`.

The normal workflow should be understandable without opening technical prompt structure.

## 10. Character prompt is not always expanded

Open `Персонажи`.

Check:
- main reference and `Скопировать` remain immediately visible;
- the long prompt text is hidden under `Посмотреть промпт`;
- advanced metadata remains available separately.

## 11. Child library is simpler

Open the child library `/`.

Check:
- each book card primarily shows the cover and title;
- age, page count and parent-facing goal description are no longer shown on the visible card.

## 12. Long books do not render hundreds of dots

Open a ready book with more than 10 pages.

Check:
- the reader uses a compact progress bar instead of one dot per page;
- short books up to 10 pages still use dots.

## 13. Reader remembers where you stopped

Open a book, move past page 1, return to the shelf, then open the same book again.

Check:
- a banner says where you stopped;
- `Продолжить` returns to that page;
- `Начать сначала` resets progress.

## 14. A book has a clear ending

Go to the last page of a book.

Check:
- the normal navigation row turns into `Ещё раз · Конец ❤️ · На полку`;
- the final page illustration remains the same size as on the preceding page;
- `Ещё раз` resets to page 1;
- `На полку` returns to the shelf.

## Review rule

Do not merge this branch wholesale until the parent has reviewed the 14 items. Individual items may be revised or removed before merge.
