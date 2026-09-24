import type { ProjectResource } from '$lib/types/projects';

export interface SelectableProjectResource {
    resourceContentId: number;
    label: string;
    statusDisplayName: string | null;
    sortOrder: number;
}

/**
 * Turns a project's resources into the rows shown by the pre-translation re-run picker, dropping any without a resource content id
 * since those cannot be re-run, and ordering them the same way the project view does.
 */
export function getSelectableProjectResources(items: ProjectResource[]): SelectableProjectResource[] {
    return items
        .filter((item) => item.resourceContentId !== null)
        .map((item) => ({
            resourceContentId: item.resourceContentId as number,
            label: buildLabel(item),
            statusDisplayName: item.statusDisplayName,
            // Resources without a sortOrder go last rather than being dropped or jumping to the top.
            sortOrder: item.sortOrder ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function buildLabel(item: ProjectResource): string {
    if (item.parentResourceName && item.englishLabel) {
        return `${item.parentResourceName} - ${item.englishLabel}`;
    }

    return item.englishLabel ?? item.parentResourceName ?? `Resource Content ${item.resourceContentId}`;
}

/** Matches on the label or on the resource content id, so an id copied from a log can be pasted into the filter. */
export function filterSelectableResources(
    resources: SelectableProjectResource[],
    filterText: string
): SelectableProjectResource[] {
    const trimmed = filterText.trim().toLowerCase();
    if (trimmed === '') {
        return resources;
    }

    return resources.filter(
        (r) => r.label.toLowerCase().includes(trimmed) || String(r.resourceContentId).includes(trimmed)
    );
}

/** Nothing selected means the whole project, which the API expects as null. */
export function toResourceContentIdsPayload(selectedIds: number[]): number[] | null {
    return selectedIds.length > 0 ? selectedIds : null;
}
