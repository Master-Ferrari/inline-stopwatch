// main.ts
import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    MarkdownPostProcessorContext,
    TFile
} from "obsidian";

/*════════════  НАСТРОЙКИ  ════════════*/
interface InlineStopwatchSettings {
    defaultLimit: number;     // сек
    autosaveInterval: number; // сек
    minIslandWidth: number;   // px
}
const DEFAULT_SETTINGS: InlineStopwatchSettings = {
    defaultLimit: 60,
    autosaveInterval: 10,
    minIslandWidth: 100
};

/*════════════  DATA.JSON  ════════════*/
interface RuntimeState { passed: number; running: boolean; }
interface PluginData {
    settings: InlineStopwatchSettings;
    runtime: Record<string, RuntimeState>;
}

/*════════════  СНИППЕТ  ════════════*/
interface StopwatchSettings {
    id: string;
    passed: number;
    limit: number;
    name?: string;
    running: boolean;
}
interface ParsedSpec { spec: StopwatchSettings; hasId: boolean; }

/*════════════  API ТАЙМЕРА  ════════════*/
interface TimerAPI {
    id: string;
    filePath: string;
    currentPassed(): number;
    isRunning(): boolean;
    confirmSaved(passed: number, running: boolean): void;
}

/*════════════  ПЛАГИН  ════════════*/
export default class InlineStopwatchPlugin extends Plugin {
    settings!: InlineStopwatchSettings;
    runtime: Record<string, RuntimeState> = {};
    private timers = new Map<string, TimerAPI>();
    private flushHandle: number | null = null;   // теперь приватно

    /* ── lifecycle ── */
    async onload() {
        await this.loadDataFile();
        this.addSettingTab(new InlineStopwatchSettingTab(this.app, this));

        /* парсер markdown */
        this.registerMarkdownPostProcessor((el, ctx) => {
            el.querySelectorAll("code").forEach(code => {
                const raw = code.textContent ?? "";
                if (!raw.trim().startsWith("stopwatch")) return;

                const parsed = parseSpec(raw, this.settings.defaultLimit);

                /* подменяем более свежее значение из runtime */
                const rt = this.runtime[parsed.spec.id];
                if (rt) { parsed.spec.passed = rt.passed; parsed.spec.running = rt.running; }

                if (!parsed.hasId) insertMissingFields(this, ctx, raw, parsed.spec);

                code.replaceWith(
                    createStopwatch(parsed.spec, this, ctx, this.settings.minIslandWidth)
                );
            });
        });

        this.startAutosaveInterval();
    }
    onunload() {
        this.stopAutosaveInterval();
        this.flushRuntime();
    }

