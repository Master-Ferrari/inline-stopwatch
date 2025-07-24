"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
class InlineStopwatchPlugin extends obsidian_1.Plugin {
    onload() {
        this.registerMarkdownPostProcessor((el, ctx) => {
            const codes = el.querySelectorAll('code');
            codes.forEach(code => {
                const text = code.textContent?.trim();
                if (!text || !text.startsWith('stopwatch'))
                    return;
                const parsed = parseSpec(text);
                const comp = createStopwatch(parsed.spec, this, ctx, text, parsed.hasPassed);
                code.replaceWith(comp);
            });
        });
    }
}
exports.default = InlineStopwatchPlugin;
function parseSpec(text) {
    const record = {};
    const regex = /(name|passed|limit):\s*([^\s]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        record[match[1]] = match[2];
    }
    const hasPassed = record['passed'] !== undefined;
    const passed = record['passed'] ? parseTime(record['passed']) : 0;
    const limit = record['limit'] ? parseTime(record['limit']) : undefined;
    const name = record['name'];
    return { spec: { passed, limit, name }, hasPassed };
}
function parseTime(str) {
    const parts = str.split(':').map((p) => parseInt(p, 10));
    while (parts.length < 3)
        parts.unshift(0);
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
}
function formatTime(sec) {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}
function buildSpecString(original, passed) {
    const record = {};
    const regex = /(name|passed|limit):\s*([^\s]+)/g;
    let match;
    while ((match = regex.exec(original)) !== null) {
        record[match[1]] = match[2];
    }
    record['passed'] = formatTime(passed);
    let result = 'stopwatch';
    if (record['name'])
        result += ` name: ${record['name']}`;
    result += ` passed: ${record['passed']}`;
    if (record['limit'])
        result += ` limit: ${record['limit']}`;
    return result;
}
function createStopwatch(spec, plugin, ctx, original, hasPassed) {
    const container = document.createElement('span');
    container.addClass('inline-stopwatch');
    const button = document.createElement('button');
    button.addClass('inline-stopwatch-button');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttr('viewBox', '0 0 16 16');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(path);
    button.appendChild(svg);
    const setIcon = (playing) => {
        path.setAttr('d', playing
            ? 'M2 2h4v12H2zm8 0h4v12h-4z' /* pause */
            : 'M3 2v12l10-6-10-6z' /* play */);
    };
    setIcon(false);
    const nameSpan = document.createElement('span');
    if (spec.name) {
        nameSpan.addClass('inline-stopwatch-name');
        nameSpan.textContent = ` ${spec.name} `;
    }
    const timeSpan = document.createElement('span');
    timeSpan.addClass('inline-stopwatch-time');
    timeSpan.textContent = formatTime(spec.passed);
    const timeline = document.createElement('div');
    let fill = null;
    if (spec.limit !== undefined) {
        timeline.addClass('inline-stopwatch-timeline');
        fill = document.createElement('div');
        fill.addClass('inline-stopwatch-fill');
        timeline.appendChild(fill);
    }
    container.appendChild(button);
    if (spec.name)
        container.appendChild(nameSpan);
    container.appendChild(timeSpan);
    if (spec.limit !== undefined)
        container.appendChild(timeline);
    let running = false;
    let start = 0;
    let interval = null;
    let currentText = original;
    let currentPassed = spec.passed;
    const tick = () => {
        const now = Date.now();
        const elapsed = currentPassed + Math.floor((now - start) / 1000);
        timeSpan.textContent = formatTime(elapsed);
        if (fill && spec.limit) {
            const cycle = elapsed % (spec.limit * 2);
            let progress = 0;
            if (cycle < spec.limit) {
                progress = cycle / spec.limit;
            }
            else {
                progress = 1 - (cycle - spec.limit) / spec.limit;
            }
            fill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
        }
    };
    const updatePassedInFile = async (seconds) => {
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (!(file instanceof obsidian_1.TFile))
            return;
        let content = await plugin.app.vault.read(file);
        const newSnippet = buildSpecString(currentText, seconds);
        content = content.replace(`\`${currentText}\``, `\`${newSnippet}\``);
        await plugin.app.vault.modify(file, content);
        currentText = newSnippet;
    };
    button.onclick = async () => {
        if (!running) {
            running = true;
            setIcon(true);
            start = Date.now();
            interval = window.setInterval(tick, 500);
            if (!hasPassed) {
                await updatePassedInFile(currentPassed);
                hasPassed = true;
            }
        }
        else {
            running = false;
            setIcon(false);
            if (interval)
                window.clearInterval(interval);
            const diff = Math.floor((Date.now() - start) / 1000);
            currentPassed += diff;
            await updatePassedInFile(currentPassed);
        }
    };
    return container;
}
