import { expect } from 'chai';
import { getDomainId } from '../src/index.js';

global.GM_getResourceText = (url: string): string => 'mock resource text, url: ' + url;

describe('main', () => {
    it('everything works ok', () => {
        expect(true).to.be.true;
        expect(getDomainId('stackoverflow.com')).to.be.equal('fire-extra-stackoverflow-com');
    });
});