    /*──────── data.json ────────*/
    private async loadDataFile() {
        const d: Partial<PluginData> = (await this.loadData()) ?? {};
        this.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings);
        this.runtime = d.runtime ?? {};
    }
    async saveDataFile() {
        const data: PluginData = { settings: this.settings, runtime: this.runtime };
        await this.saveData(data);
    }

    /*──────── autosave interval ────────*/
    private startAutosaveInterval() {
        this.flushHandle = window.setInterval(
            () => this.flushRuntime(),
            this.settings.autosaveInterval * 1000
        );
    }
    private stopAutosaveInterval() {
        if (this.flushHandle) window.clearInterval(this.flushHandle);
        this.flushHandle = null;
    }
    /** вызывается из панели настроек */
    async setAutosaveInterval(sec: number) {
        this.settings.autosaveInterval = sec;
        await this.saveDataFile();
        this.stopAutosaveInterval();
        this.startAutosaveInterval();
    }

    /*──────── registry ────────*/
    registerTimer(api: TimerAPI) { this.timers.set(api.id, api); }
    unregisterTimer(id: string) { this.timers.delete(id); }

    /*════════════  FLUSH runtime → data.json  ════════════*/
    private async flushRuntime() {
        for (const t of this.timers.values()) {
            this.runtime[t.id] = { passed: t.currentPassed(), running: t.isRunning() };
        }
        await this.saveDataFile();
    }

    /*════════════  ПАТЧ ВСЕХ СНИППЕТОВ  ════════════*/
    async persistAllTimers() {
        /* группируем по файлам */
        const byFile = new Map<string, TimerAPI[]>();
        for (const t of this.timers.values()) {
            if (!byFile.has(t.filePath)) byFile.set(t.filePath, []);
            byFile.get(t.filePath)!.push(t);
        }

        for (const [path, list] of byFile) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!(file instanceof TFile)) continue;

            let content = await this.app.vault.read(file);
            const original = content;

            for (const t of list) {
                const rt = this.runtime[t.id] ?? {
                    passed: t.currentPassed(),
                    running: t.isRunning()
                };
                const passed = rt.passed;
                const runningVal = rt.running ? "yes" : "no";

                const re = new RegExp("`[^`]*\\bid:" + esc(t.id) + "\\b[^`]*`", "g");
                content = content.replace(re, snippet => {
                    let s = snippet.replace(/passed:\s*\d+/, `passed:${passed}`);
                    s = s.match(/running:/)
                        ? s.replace(/running:\s*(yes|no)/, `running:${runningVal}`)
                        : s.replace(/limit:[^`]+/, m => `${m} running:${runningVal}`);
                    return s;
                });
            }
            if (content !== original)
                await this.app.vault.adapter.write(path, content);
        }
    }
}

/*════════════  НАСТРОЙКИ UI  ════════════*/
class InlineStopwatchSettingTab extends PluginSettingTab {
    plugin: InlineStopwatchPlugin;
    constructor(app: App, plugin: InlineStopwatchPlugin) { super(app, plugin); this.plugin = plugin; }
    display(): void {
        const c = this.containerEl; c.empty();

        new Setting(c)
            .setName("Default limit (seconds)")
            .addText(t => t.setValue(String(this.plugin.settings.defaultLimit))
                .onChange(async v => {
                    const n = +v;
                    if (n > 0) {
                        this.plugin.settings.defaultLimit = n;
                        await this.plugin.saveDataFile();
                    }
                }));

        new Setting(c)
            .setName("Autosave interval (seconds)")
            .addText(t => t.setValue(String(this.plugin.settings.autosaveInterval))
                .onChange(async v => {
                    const n = +v;
                    if (n > 0) await this.plugin.setAutosaveInterval(n);
                }));

        new Setting(c)
            .setName("Minimum island width (px)")
            .addText(t => t.setValue(String(this.plugin.settings.minIslandWidth))
                .onChange(async v => {
                    const n = +v;
                    if (n > 0) {
                        this.plugin.settings.minIslandWidth = n;
                        await this.plugin.saveDataFile();
                    }
                }));
    }
}

/*════════════  ХЕЛПЕРЫ  ════════════*/
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function parseTime(s: string) { const p = s.split(":").map(n => +n); while (p.length < 3) p.unshift(0); return p[0] * 3600 + p[1] * 60 + p[2]; }
const pad = (n: number) => n.toString().padStart(2, "0");
const formatTime = (s: number) => `${pad((s / 3600) | 0)}:${pad(((s % 3600) / 60) | 0)}:${pad(s % 60)}`;

function parseSpec(src: string, defLimit: number): ParsedSpec {
    const rec: Record<string, string> = {}, re = /(id|name|passed|limit|running):\s*([^\s]+)/g;
    for (let m; (m = re.exec(src));) rec[m[1]] = m[2];
    return {
        spec: {
            id: rec.id ?? "",
            passed: rec.passed ? parseTime(rec.passed) : 0,
            limit: rec.limit ? parseTime(rec.limit) : defLimit,
            name: rec.name,
            running: rec.running === "yes"
        },
        hasId: !!rec.id
    };
}

/* вставляем id и running:no при первом появлении */
async function insertMissingFields(
    plugin: InlineStopwatchPlugin,
    ctx: MarkdownPostProcessorContext,
    raw: string,
    spec: StopwatchSettings
) {
    const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof TFile)) return;

    let content = await plugin.app.vault.read(file);
    const newId = genId(content);

    const repl = raw.replace(/^stopwatch/, `stopwatch id:${newId} running:no`);
    content = content.replace("`" + raw + "`", "`" + repl + "`");

    await plugin.app.vault.modify(file, content);
    spec.id = newId;
    spec.running = false;
}

function genId(content: string): string {
    while (true) {
        const id = Math.random().toString(36).slice(2, 8);
        if (!content.includes(`id:${id}`)) return id;
    }
}

/*════════════  UI & TIMER  ════════════*/
function createStopwatch(
    spec: StopwatchSettings,
    plugin: InlineStopwatchPlugin,
    ctx: MarkdownPostProcessorContext,
    minWidth: number
): HTMLElement {

    /* ── UI ── */
    const wrapper = document.createElement("span");
    wrapper.addClass("inline-stopwatch-wrapper");

    const { button, setIcon } = buildButton();
    const { island, timeSpan, fill } = buildIsland(spec, minWidth);

    wrapper.appendChild(button);
    wrapper.appendChild(island);

    /* ── рендер ── */
    const render = (sec: number) => {
        timeSpan.textContent = formatTime(sec);
        const f = (sec % spec.limit) / spec.limit, odd = Math.floor(sec / spec.limit) % 2 === 1;
        if (!odd) {
            fill.style.left = "0"; fill.style.right = "auto";
            fill.style.width = `${(f * 100).toFixed(2)}%`;
        } else {
            fill.style.right = "0"; fill.style.left = "auto";
            fill.style.width = `${((1 - f) * 100).toFixed(2)}%`;
        }
    };
    render(spec.passed);

    /* ── state ── */
    let running = spec.running;
    let base = spec.passed;
    let start = 0;
    let interval: number | null = null;

    plugin.runtime[spec.id] = { passed: base, running };

    const api: TimerAPI = {
        id: spec.id,
        filePath: ctx.sourcePath,
        currentPassed: () => Math.floor(running ? base + (Date.now() - start) / 1000 : base),
        isRunning: () => running,
        confirmSaved: (p, r) => { base = p; running = r; if (r) start = Date.now(); plugin.runtime[spec.id] = { passed: p, running: r }; }
    };
    plugin.registerTimer(api);

    /* ── управление ── */
    const run = async () => {
        running = true; setIcon(true);
        start = Date.now();
        interval = window.setInterval(() => render(api.currentPassed()), 100);
        api.confirmSaved(base, true);
        await plugin.saveDataFile(); // runtime
    };

    const pause = async () => {
        const nowPassed = Math.floor(base + (Date.now() - start) / 1000);

        if (interval) window.clearInterval(interval);
        running = false; setIcon(false);
        base = nowPassed;
        api.confirmSaved(base, false);
        render(base);

        await plugin.persistAllTimers();  // ⬅ сохраняем ВСЕ таймеры
        await plugin.saveDataFile();
    };

    button.onclick = () => running ? pause() : run();
    if (running) run();

    return wrapper;
}

/*════════════  BUILDERS  ════════════*/
function buildButton() {
    const b = document.createElement("button");
    b.addClass("inline-stopwatch-button");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttr("viewBox", "0 0 16 16");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(path); b.appendChild(svg);
    const set = (p: boolean) => path.setAttr("d", p ? "M2 2h4v12H2zm8 0h4v12h-4z" : "M3 2v12l10-6-10-6z");
    set(false);
    return { button: b, setIcon: set };
}

function buildIsland(spec: StopwatchSettings, minWidth: number) {
    const isl = document.createElement("span");
    isl.addClass("inline-stopwatch-island");
    isl.style.minWidth = `${minWidth}px`;

    if (spec.name) {
        const n = document.createElement("span");
        n.addClass("inline-stopwatch-name"); n.textContent = spec.name;
        isl.appendChild(n);
    }

    const time = document.createElement("span");
    time.addClass("inline-stopwatch-time");
    if (spec.name) time.addClass("inline-stopwatch-muted");
    isl.appendChild(time);

    /* progress */
    const tl = document.createElement("div");
    tl.addClass("inline-stopwatch-timeline");
    const fill = document.createElement("div");
    fill.addClass("inline-stopwatch-fill");
    tl.appendChild(fill); isl.appendChild(tl);

    return { island: isl, timeSpan: time, fill };
}
