import { stringify } from "querystring";
import { ParamsStructure, ParsedBy, TagParser } from "./parser";

const paramsStructure = {
    id: { tagName: "id", innerType: "string" },
    passed: { tagName: "passed", innerType: "integer" },
    limit: { tagName: "limit", innerType: "integer" },
    name: { tagName: "name", innerType: "string" },
    running: { tagName: "running", innerType: "yesno" },
} as const satisfies ParamsStructure;

const tagParser = new TagParser("stopwatch", paramsStructure);

type StopwatchParsed = {
    [K in keyof ParsedBy<typeof paramsStructure>]: ParsedBy<typeof paramsStructure>[K];
};

type StopwatchData = {
    [k in keyof StopwatchParsed]: Exclude<StopwatchParsed[k], null>;
}


export class Tag {

    private _id: string;
    private _passed: number;
    private _limit: number;
    private _name: string;
    private _running: boolean;
    private _element: HTMLElement;

    constructor(
        element: HTMLElement,
        parsedTag: StopwatchParsed,
        defaultTag: StopwatchData
    ) {
        const { id, passed, limit, name, running } = parsedTag;
        this._id = id ?? defaultTag.id;
        this._passed = passed ?? defaultTag.passed;
        this._limit = limit ?? defaultTag.limit;
        this._name = name ?? defaultTag.name;
        this._running = running ?? defaultTag.running;
        this._element = element;
    }

    get id(): string { return this._id; }
    get passed(): number { return this._passed; }
    get limit(): number { return this._limit; }
    get name(): string { return this._name; }
    get running(): boolean { return this._running; }
    get element(): HTMLElement { return this._element; }

    stringify(): string {
        return tagParser.start(
            `stopwatch id:${this._id} passed:${this._passed} limit:${this._limit} name:${this._name} running:${this._running ? "yes" : "no"}`
        )?.toString() ?? "";
    }

    draw(): void {

        // this.element.empty(); // clear previous content

        const wrapper = document.createElement("span");
        wrapper.addClass("inline-stopwatch-wrapper");
        // this.element.appendChild(wrapper);

        const { button, setIcon } = this.buildButton();
        const { island, timeSpan, fill } = this.buildIsland(this, 100);

        // button.addEventListener("click", () => {
        //     this._running = !this._running;
        //     setIcon(this._running);
        //     if (this._running) {
        //         this._passed += 1; // increment passed time
        //     }
        //     // timeSpan.textContent = formatTime(this._passed);
        //     fill.style.width = `${(this._passed / this._limit) * 100}%`;
        // });

        // timeSpan.textContent = formatTime(this._passed);
        // fill.style.width = `${(this._passed / this._limit) * 100}%`;

        wrapper.appendChild(button);
        wrapper.appendChild(island);

        this._element.replaceWith(wrapper);

    }

    private buildButton() {
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


    private buildIsland(spec: StopwatchData, minWidth: number) {

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

        const tl = document.createElement("div");
        tl.addClass("inline-stopwatch-timeline");
        const fill = document.createElement("div");
        fill.addClass("inline-stopwatch-fill");
        tl.appendChild(fill); isl.appendChild(tl);

        return { island: isl, timeSpan: time, fill };
    }

}


export class TagManager {

    private tags: Record<string, Tag> = {};

    private defaultTag: StopwatchData = {
        id: "1",
        passed: 0,
        limit: 60,
        name: "",
        running: false,
    }

    parse(elements: HTMLElement[]): Tag[] {
        console.log("Parsing element:", elements);
        const findedTags: Tag[] = [];
        elements.forEach(element => {
            const codeblocks = element.findAll('code');
            for (let codeblock of codeblocks) {
                const parsed = tagParser.start(codeblock.textContent ?? "");
                if (parsed) {
                    if (!parsed.id) {
                        parsed.id = this.newId();
                    }
                    if (this.tags[parsed.id]) {
                        parsed.id = this.newId();
                    }
                    const tag = new Tag(codeblock, parsed, this.defaultTag);
                    this.tags[parsed.id] = tag;
                    findedTags.push(tag);
                }
            }
        })
        return findedTags;
    }

    private newId(): string {
        const ids = Object.keys(this.tags);
        if (ids.length === 0) return "1";
        const maxId = Math.max(...ids.map(id => parseInt(id, 10)));
        return (maxId + 1).toString();
    }

    draw(): void {
        Object.values(this.tags).forEach(tag => {
            tag.draw();
        });
    }

    write() {
        Object.values(this.tags).forEach(tag => {
            tag.element.textContent = tag.stringify();
        });
    }

    print() {
        console.log("Parsed tags:", this.tags);
    }


}