declare const CHAT: ChatObject;
declare const toastr: {
    success(message: string): void;
    error(message: string): void;
};
declare const fire: {
    reportCache: {
        [key: string]: { id: number; }
    }
};

type MessageActions = 'watch' | 'blacklist' | 'approve';

interface ChatObject {
    addEventHandlerHook(callback: (eventInfo: ChatEvent) => void): void;
}

interface ChatEvent {
    event_type: number;
    user_id: number;
    content: string;
}

interface GithubApiResponse {
    number: number;
    title: string;
    state: 'open' | 'closed';
    user: {
        id: number;
    }
}

interface GithubApiInformation {
    id: number;
    regex: RegExp;
    author: string;
    type: 'watch' | 'blacklist';
}

interface GraphQLPostFeedbackCount {
    is_tp: boolean;
    is_fp: boolean;
    is_naa: boolean;
}

interface GraphQLSpamDomains {
    id: string;
    domain: string;
    posts: GraphQLPostFeedbackCount[];
}

interface GraphQLErrorInformation {
    message: string;
    locations: ({
        line: number;
        column: number;
    })[];
}

type GraphQLResponse = {
    data: {
        spam_domains: GraphQLSpamDomains[];
    }
} | {
    errors: GraphQLErrorInformation[];
}

interface DomainsForPostIdItems {
    id: number;
    domain: string;
}

interface DomainsForPostIdResponse {
    items: DomainsForPostIdItems[];
    has_more: boolean;
}

interface ChatResponse {
    id: number | null;
    time: number | null;
}

interface DomainStats {
    [key: string]: {
        metasmoke: number[]; // the tp, fp and naa count respectively
        stackexchange: string;
    }
}

interface MetasmokeDomainStats {
    [key: string]: number[];
}

