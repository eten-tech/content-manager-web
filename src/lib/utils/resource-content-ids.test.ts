import { describe, it, expect } from 'vitest';
import { parseResourceContentIds } from './resource-content-ids';

describe('parseResourceContentIds', () => {
    it('returns no ids for blank input', () => {
        expect(parseResourceContentIds('')).toEqual({ ids: [], invalid: [] });
        expect(parseResourceContentIds('   ')).toEqual({ ids: [], invalid: [] });
    });

    it('parses a comma separated list', () => {
        expect(parseResourceContentIds('1,2,3')).toEqual({ ids: [1, 2, 3], invalid: [] });
    });

    it('tolerates whitespace and trailing separators', () => {
        expect(parseResourceContentIds(' 1 , 2 ,\n3 , ')).toEqual({ ids: [1, 2, 3], invalid: [] });
    });

    it('separates on whitespace alone', () => {
        expect(parseResourceContentIds('1 2 3')).toEqual({ ids: [1, 2, 3], invalid: [] });
    });

    it('deduplicates while preserving the order entered', () => {
        expect(parseResourceContentIds('3,1,3,1')).toEqual({ ids: [3, 1], invalid: [] });
    });

    it('reports non-numeric entries instead of silently dropping them', () => {
        expect(parseResourceContentIds('1,abc,3')).toEqual({ ids: [1, 3], invalid: ['abc'] });
    });

    it('reports entries that are not positive whole numbers', () => {
        expect(parseResourceContentIds('1,0,-2,1.5')).toEqual({ ids: [1], invalid: ['0', '-2', '1.5'] });
    });

    it('does not expand ranges, which are not meaningful for resource content ids', () => {
        expect(parseResourceContentIds('1-3')).toEqual({ ids: [], invalid: ['1-3'] });
    });
});
