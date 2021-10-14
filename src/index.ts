import { getPendingPrElement } from './github.js';
import { getAllDomainsFromPost } from './metasmoke.js';
import { getSeSearchResultsForDomain } from './stackexchange.js';
import { Domains, DomainStats } from './domain_stats.js';
import {
    ChatObject,
    ChatParsedEvent,
    addActionListener,
    newChatEventOccurred
} from './chat.js';
import {
    getWatchBlacklistButtons,
    getResultsContainer,
    getInfoContainer,
    getTick,
    getCross,
    createTag
} from './dom_utils.js';

export interface Toastr {
    success(message: string): void;
    error(message: string): void;
}

declare const CHAT: ChatObject;
declare const toastr: Toastr;
declare const fire: {
    reportCache: {
        [key: string]: { id: number; }
    }
};

const metasmokeSearchUrl = 'https://metasmoke.erwaysoftware.com/search';

// export in an object for the tests
export const helpers = {
    // should be the same as "See the MS search here" text in PRs
    getMetasmokeSearchUrl: (domain: string): string => {
        const bodyParam = `(?s:\\b${domain}\\b)`;
        const parameters = `?utf8=✓&body_is_regex=1&body=${bodyParam}`;
        const fullUrl = metasmokeSearchUrl + parameters;

        return encodeURI(fullUrl);
    },

    // Follow https://charcoal-se.org/smokey/Guidance-for-Blacklisting-and-Watching:

    qualifiesForWatch: ([tpCount, fpCount, naaCount]: number[], seHits: string): boolean => {
        return tpCount >= 1 // tp count between 1
            && tpCount < 5 // and 5
            && fpCount + naaCount === 0 // no FPs/NAAs
            && Number(seHits) < 10; // less than 10 results in SE search
    },

    qualifiesForBlacklist: ([tpCount, fpCount, naaCount]: number[], seHits: string): boolean => {
        // assume the post is <=6 months old
        return tpCount >= 5 // "The site has at least five hits in metasmoke,
            && fpCount + naaCount === 0 // with no false positives"
            && Number(seHits) < 5; // not explicitly mentioned, but thought it's a good limit
    },

    // given a regexes array and a domain, find if the latter is matched by any items in the former
    isCaught: (regexes: RegExp[], domain: string): boolean => regexes.some(regex => regex.test(domain)),

    // get the id the domain li has - dots are replaced with dash
    getDomainId: (domainName: string): string => `fire-extra-${domainName.replace(/\./g, '-')}`,

    // helper to pluralise strings
    pluralise: (word: string, count: number): string => `${word}${count === 1 ? '' : 's'}`,

    // the tooltip text of 👀 or 🚫
    getActionDone: (action: 'watched' | 'blacklisted', isDone: boolean): string => {
        const yesNo = isDone ? 'yes' : 'no';

        return `${action}: ${yesNo}`;
    },

    // the tooltip text of !!/watch, !!/blacklist buttons
    getButtonsText: (action: 'watch' | 'blacklist', domain: string, done: boolean): string => {
        const command = action === 'watch' ? '!!/watch-' : '!!/blacklist-website-';
        const alreadyDone = 'action already taken';

        return done
            ? alreadyDone
            : `${command} ${domain}`;
    }
};

