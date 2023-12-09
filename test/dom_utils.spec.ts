import { expect } from 'chai';
import {
    createTag,
    getResultsContainer,
    updateMsCounts,
    updateSeCount
} from '../src/dom_utils';
import { helpers } from '../src/index';

describe('DOM utils', () => {
    it('should get the results container', () => {
        const resultsContainer = getResultsContainer('example.com');
        const [msPart, sePart] = resultsContainer.children;

        // general
        expect(resultsContainer.style.marginRight).to.be.equal('7px');

        // MS part
        expect(msPart.children[0].textContent).to.be.equal('MS');
        expect(msPart.children[1].classList.contains('fire-extra-ms-stats')).to.be.true;
        expect(msPart.children[1].children[0]?.classList.contains('fire-extra-wait')).to.be.true;

        // SE part
        expect(sePart.classList.contains('fire-extra-se-results'));
        expect(sePart.children[0].children[0].classList.contains('fire-extra-wait')).to.be.true;

        expect(resultsContainer).not.to.be.null;
    });

    it('should get a tag in metasmoke\'s style', () => {
        ['shortener', 'ip', 'whitelisted', 'stuff-up'].forEach(tagName => {
            const tag = createTag(tagName);

            expect(tag.classList.contains('fire-extra-tag'));
            expect(tag.textContent).to.be.equal(`#${tagName}`);
        });
    });

    it('should correctly update MS counts using coloured spans', () => {
        [
            [1, 0, 0],
            [0, 2, 3],
            [8, 16, 23]
        ].forEach(counts => {
            const domainLi = document.createElement('li');
            domainLi.append(getResultsContainer('example.com'));
            updateMsCounts(counts, domainLi);

            const msStatsEl = domainLi.querySelector('.fire-extra-ms-stats') as HTMLElement;
            const [tpCount, fpCount, naaCount] = counts;
            const [
                tpElement,
                fpElement,
                naaElement
            ] = msStatsEl.children;
            const getTooltip = (count: number, type: string): string => `${count} ${helpers.pluralise(type, count)}`;

            expect(msStatsEl.textContent).to.be.equal(counts.join(', '));

            expect(tpElement.classList.contains('fire-extra-tp')).to.be.true;
            expect(tpElement.textContent).to.be.equal(tpCount.toString());
            expect(tpElement.getAttribute('fire-tooltip')).to.equal(getTooltip(tpCount, 'TP'));

            expect(fpElement.classList.contains('fire-extra-fp')).to.be.true;
            expect(fpElement.textContent).to.be.equal(fpCount.toString());
            expect(fpElement.getAttribute('fire-tooltip')).to.equal(getTooltip(fpCount, 'FP'));

            expect(naaElement.classList.contains('fire-extra-naa')).to.be.true;
            expect(naaElement.textContent).to.be.equal(naaCount.toString());
            expect(naaElement.getAttribute('fire-tooltip')).to.equal(getTooltip(naaCount, 'NAA'));
        });
    });

    it('should correctly update SE count given the results container', () => {
        const domainLi = document.createElement('div');
        domainLi.append(getResultsContainer('example.com'));

        updateSeCount('10.5k', domainLi);

        const hitCountAnchor = domainLi.querySelector('.fire-extra-se-results a') as HTMLElement;

        expect(hitCountAnchor.innerHTML).to.be.equal('SE: 10.5k');
        expect(hitCountAnchor.getAttribute('fire-tooltip')).to.be.equal('10.5k hits on SE');
    });
});
