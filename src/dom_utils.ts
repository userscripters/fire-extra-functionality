import { seSearchPage } from './stackexchange.js';
import { helpers } from './index.js';

interface Feedbacks {
    count: number,
    type: 'tp' | 'fp' | 'naa'
}

export function getWaitGif(): HTMLImageElement {
    const waitGif = document.createElement('img');
    waitGif.classList.add('fire-extra-wait');
    waitGif.src = '/content/img/progress-dots.gif';

    return waitGif;
}

export function getTick(): HTMLSpanElement {
    const greenTick = document.createElement('span');
    greenTick.classList.add('fire-extra-green');
    greenTick.innerText = '✓';

    return greenTick;
}

export function getCross(): HTMLSpanElement {
    const redCross = document.createElement('span');
    redCross.classList.add('fire-extra-red');
    redCross.innerText = '✗';

    return redCross;
}

export function getWatchBlacklistButtons(): HTMLDivElement {
    const container = document.createElement('div');

    const watchButton = document.createElement('a');
    watchButton.classList.add('fire-extra-watch');
    watchButton.innerText = '!!/watch';

    const blacklistButton = document.createElement('a');
    blacklistButton.classList.add('fire-extra-blacklist');
    blacklistButton.innerText = '!!/blacklist';

    container.append(watchButton, blacklistButton);

    return container;
}

function getMsResultsElement(escapedDomain: string): HTMLDivElement {
    const container = document.createElement('div');

    const anchor = document.createElement('a');
    anchor.href = helpers.getMetasmokeSearchUrl(escapedDomain);
    anchor.innerText = 'MS';

    const stats = document.createElement('span');
    stats.classList.add('fire-extra-ms-stats');
    stats.append(getWaitGif());

    container.append(anchor, ': ', stats);

    return container;
}

function getSeResultsSpan(domainName: string): HTMLSpanElement {
    const seResults = document.createElement('span');
    seResults.classList.add('fire-extra-se-results');

    const seResultsLink = document.createElement('a');
    seResultsLink.href = seSearchPage + domainName;
    seResultsLink.append(getWaitGif());
    seResults.append(seResultsLink);

    return seResults;
}

export function getResultsContainer(escapedDomain: string, domainName: string): HTMLDivElement {
    const container = document.createElement('div');
    container.style.marginRight = '7px';

    const metasmokeResults = getMsResultsElement(escapedDomain);
    const stackResults = getSeResultsSpan(domainName);

    container.append('(', metasmokeResults, ' | ', stackResults, ')');

    return container;
}

export function getInfoContainer(): HTMLDivElement {
    const container = document.createElement('div');

    const watchInfo = document.createElement('span');
    watchInfo.classList.add('fire-extra-watch-info');
    watchInfo.append('👀: ', getWaitGif());

    const blacklistInfo = document.createElement('span');
    blacklistInfo.classList.add('fire-extra-blacklist-info');
    blacklistInfo.append('🚫: ', getWaitGif());

    container.append('(', watchInfo, '/', blacklistInfo, ')');

    return container;
}

export function createTag(tagName: string): HTMLSpanElement {
    const tag = document.createElement('span');
    tag.innerText = `#${tagName}`;
    tag.classList.add('fire-extra-tag');

    return tag;
}

// Gets a coloured TP/FP/NAA span.
function getColouredSpan(feedbackCount: number, feedback: 'tp' | 'fp' | 'naa'): HTMLSpanElement {
    const feedbackType = helpers.pluralise(feedback.toUpperCase(), feedbackCount);
    const tooltipText = `${feedbackCount} ${feedbackType}`;

    const span = document.createElement('span');
    span.classList.add(`fire-extra-${feedback}`);
    span.setAttribute('fire-tooltip', tooltipText);
    span.innerText = feedbackCount.toString();

    return span;
}

export function getColouredSpans([tpCount, fpCount, naaCount]: number[]): Array<HTMLSpanElement | string> {
    // {} are replaced with commas, so the feedbacks are not cramped up
    const feedbacks = [
        {
            count: tpCount,
            type: 'tp'
        },
        {},
        {
            count: fpCount,
            type: 'fp'
        },
        {},
        {
            count: naaCount,
            type: 'naa'
        }
    ] as Feedbacks[];

    return feedbacks.map(({ count, type }) => type ? getColouredSpan(count, type) : ', ');
}
