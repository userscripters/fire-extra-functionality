/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { getAllDomainsFromPost } from '../src/metasmoke.js';

global.window = {} as Window & typeof globalThis;

describe('metasmoke helpers', () => {
    it('should fetch a post\'s domains given its id in metasmoke', async () => {
        const domainsArray = await Promise.all([311240, 311227, 311248].map(metasmokePostId => getAllDomainsFromPost(metasmokePostId)));
        expect(domainsArray.length).to.equal(3);
        expect(domainsArray[0][1].id).to.equal(3);
        expect(domainsArray[2][0].domain).to.be.equal('firebasestorage.googleapis.com');
    });
});