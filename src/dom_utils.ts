import { getSeUrl } from './stackexchange.js';
import { helpers } from './index.js';
import { GithubApiInformation, sdGithubRepo } from './github.js';
import { Domains } from './domain_stats.js';

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
    greenTick.innerHTML = '✓';

    return greenTick;
}

export function getCross(): HTMLSpanElement {
    const redCross = document.createElement('span');
    redCross.classList.add('fire-extra-red');
    redCross.innerHTML = '✗';

    return redCross;
}

export function getWatchBlacklistButtons(): HTMLDivElement {
    const container = document.createElement('div');

    const watchButton = document.createElement('a');
    watchButton.classList.add('fire-extra-watch');
    watchButton.innerHTML = '!!/watch';

    const blacklistButton = document.createElement('a');
    blacklistButton.classList.add('fire-extra-blacklist');
    blacklistButton.innerHTML = '!!/blacklist';

    container.append(watchButton, blacklistButton);

    return container;
}

function getMsResultsElement(escapedDomain: string): HTMLDivElement {
    const container = document.createElement('div');

    const anchor = document.createElement('a');
    anchor.href = helpers.getMetasmokeSearchUrl(escapedDomain);
    anchor.innerHTML = 'MS';

    const stats = document.createElement('span');
    stats.classList.add('fire-extra-ms-stats');
    stats.append(getWaitGif());

    container.append(anchor, ': ', stats);

    return container;
}

function getSeResultsSpan(searchTerm: string): HTMLSpanElement {
    const seResults = document.createElement('span');
    seResults.classList.add('fire-extra-se-results');

    const seResultsLink = document.createElement('a');
    seResultsLink.href = getSeUrl(searchTerm);
    seResultsLink.append(getWaitGif());
    seResults.append(seResultsLink);

    return seResults;
}

export function getResultsContainer(term: string): HTMLElement {
    const escaped = term.replace(/\./g, '\\.');

    const container = document.createElement('div');
    container.style.marginRight = '7px';

    const metasmokeResults = getMsResultsElement(escaped);
    const stackResults = getSeResultsSpan(term);

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
    tag.innerHTML = `#${tagName}`;
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
    span.innerHTML = feedbackCount.toString();

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

const getGithubPrUrl = (prId: number): string => `//github.com/${sdGithubRepo}/pull/${prId}`;
const getPrTooltip = ({ id, regex, author, type }: GithubApiInformation): string =>
    `${author} wants to ${type} ${regex.source} in PR#${id}`;

export function getPendingPrElement(githubPrOpenItem: GithubApiInformation): HTMLDivElement {
    const prId = githubPrOpenItem.id;

    const container = document.createElement('div');

    const anchor = document.createElement('a');
    anchor.href = getGithubPrUrl(prId);
    anchor.innerHTML = `PR#${prId}`;
    anchor.setAttribute('fire-tooltip', getPrTooltip(githubPrOpenItem));

    const approve = document.createElement('a');
    approve.classList.add('fire-extra-approve');
    approve.innerHTML = '!!/approve';
    approve.setAttribute('fire-tooltip', `!!/approve ${prId}`);

    container.append(anchor, ' pending ', approve);

    return container;
}

export function updateSeCount(count: string, domainLi: Element): void {
    if (!domainLi) return; // in case the popup is closed before the request is finished

    const hitCountAnchor = domainLi.querySelector('.fire-extra-se-results a');
    if (!hitCountAnchor) return;

    const tooltipText = `${count} ${helpers.pluralise('hit', Number(count))} on SE`;
    hitCountAnchor.innerHTML = `SE: ${count}`;
    hitCountAnchor.setAttribute('fire-tooltip', tooltipText);
}

export function updateMsCounts(counts: number[], domainLi: Element): void {
    const msStats = domainLi?.querySelector('.fire-extra-ms-stats');
    if (!msStats) return;

    msStats.replaceChildren(...getColouredSpans(counts));
}

// Update MS stats both in allDomainInformation and in the DOM
export async function triggerDomainUpdate(domainIdsValid: number[]): Promise<string[]> {
    const domainStats = await Domains.getTpFpNaaCountFromDomains(domainIdsValid) || {};

    return Object
        .entries(domainStats)
        .flatMap(([domainName, feedbackCount]) => {
            const domainId = helpers.getDomainId(domainName);
            const domainLi = document.getElementById(domainId);
            if (!domainLi) return []; // in case the popup is closed before the process is complete

            updateMsCounts(feedbackCount, domainLi);
            Domains.allDomainInformation[domainName].metasmoke = feedbackCount;

            return [domainName];
        });
}
