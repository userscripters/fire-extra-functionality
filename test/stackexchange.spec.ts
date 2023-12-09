import { expect } from 'chai';
import {
    getSeUrl,
    getSeResultCount,
    getShortenedResultCount
} from '../src/stackexchange';
import jsdom from "jsdom";

const { JSDOM } = jsdom;

global.DOMParser = new JSDOM().window.DOMParser;

describe('stackexchange helpers', () => {
    it('should correctly get the correct Stack Exchange search URL', () => {
        expect(getSeUrl('example.com')).to.be.equal('https://stackexchange.com/search?q=url%3Aexample.com');
        expect(getSeUrl('KdxEAt91D7k')).to.be.equal('https://stackexchange.com/search?q=KdxEAt91D7k');
    });

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

        valuesArray
            .forEach(([inserted, expected]) => expect(getShortenedResultCount(inserted)).to.equal(expected));
    });

    it('should correctly fetch the SE results given part of the page\'s HTML', () => {
        const html = `<div class="subheader results-header">
                          <h2>
                              4,542,120 <span class="results-label">results</span>
                          </h2>
                      </div>`;
        const parsedHtml = new JSDOM(html).window.document;

        expect(getSeResultCount(parsedHtml)).to.be.equal('4542120');
    });
});
