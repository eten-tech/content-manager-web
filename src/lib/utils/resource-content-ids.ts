export interface ParsedResourceContentIds {
    ids: number[];
    invalid: string[];
}

/**
 * Parses an admin-entered list of resource content ids, separated by commas, semicolons and/or whitespace.
 *
 * Deliberately separate from `parseNumbersListFromString` in ./number-list-parser: that helper is built for bounded ranges, requiring
 * min/max and silently discarding anything outside them. Resource content ids have no natural upper bound, and silently dropping an id
 * the admin typed would queue fewer resources than they asked for without telling them, so unparseable entries are reported instead.
 */
export function parseResourceContentIds(input: string): ParsedResourceContentIds {
    const ids: number[] = [];
    const invalid: string[] = [];

    for (const entry of input.split(/[,;\s]+/)) {
        const trimmed = entry.trim();
        if (trimmed === '') {
            continue;
        }

        // Number() accepts decimals, signs and exponents, none of which are valid ids, so require plain digits.
        if (!/^\d+$/.test(trimmed)) {
            invalid.push(trimmed);
            continue;
        }

        const id = Number(trimmed);
        if (id <= 0) {
            invalid.push(trimmed);
            continue;
        }

        if (!ids.includes(id)) {
            ids.push(id);
        }
    }

    return { ids, invalid };
}
