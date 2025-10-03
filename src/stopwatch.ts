import { z } from "zod";
import { now, NotOptional, YesNo, waitForIn } from "./utils";

export const stopwatchSchema = z.object({
    name: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),

    techStuff: z.object({
        id: z.string().optional(),
        startDate: z.string().optional(),
        passed: z.coerce.number().int().nonnegative().optional(),
        running: z.enum(["yes", "no"]).optional(),
    }).optional(),
});
export type StopwatchDataPartial = z.infer<typeof stopwatchSchema>;
export type StopwatchData = NotOptional<StopwatchDataPartial>;

class Tag {

    constructor(
        private _element: HTMLElement,
        private _data: StopwatchData
    ) { }


    get data(): StopwatchData {
        return this._data;
    }

    set data(data: StopwatchData) {
        this._data = data;
        this.draw();
    }

    private get element(): HTMLElement { return this._element; }

    private callback() {

        this.data = {
            ...this.data,
            techStuff: {
                ...this.data.techStuff,
                running: this.data.techStuff.running === "yes" ? "no" : "yes",
                passed: now() - Number(this.data.techStuff.startDate),
                startDate: "0"
            }
        };

    }

    async draw(): Promise<void> {
        this.element.empty();
        const parent = this.element.parentElement;
        if (!parent) return;

        parent.style.width = "min-content";

        waitForIn(parent, ".edit-block-button").then(editButton => {
            if (!editButton) return;
            const btnHeight = editButton.offsetHeight;
            editButton.style.top = `calc(50% - ${btnHeight / 2}px)`;
            const topOffset = editButton.offsetTop;
            editButton.style.right = `${topOffset}px`;
            editButton.style.position = "absolute";
        });

        const wrapper = document.createElement("span");
        wrapper.addClass("inline-stopwatch-wrapper");

        const { button, setIcon } = this.buildButton(this.data.techStuff.running, this.callback);
        const { island, timeSpan, fill } = this.buildIsland(this.data, 100);

        wrapper.appendChild(button);
        wrapper.appendChild(island);

        this._element.replaceWith(wrapper);
    }

    update(): void {
        if (this.data.techStuff.running === "yes") {
            this.draw();
        }
    }

    private buildButton(running: YesNo, callback: () => void) {
        const b = document.createElement("button");
        b.addClass("inline-stopwatch-button");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttr("viewBox", "0 0 16 16");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        svg.appendChild(path); b.appendChild(svg);
        const set = (r: boolean) => path.setAttr("d", r ? "M2 2h4v12H2zm8 0h4v12h-4z" : "M3 2v12l10-6-10-6z");

        set(running === "yes");
        b.addEventListener("click", callback);

        return { button: b, setIcon: set };
    }


    private buildIsland(spec: StopwatchData, minWidth: number) {
        const isl = document.createElement("span");
        isl.addClass("inline-stopwatch-island");
        isl.style.minWidth = `${minWidth}px`;

        const time = document.createElement("span");
        time.addClass("inline-stopwatch-time");


        if (spec.name.trim() !== "") {
            const n = document.createElement("span");
            n.addClass("inline-stopwatch-name"); n.textContent = spec.name;
            isl.appendChild(n);
            time.addClass("inline-stopwatch-muted");
        }

        isl.appendChild(time);
        const tl = document.createElement("div");
        tl.addClass("inline-stopwatch-timeline");
        const fill = document.createElement("div");
        fill.addClass("inline-stopwatch-fill");
        tl.appendChild(fill); isl.appendChild(tl);
        return { island: isl, timeSpan: time, fill };
    }

}





class TagManager {

    private tags: Record<string, Tag> = {};

    private defaultTag: StopwatchData = {
        name: "",
        limit: 60,
        techStuff: {
            id: "1",
            startDate: "",
            passed: 0,
            running: "no",
        },
    }
    //дополнить данные тега
    private completeData(parsedData: StopwatchDataPartial): StopwatchData {
        const mergedTechStuff = {
            ...this.defaultTag.techStuff,
            ...(parsedData.techStuff ?? {}),
            id: parsedData.techStuff?.id ?? this.newId(),
        };

        const data: StopwatchData = {
            ...this.defaultTag,
            ...parsedData,
            techStuff: mergedTechStuff,
        };
        return data;
    }

    makeTag(element: HTMLElement, parsedData: StopwatchDataPartial): Tag {
        const data = this.completeData(parsedData);
        const tag = new Tag(element, data);

        tag.draw();

        return tag;
    }

    private newId(): string {
        const ids = Object.keys(this.tags);
        if (ids.length === 0) return "1";
        const maxId = Math.max(...ids.map(id => parseInt(id, 10)));
        return (maxId + 1).toString();
    }

    private update(): void {
        Object.values(this.tags).forEach(tag => {
            tag.update();
        });
    }

    start(): void {
        setInterval(() => this.update(), 500);
    }

}

export const tagManager = new TagManager();
