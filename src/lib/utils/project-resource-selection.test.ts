import { describe, it, expect } from 'vitest';
import {
    getSelectableProjectResources,
    filterSelectableResources,
    toResourceContentIdsPayload,
} from './project-resource-selection';
import type { ProjectResource } from '$lib/types/projects';

function resource(overrides: Partial<ProjectResource>): ProjectResource {
    return {
        assignedUserName: null,
        englishLabel: null,
        parentResourceName: null,
        resourceContentId: null,
        statusDisplayName: null,
        sortOrder: null,
        wordCount: null,
        ...overrides,
    };
}

describe('getSelectableProjectResources', () => {
    it('drops resources with no resource content id, which cannot be re-run', () => {
        const items = [
            resource({ resourceContentId: 1, englishLabel: 'Has an id' }),
            resource({ resourceContentId: null, englishLabel: 'No id' }),
        ];

        expect(getSelectableProjectResources(items).map((r) => r.resourceContentId)).toEqual([1]);
    });

    it('orders by sortOrder so the list matches the project view', () => {
        const items = [
            resource({ resourceContentId: 3, sortOrder: 30 }),
            resource({ resourceContentId: 1, sortOrder: 10 }),
            resource({ resourceContentId: 2, sortOrder: 20 }),
        ];

        expect(getSelectableProjectResources(items).map((r) => r.resourceContentId)).toEqual([1, 2, 3]);
    });

    it('keeps resources with no sortOrder, placing them last rather than dropping them', () => {
        const items = [
            resource({ resourceContentId: 2, sortOrder: null }),
            resource({ resourceContentId: 1, sortOrder: 10 }),
        ];

        expect(getSelectableProjectResources(items).map((r) => r.resourceContentId)).toEqual([1, 2]);
    });

    it('builds a label from the parent resource name and english label', () => {
        const items = [resource({ resourceContentId: 1, parentResourceName: 'FIA', englishLabel: 'Mark 1:1-8' })];

        expect(getSelectableProjectResources(items)[0]?.label).toBe('FIA - Mark 1:1-8');
    });

    it('falls back to the english label alone when there is no parent resource name', () => {
        const items = [resource({ resourceContentId: 1, englishLabel: 'Mark 1:1-8' })];

        expect(getSelectableProjectResources(items)[0]?.label).toBe('Mark 1:1-8');
    });

    it('falls back to the id when there is no label at all, so a row is never blank', () => {
        const items = [resource({ resourceContentId: 42 })];

        expect(getSelectableProjectResources(items)[0]?.label).toBe('Resource Content 42');
    });
});

describe('filterSelectableResources', () => {
    const resources = getSelectableProjectResources([
        resource({ resourceContentId: 373679, parentResourceName: 'FIA', englishLabel: 'Mark 1:1-8', sortOrder: 1 }),
        resource({ resourceContentId: 373680, parentResourceName: 'UWTN', englishLabel: 'Mark 1:9-13', sortOrder: 2 }),
    ]);

    it('returns everything for blank filter text', () => {
        expect(filterSelectableResources(resources, '   ')).toHaveLength(2);
    });

    it('matches on the label, ignoring case', () => {
        expect(filterSelectableResources(resources, 'uwtn').map((r) => r.resourceContentId)).toEqual([373680]);
    });

    it('matches on a partial resource content id, so an id from a log can be pasted', () => {
        expect(filterSelectableResources(resources, '373679').map((r) => r.resourceContentId)).toEqual([373679]);
    });

    it('returns nothing when there is no match', () => {
        expect(filterSelectableResources(resources, 'nope')).toEqual([]);
    });
});

describe('toResourceContentIdsPayload', () => {
    it('sends null when nothing is selected, which re-runs the whole project', () => {
        expect(toResourceContentIdsPayload([])).toBeNull();
    });

    it('sends the selected ids', () => {
        expect(toResourceContentIdsPayload([2, 1])).toEqual([2, 1]);
    });
});