function updateDomainInformation(domainName: string): void {
    const {
        stackexchange: seResultCount,
        metasmoke: metasmokeStats
    } = Domains.allDomainInformation[domainName];

    if (!seResultCount || !metasmokeStats?.length) return;

    const isWatched = helpers.isCaught(Domains.watchedWebsites, domainName);
    const isBlacklisted = helpers.isCaught(Domains.blacklistedWebsites, domainName);
    const escapedDomain = domainName.replace(/\./g, '\\.'); // escape dots

    const qualifiesForWatch = helpers.qualifiesForWatch(metasmokeStats, seResultCount);
    const qualifiesForBlacklist = helpers.qualifiesForBlacklist(metasmokeStats, seResultCount);

    const watch = {
        human: helpers.getActionDone('watched', isWatched),
        tooltip: helpers.getButtonsText('watch', escapedDomain, isWatched || isBlacklisted),
        suggested: qualifiesForWatch && !isWatched && !isBlacklisted,
        // note the button should be disabled if the domain is blacklisted
        class: `fire-extra-${isWatched || isBlacklisted ? 'disabled' : 'watch'}`
    };

    const blacklist = {
        human: helpers.getActionDone('blacklisted', isBlacklisted),
        tooltip: helpers.getButtonsText('blacklist', escapedDomain, isBlacklisted),
        suggested: qualifiesForBlacklist && !isBlacklisted,
        class: `fire-extra-${isBlacklisted ? 'disabled' : 'blacklist'}`
    };

    const domainId = helpers.getDomainId(domainName);
    const domainLi = document.getElementById(domainId);

    const watchButton = domainLi?.querySelector('.fire-extra-watch');
    const blacklistButton = domainLi?.querySelector('.fire-extra-blacklist');
    const watchInfo = domainLi?.querySelector('.fire-extra-watch-info');
    const blacklistInfo = domainLi?.querySelector('.fire-extra-blacklist-info');

    // append the tick or the cross (indicate if domain should be watched/blacklisted or not)
    if (!watchInfo || !blacklistInfo) return;

    // add the tooltip to the emojis, e.g. watched: yes, blacklisted: no
    watchInfo.setAttribute('fire-tooltip', watch.human);
    blacklistInfo.setAttribute('fire-tooltip', blacklist.human);

    watchInfo.replaceChildren('👀: ', isWatched ? getTick() : getCross());
    blacklistInfo.replaceChildren('🚫: ', isBlacklisted ? getTick() : getCross());

    // the buttons do not exist if a PR is pending
    if (!watchButton || !blacklistButton) return;

    // add ticks if the domain should be watch/blacklisted
    if (watch.suggested) watchButton.append(' ', getTick());
    if (blacklist.suggested) blacklistButton.append(' ', getTick());

    // disable buttons if necessary
    watchButton.classList.add(watch.class);
    blacklistButton.classList.add(blacklist.class);

    // add the tooltips (either !!/<action> example\.com or domain already <action>)
    watchButton.setAttribute('fire-tooltip', watch.tooltip);
    blacklistButton.setAttribute('fire-tooltip', blacklist.tooltip);
}

function updateStackSearchResultCount(domainName: string): void {
    getSeSearchResultsForDomain(domainName).then(hitCount => {
        const domainId = helpers.getDomainId(domainName);
        const domainElementLi = document.getElementById(domainId);
        if (!domainElementLi) return; // in case the popup is closed before the request is finished

        Domains.allDomainInformation[domainName].stackexchange = hitCount;
        const seHitCountElement = domainElementLi.querySelector('.fire-extra-se-results a');
        if (!seHitCountElement) return;

        const tooltipText = `${hitCount} ${helpers.pluralise('hit', Number(hitCount))} on SE`;
        seHitCountElement.innerHTML = `SE: ${hitCount}`;
        seHitCountElement.setAttribute('fire-tooltip', tooltipText);
        updateDomainInformation(domainName);
    }).catch(error => {
        toastr.error(error);
        console.error(error);
    });
}

