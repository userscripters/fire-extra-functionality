import { expect } from 'chai';
import {
    getAllDomainsFromPost,
    getMsSearchResults
} from '../src/metasmoke.js';
import jsdom from "jsdom";

const { JSDOM } = jsdom;

// @ts-ignore
global.GM_xmlhttpRequest = ({
    url,
    onload,
    onerror
}) => {
    fetch(url)
        .then(async response => {
            // @ts-ignore
            onload({
                status: response.status,
                responseText: await response.text()
            })
        })
        // @ts-ignore
        .catch(error => onerror(error));
}
global.DOMParser = new JSDOM().window.DOMParser;

describe('metasmoke helpers', () => {
    it('should fetch a post\'s domains given its id in metasmoke', async () => {
        const postIds = [311240, 311227, 311248];
        const domains = postIds.map(metasmokePostId => getAllDomainsFromPost(metasmokePostId));
        const domainsArray = await Promise.all(domains);

        expect(domainsArray.length).to.equal(3);
        expect(domainsArray[0][1].id).to.equal(3);
        expect(domainsArray[2][0].domain).to.be.equal('firebasestorage.googleapis.com');
    });

    it('should fetch the post counts of the path of a URL shortener', async function() {
        this.timeout(10000); // due to calls to MS search

        const termEntries = Object.entries({
            'LcZ2pm9XtXA': [3, 0, 0],
            'FNEuyd': [0, 1, 0],
            '3vcWir3': [1, 0, 0]
        });

        for (const [term, expectedCounts] of termEntries) {
            const actualCounts = await getMsSearchResults(term);
            expect(actualCounts).deep.equal(expectedCounts);
        }
    });
});
