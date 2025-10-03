// main.ts
import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    MarkdownPostProcessorContext,
    TFile
} from "obsidian";

import z from "zod";
import { TagSyntaxHandler } from "./TagSyntaxHandler";
import { parse } from "path";

const stopwatchSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
    startDate: z.string().optional(),
    passed: z.coerce.number().int().nonnegative().optional(),
    running: z.enum(["yes", "no"]).optional(),
});

export default class ExamplePlugin extends Plugin {
    async onload() {

        const stopwatchSyntaxHandler = new TagSyntaxHandler(stopwatchSchema, "stopwatch");


        this.registerMarkdownCodeBlockProcessor("stopwatch", (source, el, ctx) => {
            console.log("source", source);
            const parsed = stopwatchSyntaxHandler.parse(source);
            console.log("parsed", parsed.success ? parsed.result : parsed.error);

            if (!parsed.success) {
                el.createEl("div", { text: `Syntax Error. ${parsed.error}` });
                return;
            }

            const serialized = stopwatchSyntaxHandler.write(parsed.result);
            el.createEl("div", { text: serialized });
        });

        const file = this.app.workspace.getActiveFile();
        if (!file) return;
    }
}