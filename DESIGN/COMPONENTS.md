# Каталог компонентов дизайн-системы NeuroFlow

Документ описывает спецификацию всех 14 базовых переиспользуемых интерфейсных компонентов персональной платформы NeuroFlow Studio.

---

## 1. Button (Кнопка действия)

Кнопки делятся на три основных варианта по значимости действия в интерфейсе:

### Спецификация состояний:
- **Primary / Dark**:
  - Светлая тема: фон `var(--accent-primary)` (`#243A2B`), текст `#FFFFFF`, обводка `#243A2B`.
  - Тёмная тема: фон `var(--accent-primary)` (`#C9ED84`), текст `#0D1610`, обводка `#C9ED84`.
  - Hover: фильтр яркости / сдвиг на `150ms`.
  - Active: уменьшение масштаба `transform: scale(0.98)`.
  - Focus-visible: кольцо обводки `2px solid var(--accent-highlight)`, `offset: 2px`.
- **Secondary**:
  - Фон: `var(--bg-surface)`, текст `var(--text-primary)`, граница `1px solid var(--border-default)`.
  - Hover: фон `var(--bg-surface-subtle)`, граница `var(--border-strong)`.
- **Danger**:
  - Фон: `var(--status-error-bg)`, текст `var(--status-error)`, граница `var(--status-error-border)`.
- **Размеры**:
  - Standard: высота `36px`, горизонтальный padding `14px`, скругление `7px`, шрифт `12px / 600`.
  - Small (`sm`): высота `30px`, горизонтальный padding `10px`, скругление `5px`, шрифт `11px / 600`.

---

## 2. IconButton (Квадратная кнопка с иконкой)

- **Размер**: `34x34px` (десктоп), `30x30px` (компактный вид).
- **Скругление**: `7px` (`radius-md`).
- **Стили**: прозрачный фон, граница `1px solid var(--border-default)`.
- **Иконка**: векторная SVG `16x16px` или `18x18px` со штрихом `stroke-width: 1.8px`.
- **Hover**: фон `var(--bg-surface-subtle)`, граница `var(--border-strong)`, цвет иконки `var(--text-primary)`.

---

## 3. NavigationItem (Пункт меню сайдбара)

- **Размер**: высота `40px`, горизонтальный padding `12px`, скругление `6px`.
- **Шрифт**: `12.5px`, начертание Medium (Regular) / Semi Bold (Active).
- **Иконка**: слева `17x17px`, цвет по умолчанию `var(--text-sidebar-muted)`.
- **Активное состояние (`.active`)**:
  - Фон: `var(--bg-sidebar-active)` (`#2e4335` / `#1d2f25`).
  - Текст: `#FFFFFF`.
  - Иконка: цвет `var(--accent-highlight)` (`#C9ED84`).
  - Индикатор: абсолютная вертикальная полоска слева высотой `20px`, шириной `3px`, скругление `4px`, цвет `#C9ED84`.
- **Счетчик (`.navcount`)**:
  - Справа `margin-left: auto`, шрифт моноширинный `10px`, цвет `var(--text-sidebar-muted)`, полупрозрачная подложка `rgba(255,255,255,0.06)`.

---

## 4. Tabs (Сегментированный переключатель)

- **Контейнер**: горизонтальный флекс с отступом `gap: 4px`, снизу тонкий разделитель `1px solid var(--border-subtle)`.
- **Вкладка (`.tab`)**:
  - Padding `6px 10px`, скругление `5px`, цвет текста `var(--text-secondary)`, шрифт `11.5px / 600`.
  - Hover: цвет текста `var(--text-primary)`, мягкий фон `var(--bg-surface-subtle)`.
  - Selected: фон `var(--bg-surface-subtle)`, цвет `var(--text-primary)`, деликатная тень `0 1px 2px rgba(0,0,0,0.04)`.

---

## 5. Badge (Семантический индикатор статуса)

Компактная плашка с цветным индикатором-точкой и подписью:
- **Размер**: padding `4px 8px`, скругление `5px`, шрифт `10.5px / 600`.
- **Точка (`::before`)**: диаметр `5px`, круглый `border-radius: 50%`, цвет `currentColor`.
- **Варианты**:
  - `Success`: цвет `var(--status-success)`, фон `var(--status-success-bg)`, бордер `var(--status-success-border)`.
  - `Warning`: цвет `var(--status-warning)`, фон `var(--status-warning-bg)`, бордер `var(--status-warning-border)`.
  - `Error`: цвет `var(--status-error)`, фон `var(--status-error-bg)`, бордер `var(--status-error-border)`.
  - `Neutral`: цвет `var(--text-secondary)`, фон `var(--bg-surface-subtle)`, бордер `var(--border-default)`.

