/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { indexHelpers } from '../src/index';

global.GM_getResourceText = (url: string): string => 'mock resource text, url: ' + url;

describe('index helpers', () => {
    it('should find if a domain with specific stats qualifies for watch', () => {
        expect(indexHelpers.qualifiesForWatch([1, 0, 0], '0')).to.be.true;
        expect(indexHelpers.qualifiesForWatch([5, 0, 0], '10')).to.be.false;
        expect(indexHelpers.qualifiesForWatch([1, 0, 1], '2')).to.be.false;
    });
    it('should find if a domain with specific stats qualifies for blacklist', () => {
        expect(indexHelpers.qualifiesForBlacklist([5, 0, 0], '4')).to.be.true;
        expect(indexHelpers.qualifiesForBlacklist([10, 0, 0], '5')).to.be.false;
        expect(indexHelpers.qualifiesForBlacklist([10, 2, 0], '4')).to.be.false;
    });

    it('should get the correct li id given a domain', () => {
        expect(indexHelpers.getDomainId('stackoverflow.com')).to.be.equal('fire-extra-stackoverflow-com');
        expect(indexHelpers.getDomainId('many.many.dots.here')).to.be.equal('fire-extra-many-many-dots-here');
    });
});