/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { getShortenedResultCount } from '../src/stackexchange';

describe('stackexchange helpers', () => {
    it('should correctly get the correct shortened result count', () => {
        const valuesArray = [ // expect(array[0]).to.equal(array[1])
            [152, '152'],
            [2182, '2.2k'],
            [3972, '4k'],
            [4029, '4k'],
            [1029, '1k'],
            [999, '999'],
            [40100, '40.1k'],
            [1051, '1.1k']
        ] as [number, string][];

        valuesArray.forEach(([inserted, expected]) => expect(getShortenedResultCount(inserted)).to.equal(expected));
    });
});