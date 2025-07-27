// main.ts
import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    MarkdownPostProcessorContext,
    TFile
} from "obsidian";


import { ParamsStructure, TagParser } from "./parser";
import { TagManager } from "./tagManager";

const paramsStructure = {
    id: { tagName: "id", innerType: "string" },
    passed: { tagName: "passed", innerType: "integer" },
    limit: { tagName: "limit", innerType: "integer" },
    name: { tagName: "name", innerType: "string" },
    running: { tagName: "running", innerType: "yesno" },
} as const satisfies ParamsStructure;


// import { tagManager } from "./snippet";

const tagParser = new TagParser("stopwatch", paramsStructure);

export default class ExamplePlugin extends Plugin {
    async onload() {

        const tagManager = new TagManager();
        this.registerMarkdownPostProcessor((element) => {
            // const codeblocks = element.findAll('code');

            // for (let codeblock of codeblocks) {
            //     console.log("found:", tagParser.start(codeblock.textContent ?? ""));
            // }

            // console.log(element.innerHTML);
            tagManager.parse(element)?.draw();
            // tagManager.draw();
        });

        const file = this.app.workspace.getActiveFile();
        if (!file) return;

        // const content = await this.app.vault.read(file);
        // this.app.vault.modify(file, content + "жопа");

        tagManager.print();
        // tagManager.write();
    }
}