type InnerType = "string" | "integer" | "yesno";

export type Param<T extends InnerType = InnerType> = {
    tagName: string;    // как тег выглядит в тексте
    innerType: T;       // к какому типу приводить
};

export type ParamsStructure = Record<string, Param>;

type ValueByType<T extends InnerType> =
    T extends "string" ? string | null :
    T extends "integer" ? number | null :
  /* yesno */           boolean | null;

export type ParsedBy<S extends ParamsStructure> = {
    -readonly [K in keyof S]: ValueByType<S[K]["innerType"]>;
};

export class TagParser<S extends ParamsStructure> {
    private readonly blockName: string;
    private readonly structure: S;
    private readonly tagList: string[];

    constructor(blockName: string, structure: S) {
        this.blockName = blockName;
        this.structure = structure;
        this.tagList = Object.values(structure).map(p => p.tagName);
    }

    /** Парсим строку -> объект или null */
    start(str: string): ParsedBy<S> | null {
        const idx = str.indexOf(this.blockName);
        if (idx === -1) return null;                           // блока нет

        let chunk = str.slice(idx + this.blockName.length).trim();
        if (!chunk) return null;                               // тегов нет

        /* делим строку так, чтобы каждый фрагмент начинался с имени тега */
        let parts: string[] = [chunk];
        this.tagList.forEach(tag => {
            parts = parts.flatMap(p => p.split(new RegExp(`(?=${tag}\\s*:)`, "g")));
        });
        parts = parts.filter(Boolean).map(p => p.trim());

        /* превращаем фрагменты в объект нужного типа */
        const obj: Partial<ParsedBy<S>> = {};

        (Object.entries(this.structure) as [keyof S, Param][]).forEach(
            ([key, { tagName, innerType }]) => {

                const raw = parts.find(p => p.startsWith(tagName));
                if (!raw) { (obj as any)[key] = null; return; }

                const [, valRaw = ""] = raw.split(/:(.+)/);
                const val = valRaw.trim();

                switch (innerType) {
                    case "integer": {
                        const num = Number(val.replace(/\D+/g, ""));
                        (obj as any)[key] = Number.isFinite(num) ? num : null;
                        break;
                    }
                    case "yesno": {
                        const l = val.toLowerCase();
                        (obj as any)[key] =
                            l.includes("yes") ? true :
                                l.includes("no") ? false : null;
                        break;
                    }
                    default: {                                         // string
                        (obj as any)[key] = val || null;
                    }
                }
            });

        return obj as ParsedBy<S>;
    }
}