async function addHtmlToFirePopup(): Promise<void> {
    const reportedPostDiv = document.querySelector('.fire-reported-post');
    const fireMsButton = document.querySelector<HTMLAnchorElement>('.fire-metasmoke-button');
    const nativeSeLink = [...new URL(fireMsButton?.href || '').searchParams][0][1];

    // take advantage of FIRE's cache :)
    const metasmokePostId = fire.reportCache[nativeSeLink].id;
    const domains = await getAllDomainsFromPost(metasmokePostId);

    if (!domains.length) return; // no domains; nothing to do

    const divider = document.createElement('hr');
    const dataWrapperElement = document.createElement('div');
    dataWrapperElement.classList.add('fire-extra-functionality');

    const header = document.createElement('h3');
    header.innerText = 'Domains';
    dataWrapperElement.append(header);

    reportedPostDiv?.insertAdjacentElement('afterend', dataWrapperElement);
    reportedPostDiv?.insertAdjacentElement('afterend', divider);

    const domainList = document.createElement('ul');
    domainList.classList.add('fire-extra-domains-list');

    // exclude whitelisted domains, redirectors and domains that have a pending PR
    const domainIdsValid = domains.filter(
        domainObject => !Domains.whitelistedDomains.includes(domainObject.domain)
                     && !Domains.redirectors.includes(domainObject.domain)
    ).map(item => item.id);

    Domains.triggerDomainUpdate(domainIdsValid)
        .then(domainNames => domainNames.forEach(name => updateDomainInformation(name)))
        .catch(error => toastr.error(error));

    domains.map(item => item.domain).forEach(domainName => {
        Domains.allDomainInformation[domainName] = {} as DomainStats[''];

        const domainItem = document.createElement('li');
        domainItem.innerHTML = domainName + '&nbsp;';
        domainItem.id = helpers.getDomainId(domainName);
        domainList.append(domainItem);

        // TODO also address #ip and #stuff-up
        //      Stack Exchange URLs https://metasmoke.erwaysoftware.com/domains/groups/14
        // TODO address redirectors/YT videos (watch the video URL, etc.)

        // If the domain is whitelisted or a redirector, don't search for TPs/FPs/NAAs.
        // They often have too many hits on SE/MS, and they make the script slower
        if (Domains.whitelistedDomains.includes(domainName)) {
            domainItem.append(createTag('whitelisted'));
            return;
        } else if (Domains.redirectors.includes(domainName)) {
            domainItem.append(createTag('redirector'));
            return;
        }

        const pullRequests = Domains.githubPullRequests;
        const githubPrOpenItem = pullRequests.find(({ regex }) => regex.test(domainName));
        const escapedDomain = domainName.replace(/\./g, '\\.'); // escape dots

        /* Create the HTML for the domain li */
        // Let's split it into 4 parts:
        // - The domain text
        // - The results: (MS: 10, 3, 2 | SE: 10)
        // - The actions area: !!/watch !!/blacklist
        //                 or: PR#3948 pending !!/approve
        // - The information area: (👀: ✗/🚫: ✓)

        const buttonContainer = getWatchBlacklistButtons();
        const actionsArea = githubPrOpenItem
            ? getPendingPrElement(githubPrOpenItem) // PR pending
            : buttonContainer;

        const resultsContainer = getResultsContainer(escapedDomain, domainName);
        const infoContainer = getInfoContainer();

        domainItem.append(resultsContainer, actionsArea, infoContainer);

        updateStackSearchResultCount(domainName);

        const watchButton = domainItem.querySelector<HTMLElement>('.fire-extra-watch');
        const blacklistButton = domainItem.querySelector<HTMLElement>('.fire-extra-blacklist');

        addActionListener(watchButton);
        addActionListener(blacklistButton);
        if (githubPrOpenItem) {
            const approveButton = domainItem.querySelector<HTMLElement>('.fire-extra-approve');
            addActionListener(approveButton);
        }
    });

    dataWrapperElement.append(domainList);
}

void (async function(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
    await Domains.fetchAllDomainInformation();

    CHAT.addEventHandlerHook(event => {
        const eventToPass = Object.assign({
            ...event,
            // because we can't use DOMParser with tests,
            // newChatEventOccurred has to accept a Document argument for content
            content: new DOMParser().parseFromString(event.content, 'text/html')
        }) as ChatParsedEvent;
        newChatEventOccurred(eventToPass);
    });

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            const firePopupAppeared = ([...mutation.addedNodes] as Element[])
                .some(element => element?.classList?.contains('fire-popup'));
            if (!firePopupAppeared) return;

            void addHtmlToFirePopup();
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    GM_addStyle(`
.fire-extra-domains-list {
  padding: 5px !important;
  margin-left: 12px;
}

.fire-extra-domains-list div {
    display: inline;
}

.fire-extra-tp, .fire-extra-green {
    color: #3c763d;
}

.fire-extra-fp, .fire-extra-red {
    color: #a94442;
}

.fire-extra-naa {
    color: #8a6d3b;
}

.fire-extra-blacklist, .fire-extra-watch, .fire-extra-approve {
    cursor: pointer;
    margin-right: 7px;
}

.fire-popup {
    width: 700px !important;
}

.fire-extra-none {
    display: none;
}

.fire-extra-wait {
    padding-bottom: 5px;
}

/* copied from the MS CSS for domain tags */
.fire-extra-tag {
  background-color: #5bc0de;
  padding: .2em .6em .3em;
  font-size: 75%;
  font-weight: 700;
  color: #fff;
  border-radius: .25em;
}

.fire-extra-disabled {
  color: currentColor;
  opacity: 0.8;
}`);
})();