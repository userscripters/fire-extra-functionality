import { expect } from 'chai';
import {
    getTag,
    getResultsContainer,
    updateMsCounts,
    updateSeCount,
    getWatchBlacklistButtons
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
        expect(msPart.children[1].children[0].classList.contains('fire-extra-wait')).to.be.true;

        // SE part
        expect(sePart.classList.contains('fire-extra-se-results'));
        expect(sePart.children[0].children[0].classList.contains('fire-extra-wait')).to.be.true;

        expect(resultsContainer).not.to.be.null;
    });

    it('should correctly return the container of !!/watch and !!/blacklist buttons', () => {
        const container = getWatchBlacklistButtons();
        const [watch, blacklist] = [...container.children];

        expect(watch.innerHTML).to.equal('!!/watch');
        expect(watch.className).to.equal('fire-extra-watch');

        expect(blacklist.innerHTML).to.equal('!!/blacklist');
        expect(blacklist.className).to.equal('fire-extra-blacklist');
    });

    it('should get a tag in metasmoke\'s style', () => {
        ['shortener', 'ip', 'whitelisted', 'stuff-up'].forEach(tagName => {
            const tag = getTag(tagName);

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
            const [tpEl, fpEl, naaEl] = msStatsEl.children;

            const getTooltip = (
                count: number,
                type: string
            ): string => `${count} ${helpers.pluralise(type, count)}`;

            expect(msStatsEl.textContent).to.be.equal(counts.join(', '));

            expect(tpEl.classList.contains('fire-extra-tp')).to.be.true;
            expect(fpEl.classList.contains('fire-extra-fp')).to.be.true;
            expect(naaEl.classList.contains('fire-extra-naa')).to.be.true;

            expect(tpEl.textContent).to.be.equal(tpCount.toString());
            expect(fpEl.textContent).to.be.equal(fpCount.toString());
            expect(naaEl.textContent).to.be.equal(naaCount.toString());

            expect(tpEl.getAttribute('fire-tooltip')).to.equal(getTooltip(tpCount, 'TP'));
            expect(fpEl.getAttribute('fire-tooltip')).to.equal(getTooltip(fpCount, 'FP'));
            expect(naaEl.getAttribute('fire-tooltip')).to.equal(getTooltip(naaCount, 'NAA'));
        });
    });

    it('should correctly update SE count given the results container', () => {
        const domainLi = document.createElement('div');
        domainLi.append(getResultsContainer('example.com'));

        updateSeCount('10.5k', domainLi);

        const hitCountAnchor = domainLi.querySelector('.fire-extra-se-results a') as HTMLElement;

        expect(hitCountAnchor.innerHTML).to.be.equal('SE search');
        // expect(hitCountAnchor.innerHTML).to.be.equal('SE: 10.5k');
        // expect(hitCountAnchor.getAttribute('fire-tooltip')).to.be.equal('10.5k hits on SE');
    });
});
