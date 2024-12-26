import { GithubApiInformation } from './github';
import { getAllDomainsFromPost, getMsSearchResults } from './metasmoke';
// import { getSeSearchResults } from './stackexchange';
import { Domains, DomainStats } from './domain_stats';
import {
    ChatObject,
    ChatParsedEvent,
    addListener,
    newChatEventOccurred
} from './chat';
import {
    getWatchBlacklistButtons,
    getResultsContainer,
    getInfoContainer,
    getTick,
    getCross,
    getTag,
    getPendingPrElement,
    updateSeCount,
    updateMsCounts,
    triggerDomainUpdate
} from './dom_utils';

export interface Toastr {
    success: (message: string) => void;
    error: (message: string) => void;
}

declare const CHAT: ChatObject;
declare const toastr: Toastr;
declare const fire: {
    reportCache: Record<string, {
        id: number;
    }>;
};

const metasmokeSearchUrl = 'https://metasmoke.erwaysoftware.com/search';

// export in an object for the tests
export const helpers = {
    generateSearchRegex: (text: string): string => {
        // https://chat.stackexchange.com/transcript/message/55327802
        // (slightly modified to improve readability)

        let searchTerm = `(?s)(?:^|\\b)${text}(?:\\b|$)`;
        const textNoNoncaptureGroups = text
            .replace(/\(\?:/g, '(')
            .replace(/\(\?-i:([^()]+)\)/, '$1');

        const regex = /^(\w+(?![?*+{])|\(\?-i:[^+?*{}()|]+\)\w*(?![?*+{]))/;

        if (!/[+?*{}()|]/.test(textNoNoncaptureGroups)) {
            searchTerm = `(?s)${text}(?<=(?:^|\\b)${text})(?:\\b|$)`;
        } else if (regex.test(text)) {
            const replaced = text.replace(
                regex,
                '$1(?<=(?:^|\\b)$1)'
            );

            searchTerm = `(?s)${replaced}(?:\\b|$)`;
        }

        return searchTerm;
    },

    // should be the same as "See the MS search here" text in PRs
    getMetasmokeSearchUrl: (term: string): string => {
        const text = term.includes('.') // it's a domain
            ? term
            : helpers.getRegexForPathShortener(term);

        const unescaped = term.replace(/\\./g, '.');
        const searchTerm = helpers.isBlacklisted(unescaped)
            ? `(?i)${text}`
            : helpers.generateSearchRegex(text);

        const url = new URL(metasmokeSearchUrl);
        url.searchParams.set('utf8', '✓');
        // use OR instead of default AND
        url.searchParams.set('or_search', '1');

        url.searchParams.set('title_is_regex', '1');
        url.searchParams.set('body_is_regex', '1');
        url.searchParams.set('username_is_regex', '1');

        url.searchParams.set('title', searchTerm);
        url.searchParams.set('body', searchTerm);
        url.searchParams.set('username', searchTerm);

        return url.toString();
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

    // find if given string exists in the watchlist/blacklist
    // returns the last regex from that list which matches that string
    isCaught: (type: 'watch' | 'blacklist', domain: string): RegExp | undefined => {
        const regexes = Domains[`${type}ed`];

        return regexes.findLast(regex => regex.test(domain));
    },

    isWatched: (domain: string): RegExp | undefined => helpers.isCaught('watch', domain),

    isBlacklisted: (domain: string): boolean => Boolean(helpers.isCaught('blacklist', domain)),

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
    getButtonsText: (
        action: 'watch' | 'blacklist',
        term: string,
        done: boolean,
        domain?: string,
        regex?: RegExp
    ): string => {
        const command = action === 'watch' ? '!!/watch-' : '!!/blacklist-website-';
        const alreadyDone = 'action already taken';

        const watchValue = domain
            ? helpers.getRegexForPathShortener(term, domain)
            : term
                    // https://metasmoke.erwaysoftware.com/domains/groups/17
                    .replace(/blogspot\.\w+(\.\w+)?$/, 'blogspot') // abc.blogspot.com => abc.blogspot
                    .replace(/\./g, '\\.'); // escape dots

        const replacement = regex?.source.slice(2, -2)
            // fire-tooltip content is parsed as HTML
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');

        return done
            ? alreadyDone
            : `${command} ${action === 'blacklist' && regex ? replacement : watchValue}`;
    },

    // (?-i:) - case sensitive
    // (?#)   - the shortener domain
    getRegexForPathShortener: (path: string, domain?: string): string => {
        // https://stackoverflow.com/a/3561711
        // https://chat.stackexchange.com/transcript/message/65665204
        const escaped = path.replace(/[+\\^$*?.()|[\]{}]/g, '\\$&');
        const mainPart = `(?-i:${escaped})`;
        const comment = `(?#${domain || ''})`;

        return `${mainPart}${domain ? comment : ''}`;
    }
};

function updateEmojisInformation(term: string): void {
    if (!Domains.allDomainInformation[term]) return;

    const {
        stackexchange: seResultCount,
        metasmoke: metasmokeStats = []
    } = Domains.allDomainInformation[term];

    const domainId = helpers.getDomainId(term);
    const domainLi = document.getElementById(domainId);
    const domainName = term.includes('.') // is a domain
        ? ''
        : domainLi?.parentElement?.parentElement?.firstChild?.textContent as string;

    if (!seResultCount || !metasmokeStats.length) return;

    const isWatched = helpers.isWatched(term);
    const isBlacklisted = helpers.isBlacklisted(term);

    const qualifiesForWatch = helpers.qualifiesForWatch(metasmokeStats, seResultCount);
    const qualifiesForBlacklist = helpers.qualifiesForBlacklist(metasmokeStats, seResultCount);

    const watch = {
        human: helpers.getActionDone('watched', Boolean(isWatched)),
        tooltip: helpers.getButtonsText('watch', term, Boolean(isWatched) || isBlacklisted, domainName),
        suggested: qualifiesForWatch && !isWatched && !isBlacklisted,
    };

    const blacklist = {
        human: helpers.getActionDone('blacklisted', isBlacklisted),
        tooltip: helpers.getButtonsText('blacklist', term, isBlacklisted, domainName, isWatched),
        suggested: qualifiesForBlacklist && !isBlacklisted,
    };

    const watchInfo = domainLi?.querySelector('.fire-extra-watch-info');
    const blacklistInfo = domainLi?.querySelector('.fire-extra-blacklist-info');

    if (!watchInfo || !blacklistInfo) return;

    // add the tooltip to the emojis, e.g. watched: yes, blacklisted: no
    watchInfo.setAttribute('fire-tooltip', watch.human);
    blacklistInfo.setAttribute('fire-tooltip', blacklist.human);

    // append the tick or the cross (indicate if domain should be watched/blacklisted or not)
    watchInfo.replaceChildren('👀: ', isWatched ? getTick() : getCross());
    blacklistInfo.replaceChildren('🚫: ', isBlacklisted ? getTick() : getCross());

    const watchButton = domainLi?.querySelector<HTMLElement>('.fire-extra-watch');
    const blacklistButton = domainLi?.querySelector<HTMLElement>('.fire-extra-blacklist');

    // the buttons do not exist if a PR is pending
    if (!watchButton || !blacklistButton) return;

    // add ticks if the domain should be watch/blacklisted
    if (watch.suggested) watchButton.append(' ', getTick());
    if (blacklist.suggested) blacklistButton.append(' ', getTick());

    // show buttons if action has not been taken
    if (!isBlacklisted) {
        blacklistButton.style.display = 'inline';

        if (!isWatched) {
            watchButton.style.display = 'inline';
        }
    }

    // add the tooltips (either !!/<action> example\.com or domain already <action>)
    watchButton.setAttribute('fire-tooltip', watch.tooltip);
    blacklistButton.setAttribute('fire-tooltip', blacklist.tooltip);
}

function updateStackSearchResultCount(term: string, domainLi: Element): void {
    // temp disabled, because it logs users out
    // getSeSearchResults(term)
    new Promise<string>(resolve => resolve('0')).then(hitCount => {
        if (!Domains.allDomainInformation[term]) return;

        // update the info object
        Domains.allDomainInformation[term].stackexchange = hitCount;
        updateSeCount(hitCount, domainLi);

        updateEmojisInformation(term);
    }).catch((error: unknown) => {
        toastr.error(error as string);
        console.error(error);
    });
}

// only for paths of URL shorteners, where MS search should be used
// https://chat.stackexchange.com/transcript/11540?m=59383818
function updateMsResults(term: string, domainLi: Element): void {
    getMsSearchResults(term)
        .then(results => {
            if (!Domains.allDomainInformation[term]) return;

            // update the info object
            Domains.allDomainInformation[term].metasmoke = results;
            updateMsCounts(results, domainLi);

            updateEmojisInformation(term);
        })
        .catch((error: unknown) => {
            toastr.error(error as string);
            console.error(error);
        });
}

function addChatListeners(domainItem: Element, githubPr?: GithubApiInformation): void {
    const watchButton = domainItem.querySelector('.fire-extra-watch');
    const blacklistButton = domainItem.querySelector('.fire-extra-blacklist');

    addListener(watchButton);
    addListener(blacklistButton);
    if (githubPr) {
        const approveButton = domainItem.querySelector('.fire-extra-approve');
        addListener(approveButton);
    }
}

function createHTMLForGivenList(domainName: string, domainItem: Element): void {
    const pullRequests = Domains.pullRequests;
    // TODO handle redirectors
    const githubPrOpenItem = pullRequests.find(({ regex }) => regex.test(domainName));

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

    const resultsContainer = getResultsContainer(domainName);
    const infoContainer = getInfoContainer();

    // insert those 4 parts
    domainItem.append(resultsContainer, actionsArea, infoContainer);

    updateStackSearchResultCount(domainName, domainItem);
    addChatListeners(domainItem, githubPrOpenItem); // !!/watch, etc. buttons' listeners
}

function createDomainHtml(name: string, list: Element, child = false): void {
    Domains.allDomainInformation[name] = {} as DomainStats[''];

    const elementType = child ? 'ul' : 'li';
    const domainItem = document.createElement(elementType);
    domainItem.id = helpers.getDomainId(name) + (child ? '-children' : '');

    if (child) {
        domainItem.style.marginLeft = '15px';

        const pathnames = [...document.querySelectorAll<HTMLAnchorElement>('.fire-reported-post a')]
            .map(anchor => new URL(anchor.href)) // create a URL object from each href
            .filter(url => url.host === name) // just shorteners
            .map(url => url.pathname.replace('/', '')); // remove trailing /
        const uniquePathnames = [...new Set(pathnames)]; // there might be duplicates

        // https://github.com/userscripters/fire-extra-functionality/issues/166
        // e.g. https://chat.stackexchange.com/transcript/message/66151288
        if (!uniquePathnames.every(Boolean)) return;

        uniquePathnames.forEach(pathname => createDomainHtml(pathname, domainItem));
        list.append(domainItem);

        return;
    } else if (!name.includes('.')) { // path of URL shortener
        // the path of a URL shortener doesn't belong to the post domains
        // as those fetched from the API, so we have to trigger a request manually:
        updateMsResults(name, domainItem);
        domainItem.append(name, ' ');
    } else {
        domainItem.append(name, ' ');
    }

    list.append(domainItem);

    // TODO also address #ip (?? can be watched ??) and #stuff-up
    //      Stack Exchange URLs https://metasmoke.erwaysoftware.com/domains/groups/14 (??)

    // If the domain is whitelisted or a redirector, don't search for TPs/FPs/NAAs.
    // They often have too many hits on SE/MS, and they make the script slower
    if (Domains.whitelisted.includes(name)) {
        domainItem.append(getTag('whitelisted'));
        return;
    } else if (Domains.redirectors.includes(name)) {
        domainItem.append(getTag('shortener'));
        createDomainHtml(name, domainItem, true);

        return;
    }

    createHTMLForGivenList(name, domainItem);
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
        domainObject => !Domains.whitelisted.includes(domainObject.domain)
                     && !Domains.redirectors.includes(domainObject.domain)
    ).map(item => item.id);

    triggerDomainUpdate(domainIdsValid)
        .then(domainNames => domainNames.forEach(name => updateEmojisInformation(name)))
        .catch((error: unknown) => toastr.error(error as string));

    domains
        .map(item => item.domain)
        .forEach(domain => createDomainHtml(domain, domainList));

    dataWrapperElement.append(domainList);
}

void (async function(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!globalThis.window) return; // for tests

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

    window.addEventListener('fire-popup-open', () => {
        void addHtmlToFirePopup();
    });

    GM_addStyle(`
.fire-extra-domains-list {
  padding: 5px !important;
  margin-left: 12px;
}

.fire-extra-domains-list li + li {
    margin-top: 4px;
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

.fire-extra-none {
    display: none;
}

.fire-extra-wait {
    padding-bottom: 5px;
}

/* copied from the MS CSS for domain tags */
.fire-extra-tag {
  background-color: #5bc0de;
  padding: .2em .6em;
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
