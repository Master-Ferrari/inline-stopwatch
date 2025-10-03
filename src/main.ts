import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    MarkdownPostProcessorContext,
    TFile
} from "obsidian";

import { TagSyntaxHandler } from "./TagSyntaxHandler";
import { stopwatchSchema, tagManager } from "./stopwatch";

export default class ExamplePlugin extends Plugin {
    async onload() {

        const stopwatchSyntaxHandler = new TagSyntaxHandler(stopwatchSchema, "stopwatch");


        this.registerMarkdownCodeBlockProcessor("stopwatch", (source, el, ctx) => {

            const parsed = stopwatchSyntaxHandler.parse(source);
            if (!parsed.success) {
                el.createEl("div", { text: `Syntax Error. ${parsed.error}` });
                return;
            }

            tagManager.makeTag(el, parsed.result);

        });
        
        tagManager.start();

        const file = this.app.workspace.getActiveFile();
        if (!file) return;
    }
}