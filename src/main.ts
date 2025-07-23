import { Plugin } from 'obsidian';

interface StopwatchSettings {
    passed: number; // seconds
    limit?: number; // seconds
    name?: string;
}

export default class InlineStopwatchPlugin extends Plugin {
    onload() {
        this.registerMarkdownPostProcessor((el) => {
            const codes = el.querySelectorAll('code');
            codes.forEach(code => {
                const text = code.textContent?.trim();
                if (!text || !text.startsWith('stopwatch')) return;
                const spec = parseSpec(text);
                if (!spec) return;
                const comp = createStopwatch(spec);
                code.replaceWith(comp);
            });
        });
    }
}

function parseSpec(text: string): StopwatchSettings | null {
    const record: Record<string, string> = {};
    const regex = /(name|passed|limit):\s*([^\s]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        record[match[1]] = match[2];
    }
    if (!record['passed']) return null;
    const passed = parseTime(record['passed']);
    const limit = record['limit'] ? parseTime(record['limit']) : undefined;
    const name = record['name'];
    return { passed, limit, name };
}

function parseTime(str: string): number {
    const parts = str.split(':').map((p) => parseInt(p, 10));
    while (parts.length < 3) parts.unshift(0);
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
}

function formatTime(sec: number): string {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function createStopwatch(spec: StopwatchSettings): HTMLElement {
    const container = document.createElement('span');
    container.addClass('inline-stopwatch');

    const button = document.createElement('button');
    button.addClass('inline-stopwatch-button');
    button.textContent = '▶';

    const nameSpan = document.createElement('span');
    if (spec.name) {
        nameSpan.addClass('inline-stopwatch-name');
        nameSpan.textContent = ` ${spec.name} `;
    }

    const timeSpan = document.createElement('span');
    timeSpan.addClass('inline-stopwatch-time');
    timeSpan.textContent = formatTime(spec.passed);

    const timeline = document.createElement('div');
    let fill: HTMLDivElement | null = null;
    if (spec.limit !== undefined) {
        timeline.addClass('inline-stopwatch-timeline');
        fill = document.createElement('div');
        fill.addClass('inline-stopwatch-fill');
        timeline.appendChild(fill);
    }

    container.appendChild(button);
    if (spec.name) container.appendChild(nameSpan);
    container.appendChild(timeSpan);
    if (spec.limit !== undefined) container.appendChild(timeline);

    let running = false;
    let start = 0;
    let passed = spec.passed;
    let interval: number | null = null;

    const tick = () => {
        const now = Date.now();
        passed = Math.floor((now - start) / 1000);
        timeSpan.textContent = formatTime(passed);
        if (fill && spec.limit) {
            const cycle = passed % (spec.limit * 2);
            let progress = 0;
            if (cycle < spec.limit) {
                progress = cycle / spec.limit;
            } else {
                progress = 1 - (cycle - spec.limit) / spec.limit;
            }
            fill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
        }
    };

    button.onclick = () => {
        if (!running) {
            running = true;
            button.textContent = '⏸';
            start = Date.now() - spec.passed * 1000;
            interval = window.setInterval(tick, 500);
        } else {
            running = false;
            button.textContent = '▶';
            if (interval) window.clearInterval(interval);
            spec.passed = passed;
        }
    };

    return container;
}