void (async function () {
    const domParser = new DOMParser();
    const metasmokeSearchUrl = 'https://metasmoke.erwaysoftware.com/search';
    const metasmokeApiBase = 'https://metasmoke.erwaysoftware.com/api/v2.0/posts/';
    const metasmokeApiKey = '36d7b497b16d54e23641d0f698a2d7aab7d92777ef3108583b5bd7d9ddcd0a18';
    const postDomainsApiFilter = 'HGGGFLHIHKIHOOH';
    const seSearchPage = 'https://stackexchange.com/search?q=url%3A';
    const currentRoomId = Number((/\/rooms\/(\d+)\//.exec(window.location.pathname))?.[1]);
    // Copied from FIRE
    const smokeDetectorId = { 'chat.stackexchange.com': 120914, 'chat.stackoverflow.com': 3735529, 'chat.meta.stackexchange.com': 266345 }[location.host];
    const metasmokeId = { 'chat.stackexchange.com': 478536, 'chat.stackoverflow.com': 14262788, 'chat.meta.stackexchange.com': 848503 }[location.host];
    const smokeDetectorGithubId = 11063859;
    const smokeDetectorGithubRepo = 'Charcoal-SE/SmokeDetector';
    const githubPrApiUrl = `https://api.github.com/repos/${smokeDetectorGithubRepo}/pulls`;
    const waitGifHtml = '<img class="fire-extra-wait" src="/content/img/progress-dots.gif">';
    const greenTick = '<span class="fire-extra-green"> ✓</span>', redCross = '<span class="fire-extra-red"> ✗</span>';
    const allDomainInformation: DomainStats = {}; // contains both the SE hit count and the MS feedbacks

    // Thanks tripleee! https://github.com/Charcoal-SE/halflife/blob/ab0fa5fc2a048b9e17762ceb6e3472e4d9c65317/halflife.py#L77
    const whitelistedDomains = GM_getResourceText('whitelisted'), redirectors = GM_getResourceText('redirectors');
    // Those files are frequently updated, so they can't be in @resources
    const [watchedWebsitesCall, blacklistedWebsitesCall, githubPrsCall] = await Promise.all([
        fetch('https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/watched_keywords.txt'),
        fetch('https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/blacklisted_websites.txt'),
        fetch(githubPrApiUrl)
    ]);
    const [watchedWebsites, blacklistedWebsites, githubPrs] = await Promise.all([
        watchedWebsitesCall.text(),
        blacklistedWebsitesCall.text(),
        githubPrsCall.json() as Promise<GithubApiResponse[]>
    ]);

    // returns the number of hits given the SE search result page HTML
    const getResultCountFromParsedPage = (pageHtml: Document) => Number(pageHtml.querySelector('.results-header h2')?.textContent?.trim().replace(/,/g, '').match(/\d+/)?.[0]);
    // generate the GraphQL query string
    const getDomainPostsQuery = (idsArray: number[]) => `{
        spam_domains(ids: [${idsArray.join(',')}]) {
            id, domain, posts {
                is_tp,
                is_fp,
                is_naa
            }
        }
    }`;
    // Gets a coloured TP/FP/NAA span.
    const getColouredSpan = (feedbackCount: number, feedback: string) => `<span class="fire-extra-${feedback}" fire-tooltip=${feedback.toUpperCase()}>${feedbackCount}</span>`;
    const getColouredSpans = ([tpCount, fpCount, naaCount]: number[]) => `${getColouredSpan(tpCount, 'tp')}, ${getColouredSpan(fpCount, 'fp')}, ${getColouredSpan(naaCount, 'naa')}`;
    const getGithubPrUrl = (pullRequestId: number) => `//github.com/${smokeDetectorGithubRepo}/pull/${pullRequestId}`;
    const getPrTooltip = ({ id, regex, author, type }: GithubApiInformation) => `${author} wants to ${type} ${regex.source} in PR#${id}`; // fire-tooltip text explaining pending PRs
    const getMetasmokeSearchUrl = (domain: string) => encodeURI(`${metasmokeSearchUrl}?utf8=✓&body_is_regex=1&body=(?s:\\b${domain}\\b)`); // returns an MS search URL for a domain
    // According to https://charcoal-se.org/smokey/Guidance-for-Blacklisting-and-Watching (as much as possible at least)
    // TP count between 1 and 5, there must be no FPs.
    const qualifiesForWatch = ([tpCount, fpCount, naaCount]: number[], seHits: string) => tpCount >= 1 && tpCount < 5 && fpCount + naaCount === 0 && Number(seHits) < 10;
    // "The site has at least five hits in metasmoke, with no false positives". Assumes that the current post is <=6 months old.
    const qualifiesForBlacklist = ([tpCount, fpCount, naaCount]: number[], seHits: string) => tpCount >= 5 && fpCount + naaCount === 0 && Number(seHits) < 5;
    const isCaught = (regexesArray: RegExp[], domain: string) => regexesArray.some(regex => regex.test(domain));
    const getSeSearchErrorMessage = (status: XMLHttpRequest['status'], domain: string, statusText: XMLHttpRequest['statusText']) => `Error ${status} while trying to fetch the SE search results for ${domain}: ${statusText}.`;
    const getDomainId = (domainName: string) => 'fire-extra-' + domainName.replace(/\./g, '-'); // replace any dots with a dash for form the id
    const getPendingPrHtml = (githubPrOpenItem: GithubApiInformation) =>
        `<a href=${getGithubPrUrl(githubPrOpenItem.id)} fire-tooltip="${getPrTooltip(githubPrOpenItem)}">PR#${githubPrOpenItem.id}</a> pending`
      + `&nbsp;<a class="fire-extra-approve" fire-tooltip="!!/approve ${githubPrOpenItem.id}">!!/approve</a>&nbsp;&nbsp;`;

    function getRegexesFromTxtFile(fileContent: string, position: number) {
        return fileContent.split('\n').flatMap(line => {
            const keyword = line.split('\t')[position];
            if (!keyword) return [];
            let regexToReturn;
            try {
                regexToReturn = new RegExp(keyword);
            } catch (error) {
                return []; // regex is incompatible with the ES regex engine; nothing can be done
            }
            return [regexToReturn];
        });
    }

    function getPullRequestDataFromApi(jsonData: GithubApiResponse[]): GithubApiInformation[] {
        // only interested in open PRs by SD
        return jsonData.filter(item => item.user.id === smokeDetectorGithubId && item.state === 'open').flatMap(item => {
            // Sample PR title => username: Watch example\.com
            const { number, title } = item;
            let regex;
            try {
                regex = new RegExp(/(?:Watch|Blacklist)\s(.*)/.exec(title)?.[1] || '');
            } catch (error) {
                return [];
            }
            const authorName = (/^(.*?):/.exec(title))?.[1];
            const prType = (/^.*?:\s(Watch)\s/.exec(title)) ? 'watch' : 'blacklist';
            return [{ id: number, regex: regex, author: authorName || '', type: prType }];
        });
    }

    let watchedWebsitesRegexes = getRegexesFromTxtFile(watchedWebsites, 2);
    let blacklistedWebsitesRegexes = getRegexesFromTxtFile(blacklistedWebsites, 0);
    let githubPullRequests = getPullRequestDataFromApi(githubPrs);

    function getGraphQLInformation(query: string) {
        const payload = { 'query': query, 'variables': null };
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://metasmoke.erwaysoftware.com/api/graphql',
                data: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                onload: response => {
                    if (response.status === 200) {
                        const jsonResponse = JSON.parse(response.responseText) as GraphQLResponse;
                        // if an .errors field exists, then something went wrong
                        return 'errors' in jsonResponse ? reject(jsonResponse) : resolve(jsonResponse);
                    } else { // status is not 200 (success), probably unauthorised/not logged in?
                        reject(`Failed to get information from GraphQL with error ${response.status}. Make sure you are logged in to Metasmoke before trying again.`);
                        console.error(response);
                    }
                },
                onerror: errorResponse => reject(errorResponse.responseText)
            });
        });
    }

    function getSeSearchResultsForDomain(domain: string) {
        const requestUrl = seSearchPage + encodeURIComponent(domain);
        return new Promise<string>((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: requestUrl,
                onload: response => {
                    if (response.status !== 200) reject(getSeSearchErrorMessage(response.status, domain, response.statusText));
                    const parsedResponse = domParser.parseFromString(response.responseText, 'text/html');
                    const resultCount = Number(getResultCountFromParsedPage(parsedResponse));
                    const shortenedResultCount = resultCount > 999 ? (resultCount / 1000).toFixed(1) + 'k' : resultCount; // https://stackoverflow.com/a/9461657
                    resolve(shortenedResultCount.toString());
                },
                onerror: errorResponse => reject(getSeSearchErrorMessage(errorResponse.status, domain, errorResponse.statusText))
            });
        });
    }

    async function getAllDomainsFromPost(metasmokePostId: number) {
        const finalMsApiUrl = `${metasmokeApiBase}${metasmokePostId}/domains?key=${metasmokeApiKey}&filter=${postDomainsApiFilter}&per_page=100`;
        const apiCallResponse = await fetch(finalMsApiUrl);
        const jsonResponse = await apiCallResponse.json() as DomainsForPostIdResponse;
        return jsonResponse.items;
    }

    async function getTpFpNaaCountFromDomains(domainIds: number[]) {
        if (!domainIds.length) return;
        const graphiQL = getDomainPostsQuery(domainIds);
        const domainStats: MetasmokeDomainStats = {};
        /* domainStats contains the TP/FP/NAA count for the domain. Sample object:
           {
               'example.com': [ 5, 4, 10 ],
               'spamdomain.com': [ 5, 0, 0 ]
           }
           // The first item of the array is the tp count, the second the fp count and the third the naa count.
        */
        try {
            const results = await getGraphQLInformation(graphiQL);
            const parsedResults = JSON.parse(JSON.stringify(results)) as GraphQLResponse;
            if ('errors' in parsedResults) return;

            parsedResults.data.spam_domains.forEach(spamDomain => {
                const tpPosts = spamDomain.posts.filter(post => post.is_tp).length;
                const fpPosts = spamDomain.posts.filter(post => post.is_fp).length;
                const naaPosts = spamDomain.posts.filter(post => post.is_naa).length;
                domainStats[spamDomain.domain] = [tpPosts, fpPosts, naaPosts];
            });
        } catch (error) {
            toastr.error(error);
            console.error('Error while trying to fetch domain stats from GraphiQL.', error);
        }
        return domainStats;
    }

    async function sendActionMessageToChat(messageType: MessageActions, domainOrPrId: string | number) {
        const messageToSend = `!!/${messageType === 'blacklist' ? messageType + '-website' : messageType}- ${domainOrPrId}`
            .replace('approve-', 'approve'); // no need for approve to have a dash
        const userFkey = document.querySelector<HTMLInputElement>('input[name="fkey"]')?.value;
        toastr.error('Chat fkey not found');
        if (!userFkey) return; // fkey not found for some reason; chat message cannot be sent

        const params = new FormData();
        params.append('text', messageToSend);
        params.append('fkey', userFkey);

        const chatNewMessageCall = await fetch(`/chats/${currentRoomId}/messages/new`, {
            method: 'POST',
            body: params
        });
        if (chatNewMessageCall.status !== 200) throw new Error(`Failed to send message to chat. Returned error is ${chatNewMessageCall.status}`);

        const chatResponse = await chatNewMessageCall.json() as ChatResponse;
        // if .id or .time are null, then something went wrong
        if (!chatResponse.id || !chatResponse.time) throw new Error('Failed to send message to chat!');
    }

    function addActionListener(element: HTMLElement | null, action: MessageActions, domainOrPrId: string | number) {
        if (!element) return;
        element.addEventListener('click', async () => {
            try {
                await sendActionMessageToChat(action, domainOrPrId);
                toastr.success('Successfully sent message to chat.');
            } catch (error) {
                toastr.error(error);
                console.error('Error while sending message to chat.', error);
            }
        });
    }

    function updateDomainInformation(domainName: string) {
        const seResultCount = allDomainInformation[domainName]?.stackexchange;
        const metasmokeStats = allDomainInformation[domainName]?.metasmoke;
        if ((!seResultCount && seResultCount !== '0') || !metasmokeStats?.length) return; // the SE hits might be zero, so using !hits returns true

        const isWatched = isCaught(watchedWebsitesRegexes, domainName), isBlacklisted = isCaught(blacklistedWebsitesRegexes, domainName);
        const escapedDomain = domainName.replace(/\./, '\\.'); // escape dots
        const watch = {
                human: 'watched: ' + (isWatched ? 'yes' : 'no'),
                tooltip: isWatched || isBlacklisted ? 'domain already watched' : `!!/watch- ${escapedDomain}`,
                suggested: qualifiesForWatch(metasmokeStats, seResultCount) && !isWatched && !isBlacklisted,
                class: `fire-extra-${isWatched || isBlacklisted ? 'disabled' : 'watch'}`
            }, blacklist = {
                human: 'blacklisted: ' + (isBlacklisted ? 'yes' : 'no'),
                tooltip: isBlacklisted ? 'domain already blacklisted' : `!!/blacklist-website- ${escapedDomain}`,
                suggested: qualifiesForBlacklist(metasmokeStats, seResultCount) && !isBlacklisted,
                class: `fire-extra-${isBlacklisted ? 'disabled' : 'blacklist'}`
            };

        const domainId = getDomainId(domainName), domainElementLi = document.getElementById(domainId);
        const watchButton = domainElementLi ?.querySelector('.fire-extra-watch'), blacklistButton = domainElementLi ?.querySelector('.fire-extra-blacklist');
        const watchInfo = domainElementLi ?.querySelector('.fire-extra-watch-info'), blacklistInfo = domainElementLi ?.querySelector('.fire-extra-blacklist-info');

        // add the tooltip to the emojis, e.g. watched: yes, blacklisted: no
        watchInfo?.setAttribute('fire-tooltip', watch.human);
        blacklistInfo?.setAttribute('fire-tooltip', blacklist.human);
        // append the tick or the cross (indicated if it should be watched/blacklisted or not)
        if (!watchInfo || !blacklistInfo) return;

        watchInfo.innerHTML = '👀: ' + (isWatched ? greenTick : redCross);
        blacklistInfo.innerHTML = '🚫: ' + (isBlacklisted ? greenTick : redCross);
        if (!watchButton || !blacklistButton) return; // the buttons do not exist if a PR is pending

        // add some ticks if the domain should be watch/blacklisted
        if (watch.suggested) watchButton.insertAdjacentHTML('afterend', greenTick);
        if (blacklist.suggested) blacklistButton.insertAdjacentHTML('afterend', greenTick);
        // disable buttons if necessary
        if (!watchButton.classList.contains(watch.class)) watchButton.classList.add(watch.class);
        if (!blacklistButton.classList.contains(blacklist.class)) blacklistButton.classList.add(blacklist.class);
        // add the tooltips (either !!/<action> example\.com or domain already <action>)
        watchButton.setAttribute('fire-tooltip', watch.tooltip);
        blacklistButton.setAttribute('fire-tooltip', blacklist.tooltip);
    }

    async function addHtmlToFirePopup() {
        const reportedPostDiv = document.querySelector('.fire-reported-post');
        const fireMetasmokeButton = document.querySelector<HTMLAnchorElement>('.fire-metasmoke-button');
        const nativeSeLink = [...new URL(fireMetasmokeButton?.href || '').searchParams][0][1];
        const metasmokePostId = fire.reportCache[nativeSeLink].id; // taking advantage of FIRE's cache :)
        const domains = await getAllDomainsFromPost(metasmokePostId);
        if (!domains.length) return; // no domains; nothing to do

        const divider = document.createElement('hr');
        const dataWrapperElement = document.createElement('div');
        dataWrapperElement.classList.add('fire-extra-functionality');

        const header = document.createElement('h3');
        header.innerText = 'Domains';
        dataWrapperElement.appendChild(header);
        reportedPostDiv?.insertAdjacentElement('afterend', dataWrapperElement);
        reportedPostDiv?.insertAdjacentElement('afterend', divider);

        const domainList = document.createElement('ul');
        domainList.classList.add('fire-extra-domains-list');

        // exclude whitelisted domains, redirectors and domains that have a pending PR
        const domainIdsValid = domains.filter(domainObject => !whitelistedDomains.includes(domainObject.domain)
            && !redirectors.includes(domainObject.domain)).map(item => item.id);

        getTpFpNaaCountFromDomains(domainIdsValid).then(domainStats => {
            if (!domainStats) return;
            Object.entries(domainStats).forEach(([domainName, feedbackCount]) => {
                const domainId = getDomainId(domainName), domainElementLi = document.getElementById(domainId);
                if (!domainElementLi) return; // in case the popup is closed before the process is complete

                allDomainInformation[domainName].metasmoke = feedbackCount;
                const metasmokeStatsElement = domainElementLi.querySelector('.fire-extra-ms-stats');
                if (!metasmokeStatsElement) return;

                metasmokeStatsElement.innerHTML = getColouredSpans(feedbackCount);
                updateDomainInformation(domainName);
            });
        }).catch(error => toastr.error(error));

        domains.map(item => item.domain).forEach(domainName => {
            allDomainInformation[domainName] = {} as { metasmoke: number[]; stackexchange: string; };
            const domainItem = document.createElement('li');
            domainItem.innerHTML = domainName + '&nbsp;';
            domainItem.id = getDomainId(domainName);
            domainList.appendChild(domainItem);

            // if the domain is whitelisted or a redirector, don't search for TPs/FPs/NAAs. They often have too many hits on SE/MS, and they make the script slower
            if (whitelistedDomains.includes(domainName)) {
                domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#whitelisted</span>');
                return;
            } else if (redirectors.includes(domainName)) {
                domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#redirector</span>');
                return;
            }

            const githubPrOpenItem = githubPullRequests.find(item => item.regex.test(domainName));
            const escapedDomain = domainName.replace(/\./g, '\\.'); // escape dots
            // use a function in case githubPrOpenItem is null (then it'd throw an error because we use .id)
            const watchBlacklistButtons = '<a class="fire-extra-watch">!!/watch</a>&nbsp;&nbsp;<a class="fire-extra-blacklist">!!/blacklist</a>&nbsp;&nbsp;';
            const actionsAreaHtml = githubPrOpenItem ? getPendingPrHtml(githubPrOpenItem) : watchBlacklistButtons;

            domainItem.insertAdjacentHTML('beforeend',
                `(
           <a href="${getMetasmokeSearchUrl(escapedDomain)}">MS</a>: <span class="fire-extra-ms-stats">${waitGifHtml}</span>&nbsp;
         |&nbsp;
           <span class="fire-extra-se-results"><a href="${seSearchPage}${domainName}">${waitGifHtml}</a></span>
         )&nbsp;&nbsp;${actionsAreaHtml}
         (<span class="fire-extra-watch-info">👀: ${waitGifHtml}</span>/<span class="fire-extra-blacklist-info">🚫: ${waitGifHtml}</span>)`
                    .replace(/^\s+/mg, '').replace(/\n/g, ''));

            getSeSearchResultsForDomain(domainName).then(hitCount => {
                const domainElementLi = document.getElementById(getDomainId(domainName));
                if (!domainElementLi) return; // in case the popup is closed before the request is finished

                allDomainInformation[domainName].stackexchange = hitCount;
                const seHitCountElement = domainElementLi.querySelector('.fire-extra-se-results a');
                if (!seHitCountElement) return;

                seHitCountElement.innerHTML = `SE: ${hitCount}`;
                updateDomainInformation(domainName);
            }).catch(error => {
                toastr.error(error);
                console.error(error);
            });

            addActionListener(domainItem.querySelector('.fire-extra-watch'), 'watch', escapedDomain);
            addActionListener(domainItem.querySelector('.fire-extra-blacklist'), 'blacklist', escapedDomain);
            if (githubPrOpenItem) addActionListener(domainItem.querySelector('.fire-extra-approve'), 'approve', githubPrOpenItem.id);
        });

        dataWrapperElement.appendChild(domainList);
    }

    function updateWatchesAndBlacklists(parsedContent: Document) {
        if (!(/SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/.exec(parsedContent.querySelector('body')?.innerText || ''))) return;
        try {
            const newRegex = new RegExp(parsedContent.querySelectorAll('code')[1].innerHTML);

            const anchorInnerHtml = parsedContent.querySelectorAll('a')?.[1].innerHTML;
            const isWatch = Boolean(/Auto\swatch\sof\s/.exec(anchorInnerHtml));
            const isBlacklist = Boolean(/Auto\sblacklist\sof\s/.exec(anchorInnerHtml));
            const isUnwatch = Boolean(/Auto\sunwatch\sof\s/.exec(anchorInnerHtml));
            const isUnblacklist = Boolean(/Auto\sunblacklist\sof\s/.exec(anchorInnerHtml));

            if (isWatch) {
                watchedWebsitesRegexes.push(newRegex);
            } else if (isBlacklist) { // if it is a blacklist, also remove the item from the watchlist
                watchedWebsitesRegexes = watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
                blacklistedWebsitesRegexes.push(newRegex);
            } else if (isUnwatch) {
                watchedWebsitesRegexes = watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            } else if (isUnblacklist) {
                blacklistedWebsitesRegexes = blacklistedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            }
        } catch (error) {
            return false;
        }
    }

    async function updateGithubPullRequestInfo(parsedContent: Document) {
        if (!/Closed pull request |Merge pull request|opened by SmokeDetector/.test(parsedContent.querySelector('body')?.innerText || '')) return;
        const githubPrsApiCall = await fetch(githubPrApiUrl), githubPrsFromApi = await githubPrsApiCall.json() as GithubApiResponse[];
        githubPullRequests = getPullRequestDataFromApi(githubPrsFromApi);
    }

    function newChatEventOccurred({ event_type, user_id, content }: ChatEvent) {
        if ((user_id !== smokeDetectorId && user_id !== metasmokeId) || event_type !== 1) return;
        const parsedContent = domParser.parseFromString(content, 'text/html');
        updateWatchesAndBlacklists(parsedContent);
        void updateGithubPullRequestInfo(parsedContent);
    }

    window.addEventListener('fire-popup-appeared', addHtmlToFirePopup);
    CHAT.addEventHandlerHook(newChatEventOccurred);
    GM_addStyle(`
.fire-extra-domains-list {
  padding: 5px !important;
  margin-left: 12px;
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

/* copied from the MS CSS for domain tags */
.fire-extra-tag {
  background-color: #5bc0de;
  padding: .2em .6em .3em;
  font-size: 75%;
  font-weight: 700;
  color: #fff;
  border-radius: .25em;
}

.fire-extra-blacklist, .fire-extra-watch, .fire-extra-approve {
  cursor: pointer;
}

.fire-popup {
  width: 700px !important;
}

.fire-extra-none {
  display: none;
}

.fire-extra-disabled {
  color: currentColor;
  opacity: 0.8;
}

.fire-extra-wait {
  padding-bottom: 5px;
}`);
})();