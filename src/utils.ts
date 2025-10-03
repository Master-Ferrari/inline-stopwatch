

export function now(): number {
    return Number(new Date().toISOString());
}

export type NotOptional<T> = {
    [K in keyof T]-?: Exclude<T[K], undefined> extends infer U
    ? U extends object
    ? NotOptional<U>
    : U
    : never;
};

export type YesNo = "yes" | "no";

export async function waitForIn(root: Element, sel: string, ms = 2000): Promise<HTMLElement | null> {
    const found = root.querySelector(sel) as HTMLElement | null;
    if (found) return found;
    return new Promise(resolve => {
        const obs = new MutationObserver(() => {
            const el = root.querySelector(sel) as HTMLElement | null;
            if (el) { obs.disconnect(); resolve(el); }
        });
        obs.observe(root, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); resolve(null); }, ms);
    });
}