---

## 6. StatusIndicator (Индикатор доступности узла)

- **Точка (`.statusdot`)**: диаметр `6px` или `7px`.
- **Пульсация (`.pulse`)**: анимация кольца `box-shadow` от `rgba(201, 237, 132, 0.4)` до `0` на протяжении `2s` для узла в режиме онлайн.
- **Цвета**:
  - Онлайн / Успешно: `var(--status-success)`.
  - Ожидание: `var(--status-warning)`.
  - Ошибка: `var(--status-error)`.

---

## 7. AgentRow & AgentMiniCard (Карточка агента)

- **AgentMiniCard** (в дашборде):
  - Padding `16px`, скругление `8px`, рамка `1px solid var(--border-default)`, фон `var(--bg-surface)`.
  - Монограмма: блок `32x32px`, скругление `6px`, фон `var(--bg-surface-subtle)`, буква `12px / 700`.
  - Имя агента: `12.5px / 650`, роль: `10.5px`, цвет `var(--text-muted)`.
  - Нижняя линия: статус с цветной точкой + стрелка `↗`.
- **Directory Item** (в каталоге агентов):
  - Строка списка с аватаром `36x36px`, при выборе подсвечивается акцентным фоном и стрелкой вправо.

---

## 8. TaskRow (Табличная строка задачи)

- **Сетка**: `28px minmax(0, 1fr) 130px 100px`, выравнивание по центру, отступ `gap: 12px`.
- **Индекс**: моноширинный `11px`, цвет `var(--text-muted)` (`01`, `02`).
- **Заголовок**: `12.5px / 600`, цвет `var(--text-primary)`. Метаданные снизу: `11px`, цвет `var(--text-muted)`.
- **Исполнитель**: пиктограмма `22x22px` с первой буквой имени агента + имя.
- **Статус**: Badge справа.

---

## 9. Input & Textarea (Поля ввода)

- **Высота**: `38px`–`40px`.
- **Паддинг**: `0 12px`.
- **Скругление**: `6px` (`radius-sm`).
- **Фон**: `var(--bg-surface-subtle)`, граница `1px solid var(--border-default)`.
- **Шрифт**: `12px`, цвет `var(--text-primary)`.
- **Фокус**: граница `var(--border-strong)`, фон `var(--bg-surface)`.

---

## 10. SearchField (Поле быстрого поиска)

- **Размер**: высота `34px`, ширина `220px`.
- **Контент**: иконка лупы слева + текст «Поиск и команды» + хоткей-плашка `⌘K` / `Ctrl K`.
- **Клик**: открывает модальную командную палитру.

---

## 11. Dialog & CommandPalette (Модальные окна)

- **Оверлей**: `position: fixed; inset: 0; background: rgba(14, 21, 18, 0.65); backdrop-filter: blur(2px)`.
- **Панель**: ширина до `580px`, скругление `12px`, фон `var(--bg-surface-elevated)`, тень `var(--shadow-lg)`.
- **Анимация**: масштабирование от `0.97` до `1` за `150ms`.
- **Управление**: фокус в поле ввода, закрытие по `Esc` или клику вне диалога.

---

## 12. Dropdown / Select (Выпадающее меню)

- **Стилизация**: фон `var(--bg-surface-subtle)`, граница `1px solid var(--border-default)`, скругление `6px`, padding `4px 10px`.
- **Использование**: переключение моделей ИИ в профиле агента, фильтрация логов.

---

## 13. InspectorPanel (Боковая панель инспектора)

- **Ширина**: `300px`–`320px`.
- **Паддинг**: `20px 22px`.
- **Скругление**: `10px`, фон `var(--bg-surface)`, граница `1px solid var(--border-default)`.
- **Структура**:
  - Шапка с надзаголовком `Eyebrow` и крупным названием выбранного объекта.
  - Разделитель `1px solid var(--border-default)`.
  - Секция свойств в формате ключ/значение (`.wfm`).
  - Терминальный блок логов с моношрифтом и автоскроллом.

---

## 14. EmptyState (Пустое состояние)

- **Паддинг**: `32px 16px`.
- **Выравнивание**: по центру.
- **Шрифт**: `12px`, цвет `var(--text-muted)`.
- **Текст**: понятное и краткое сообщение («По этому фильтру задач не найдено», «Документы не найдены»).
