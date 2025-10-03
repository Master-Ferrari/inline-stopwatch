import z from "zod";
import { generateErrorMessage, type ErrorMessageOptions } from "zod-error";


const ZOD_ERR_OPTS: ErrorMessageOptions = {
    code: { enabled: false },
    message: { enabled: false },
    path: { enabled: true, type: "objectNotation", label: "" },
    delimiter: { error: "\n", component: " " },
    transform: ({ issue, pathComponent }) =>
        `${pathComponent.trim() || "<root>"}: ${"expected" in issue ? "expected " + issue.expected : issue.code}${"received" in issue ? ` but received ${issue.received}` : ""
        }.`,
};

type TagValueWIP = {
    type: "final",
    value: string
} | {
    type: "group",
    value: string
};

type TagObjectWIP = Record<string, TagValueWIP>;

type GroupValueWIP = {
    value: string,
    next: string
};

type GroupParsed = any;
type ParsedGroup = {
    type: "groupParsed",
    value: GroupParsed
};
type TagValueWIPRecursive = TagValueWIP | ParsedGroup;
type TagObjectWIPObject = [string, TagValueWIPRecursive][];

export class TagSyntaxHandler<Z extends z.ZodType> {

    constructor(
        private tagSchema: Z,
        private blockName: string
    ) { }

    private parseGroupValue(str: string): GroupValueWIP {
        let depth = 0, start = -1;
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (ch === '{') {
                if (depth === 0) start = i;
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0 && start !== -1) {

                    return {
                        value: str.slice(start + 1, i).trim(),
                        next: str.slice(i + 1, str.length).trim() //// или i+0 ???
                    }
                    // start = -1;
                } else if (depth < 0) { // защитимся от лишней '}'
                    // depth = 0; start = -1;
                    throw Error("ошибка скобочек");
                }
            }
        }
        return {
            value: "",
            next: str
        }
    }

    private topLevelParse(str: string): TagObjectWIP {
        const out: TagObjectWIP = {};
        let next = str;
        do {
            const regex = /(\w+)[\s]?:([\s\S]*)/m; // достать первый ключ и всё после
            const parsed = regex.exec(next);
            if (!parsed) break; // нету ключей
            const key = parsed[1]
            next = parsed[2].trim();

            let value: string;
            if (next[0] == "{") { // если группа, парсим топ левел
                // console.log("группа");
                const parsed = this.parseGroupValue(next);
                value = parsed.value.trim();
                next = parsed.next;
                out[key] = { type: "group", value: value };
            } else { // если не группа, парсим до следующего ключа
                const regex = /^([\s\S]*?(?=\b\w+[\s]?:))([\s\S]*)/m; // достать всё до первого ключа. если регекс не сработал, следующего ключа нет.
                const parsed = regex.exec(next);
                if (!parsed) {
                    // console.log("последнее значение");
                    value = next.trim();
                    next = "";
                } else {
                    // console.log("значение");
                    value = parsed[1].trim();
                    next = parsed[2];
                }
                out[key] = { type: "final", value: value };
            }
            // console.log([key, value]);
        } while (next.trim() !== "");
        return out;
    }

    private parseTag(str: string) {

        const recursion = (key: string, tagWIP: TagObjectWIPObject): { key: string, values: TagObjectWIPObject } => {
            const doneValues = tagWIP.filter(entry => entry[1].type == "final");
            const groupValues = tagWIP.filter(entry => entry[1].type == "group");

            const parsedGroups = groupValues.map(group => {
                const value = group[1].value;
                const record = Object.entries(this.topLevelParse(value));
                const parsed = recursion(group[0], record);
                const parsedGroup: ParsedGroup = {
                    type: "groupParsed",
                    value: parsed.values
                };
                const out: [string, TagValueWIPRecursive] = [parsed.key, parsedGroup]
                return out;
            })

            return {
                key,
                values: doneValues.concat(parsedGroups)
            }

        };

        // const parsed = topLevelParse(str);
        const root = Object.entries(this.topLevelParse(str));
        const parsed = recursion("root", root);
        // const structure = parsed
        return parsed.values
    }

    private stripQuotes(s: string) {
        const t = String(s).trim();
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
            return t.slice(1, -1);
        }
        return t;
    }

    private toObject(pairs: TagObjectWIPObject): z.infer<Z> {
        const obj: any = {};
        for (const [key, val] of pairs) {
            if (val.type === "final") {
                obj[key] = this.stripQuotes(val.value);
            } else if (val.type === "groupParsed") {
                obj[key] = this.toObject(val.value);
            }
        }
        return obj;
    }

    public parse(str: string): { success: true, result: z.infer<Z> } | { success: false, error: string } {
        try {
            const parsed = this.parseTag(str);
            const toObject = this.toObject(parsed);
            const validated = this.tagSchema.safeParse(toObject);

            if (!validated.success) {
                return { success: false, error: generateErrorMessage(validated.error.issues as any, ZOD_ERR_OPTS) };
            }

            return { success: true, result: validated.data };
        } catch (e) {
            console.error(e);
            return { success: false, error: "Error" };
        }
    }

    public write(obj: z.infer<Z>): string {
        const escapeString = (s: unknown) =>
            `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

        const isPlainObject = (v: any) =>
            v !== null && typeof v === "object" && !Array.isArray(v);

        const render = (o: any): string => {
            const parts: string[] = [];
            for (const [k, v] of Object.entries(o)) {
                if (isPlainObject(v)) {
                    parts.push(`${k}: { ${render(v)} }`);
                } else if (Array.isArray(v)) {
                    const arrObj: Record<string, any> = {};
                    v.forEach((item, i) => (arrObj[String(i)] = item));
                    parts.push(`${k}: { ${render(arrObj)} }`);
                } else if (typeof v === "number" || typeof v === "boolean") {
                    parts.push(`${k}: ${String(v)}`);
                } else if (v === null || v === undefined) {
                    parts.push(`${k}: null`);
                } else {
                    parts.push(`${k}: ${escapeString(v)}`);
                }
            }
            return parts.join(" ");
        };

        const out = "```" + this.blockName + "\n" + render(obj).trim() + "\n```";

        return out;
    }

}
