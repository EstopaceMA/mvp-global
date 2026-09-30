import { viewHref } from "./directory";
import type { Filters } from "./types";

export function profileHref(id: string, filters: Filters) {
    return viewHref(`/mvps/${encodeURIComponent(id)}`, filters);
}

export function profileInitials(name: string) {
    return name.split(/\s+/).filter(word => /\p{L}/u.test(word)).slice(0, 2)
        .map(word => [...word][0]).join("").toUpperCase();
}