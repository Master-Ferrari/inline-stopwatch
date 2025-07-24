// main.ts
/**
 * Inline Stopwatch – «чистый скелет».
 * Здесь есть только:
 *   1.  Работа с настройками (загрузка/сохранение, подсказка как вызвать).
 *   2.  Парсер/сериализатор текста ``stopwatch …``.
 *   3.  Рендер полоски‑прогресса и числа времени по готовым данным.
 *   4.  Заготовки коллбэков кнопок Play/Pause.
 *   5.  Функция buildStopwatchUI() — используйте её в режиме чтения (Preview).
 *
 * ВСЁ прочее (тайм‑ауты, автосейвы, runtime и т. д.) УДАЛЕНО.
 */

import {
    Plugin,
    App,
    PluginSettingTab,
    Setting,
    MarkdownPostProcessorContext
} from "obsidian";

/*════════════  1.  НАСТРОЙКИ  ════════════*/
/** Изменяйте структуру по нуждам: */
export interface InlineStopwatchSettings {
    defaultLimit: number;     // секунды
    minIslandWidth: number;   // px
}

/** Значения по умолчанию */
export const DEFAULT_SETTINGS: InlineStopwatchSettings = {
    defaultLimit: 60,
    minIslandWidth: 100
};

/**
 * Как пользоваться:
 *   const settings = await plugin.loadData() as InlineStopwatchSettings ?? DEFAULT_SETTINGS;
 *   settings.defaultLimit = 120;
 *   await plugin.saveData(settings);
 */

/*════════════  2.  ПАРСИНГ И СЕРИАЛИЗАЦИЯ  ════════════*/

/** Структура, которую возвращает парсер сниппета */
export interface StopwatchSpec {
    id: string;
    passed: number;     // секунды
    limit: number;      // лимит секунд
    name?: string;
    running: boolean;
}

/**
 * Парсит текст вида:
 *    `stopwatch id:abc passed:12 limit:60 name:task running:yes`
 *
 * Если что‑то отсутствует, подставляет дефолты.
 */
export function parseSnippet(
    raw: string,
    defaults: InlineStopwatchSettings
): StopwatchSpec {
    const rec: Record<string, string> = {};
    const re = /(id|name|passed|limit|running):\s*([^\s]+)/g;
    for (let m; (m = re.exec(raw));) rec[m[1]] = m[2];

    return {
        id: rec.id ?? "",
        passed: rec.passed ? parseTime(rec.passed) : 0,
        limit: rec.limit ? parseTime(rec.limit) : defaults.defaultLimit,
        name: rec.name,
        running: rec.running === "yes"
    };
}

/**
 * Сериализует структуру обратно в строку (для сохранения в заметку).
 * Используйте после изменений, чтобы записать в файл.
 */
export function stringifySnippet(spec: StopwatchSpec): string {
    const parts: string[] = ["stopwatch"];
    if (spec.id) parts.push(`id:${spec.id}`);
    parts.push(`passed:${formatTime(spec.passed)}`);
    parts.push(`limit:${formatTime(spec.limit)}`);
    if (spec.name) parts.push(`name:${spec.name}`);
    parts.push(`running:${spec.running ? "yes" : "no"}`);
    return parts.join(" ");
}

/*────────  helpers для времени ────────*/
function parseTime(t: string): number {
    const p = t.split(":").map(n => +n);
    while (p.length < 3) p.unshift(0);
    return p[0] * 3600 + p[1] * 60 + p[2];
}
const pad = (n: number) => n.toString().padStart(2, "0");
export const formatTime = (s: number) =>
    `${pad((s / 3600) | 0)}:${pad(((s % 3600) / 60) | 0)}:${pad(s % 60)}`;

/*════════════  3.  РЕНДЕР ПОЛОСЫ И ЧИСЕЛ  ════════════*/

/**
 * Обновляет DOM‑элементы «число времени» и «fill‑bar».
 * Вызывайте, когда у вас новое значение sec.
 */
export function renderStopwatch(
    sec: number,
    spec: StopwatchSpec,
    timeSpan: HTMLElement,
    fillDiv: HTMLElement
) {
    timeSpan.textContent = formatTime(sec);

    const ratio = (sec % spec.limit) / spec.limit;
    const odd = Math.floor(sec / spec.limit) % 2 === 1;

    if (!odd) {
        fillDiv.style.left = "0";
        fillDiv.style.right = "auto";
        fillDiv.style.width = `${(ratio * 100).toFixed(2)}%`;
    } else {
        fillDiv.style.right = "0";
        fillDiv.style.left = "auto";
        fillDiv.style.width = `${((1 - ratio) * 100).toFixed(2)}%`;
    }
}

/*════════════  4.  КОЛЛБЭКИ КНОПОК  ════════════*/

/**
 * Здесь только сигнатуры — добавьте свою логику старта/паузы.
 * Пример использования:
 *    playBtn.onclick = () => onPlay(spec);
 *    pauseBtn.onclick = () => onPause(spec);
 */

export function onPlay(spec: StopwatchSpec) {
    /* TODO: ваша логика запуска таймера */
    console.log("Play", spec.id);
}

export function onPause(spec: StopwatchSpec) {
    /* TODO: ваша логика паузы и сохранения passed */
    console.log("Pause", spec.id);
}

/*════════════  5.  ОТОБРАЖЕНИЕ (РЕЖИМ ЧТЕНИЯ)  ════════════*/

/**
 * Строит DOM островка для Preview‑режима — без живого таймера.
 * Возвращает {wrapper, timeSpan, fillDiv} для дальнейших обновлений.
 */
export function buildStopwatchUI(
    spec: StopwatchSpec,
    settings: InlineStopwatchSettings
): { wrapper: HTMLElement; timeSpan: HTMLElement; fill: HTMLElement } {
    const wrapper = document.createElement("span");
    wrapper.addClass("inline-stopwatch-wrapper");

    /* кнопка (иконка «Play/Pause» только для чтения) */
    const btn = document.createElement("button");
    btn.addClass("inline-stopwatch-button");
    btn.disabled = true;
    wrapper.appendChild(btn);

    /* островок */
    const isl = document.createElement("span");
    isl.addClass("inline-stopwatch-island");
    isl.style.minWidth = `${settings.minIslandWidth}px`;
    wrapper.appendChild(isl);

    if (spec.name) {
        const nameSpan = document.createElement("span");
        nameSpan.addClass("inline-stopwatch-name");
        nameSpan.textContent = spec.name;
        isl.appendChild(nameSpan);
    }

    const timeSpan = document.createElement("span");
    timeSpan.addClass("inline-stopwatch-time");
    if (spec.name) timeSpan.addClass("inline-stopwatch-muted");
    isl.appendChild(timeSpan);

    const tl = document.createElement("div");
    tl.addClass("inline-stopwatch-timeline");
    const fill = document.createElement("div");
    fill.addClass("inline-stopwatch-fill");
    tl.appendChild(fill);
    isl.appendChild(tl);

    /* Отрисовали текущие данные */
    renderStopwatch(spec.passed, spec, timeSpan, fill);

    return { wrapper, timeSpan, fill };
}

/*════════════  (необязательно) ПУСТОЙ ПЛАГИН  ════════════*/
export default class SkeletonPlugin extends Plugin {
    settings!: InlineStopwatchSettings;
    async onload() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() { await this.saveData(this.settings); }
}

/*════════════  CSS лежит в отдельном файле  ════════════*/
