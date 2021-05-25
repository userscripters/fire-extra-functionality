// ==UserScript==
// @name        FIRE Additional Functionality
// @version     0.3.1
// @author      double-beep
// @contributor Xnero
// @match       https://chat.stackexchange.com/rooms/11540/charcoal-hq
// @resource    whitelisted https://gist.githubusercontent.com/double-beep/db30adf42967187382d2d261bf0a2bc1/raw/whitelisted_domains.txt
// @resource    redirectors https://gist.githubusercontent.com/double-beep/ef22d986621ade6cacadae604f20ee59/raw/redirectors.txt
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_getResourceText
// @run-at      document-start
// @license     GPL-3.0
// @connect     metasmoke.erwaysoftware.com
// @connect     stackexchange.com
// @updateURL   https://gist.github.com/double-beep/89f782b5c6ec182d24c7c169e7402d96/raw/fire_extra.user.js
// @downloadURL https://gist.github.com/double-beep/89f782b5c6ec182d24c7c169e7402d96/raw/fire_extra.user.js
// @homepageURL https://github.com/userscripters/fire-extra-functionality
// @supportURL  https://github.com/userscripters/fire-extra-functionality/issues
// ==/UserScript==
/* globals fire, toastr, CHAT */
// NOTE: after installing this script, you need to modify FIRE. Add this line:
//     window.dispatchEvent(new CustomEvent('fire-popup-appeared'));
// before L1253 - hideReportImages(). This will fire an event when the FIRE popup opens which this userscript listens to.
// The script only runs on Charcoal HQ (11540) for now.
void (async function () {
    var _a;
    const domParser = new DOMParser();
    const metasmokeSearchUrl = 'https://metasmoke.erwaysoftware.com/search';
    const metasmokeApiBase = 'https://metasmoke.erwaysoftware.com/api/v2.0/posts/';
    const metasmokeApiKey = '36d7b497b16d54e23641d0f698a2d7aab7d92777ef3108583b5bd7d9ddcd0a18';
    const postDomainsApiFilter = 'HGGGFLHIHKIHOOH';
    const seSearchPage = 'https://stackexchange.com/search?q=url%3A';
    const currentRoomId = Number((_a = (/\/rooms\/(\d+)\//.exec(window.location.pathname))) === null || _a === void 0 ? void 0 : _a[1]);
    // Copied from FIRE
    const smokeDetectorId = { 'chat.stackexchange.com': 120914, 'chat.stackoverflow.com': 3735529, 'chat.meta.stackexchange.com': 266345 }[location.host];
    const metasmokeId = { 'chat.stackexchange.com': 478536, 'chat.stackoverflow.com': 14262788, 'chat.meta.stackexchange.com': 848503 }[location.host];
    const smokeDetectorGithubId = 11063859;
    const smokeDetectorGithubRepo = 'Charcoal-SE/SmokeDetector';
    const githubPrApiUrl = `https://api.github.com/repos/${smokeDetectorGithubRepo}/pulls`;
    const waitGifHtml = '<img class="fire-extra-wait" src="/content/img/progress-dots.gif">';
    const greenTick = '<span class="fire-extra-green"> ✓</span>', redCross = '<span class="fire-extra-red"> ✗</span>';
    const allDomainInformation = {}; // contains both the SE hit count and the MS feedbacks
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
        githubPrsCall.json()
    ]);
    // returns the number of hits given the SE search result page HTML
    const getResultCountFromParsedPage = (pageHtml) => { var _a, _b, _c; return Number((_c = (_b = (_a = pageHtml.querySelector('.results-header h2')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim().replace(/,/g, '').match(/\d+/)) === null || _c === void 0 ? void 0 : _c[0]); };
    // generate the GraphQL query string
    const getDomainPostsQuery = (idsArray) => `{
        spam_domains(ids: [${idsArray.join(',')}]) {
            id, domain, posts {
                is_tp,
                is_fp,
                is_naa
            }
        }
    }`;
    // Gets a coloured TP/FP/NAA span.
    const getColouredSpan = (feedbackCount, feedback) => `<span class="fire-extra-${feedback}" fire-tooltip=${feedback.toUpperCase()}>${feedbackCount}</span>`;
    const getColouredSpans = ([tpCount, fpCount, naaCount]) => `${getColouredSpan(tpCount, 'tp')}, ${getColouredSpan(fpCount, 'fp')}, ${getColouredSpan(naaCount, 'naa')}`;
    const getGithubPrUrl = (pullRequestId) => `//github.com/${smokeDetectorGithubRepo}/pull/${pullRequestId}`;
    const getPrTooltip = ({ id, regex, author, type }) => `${author} wants to ${type} ${regex.source} in PR#${id}`; // fire-tooltip text explaining pending PRs
    const getMetasmokeSearchUrl = (domain) => encodeURI(`${metasmokeSearchUrl}?utf8=✓&body_is_regex=1&body=(?s:\\b${domain}\\b)`); // returns an MS search URL for a domain
    // According to https://charcoal-se.org/smokey/Guidance-for-Blacklisting-and-Watching (as much as possible at least)
    // TP count between 1 and 5, there must be no FPs.
    const qualifiesForWatch = ([tpCount, fpCount, naaCount], seHits) => tpCount >= 1 && tpCount < 5 && fpCount + naaCount === 0 && Number(seHits) < 10;
    // "The site has at least five hits in metasmoke, with no false positives". Assumes that the current post is <=6 months old.
    const qualifiesForBlacklist = ([tpCount, fpCount, naaCount], seHits) => tpCount >= 5 && fpCount + naaCount === 0 && Number(seHits) < 5;
    const isCaught = (regexesArray, domain) => regexesArray.some(regex => regex.test(domain));
    const getSeSearchErrorMessage = (status, domain, statusText) => `Error ${status} while trying to fetch the SE search results for ${domain}: ${statusText}.`;
    const getDomainId = (domainName) => 'fire-extra-' + domainName.replace(/\./g, '-'); // replace any dots with a dash for form the id
    const getPendingPrHtml = (githubPrOpenItem) => `<a href=${getGithubPrUrl(githubPrOpenItem.id)} fire-tooltip="${getPrTooltip(githubPrOpenItem)}">PR#${githubPrOpenItem.id}</a> pending`
        + `&nbsp;<a class="fire-extra-approve" fire-tooltip="!!/approve ${githubPrOpenItem.id}">!!/approve</a>&nbsp;&nbsp;`;
    function getRegexesFromTxtFile(fileContent, position) {
        return fileContent.split('\n').flatMap(line => {
            const keyword = line.split('\t')[position];
            if (!keyword)
                return [];
            let regexToReturn;
            try {
                regexToReturn = new RegExp(keyword);
            }
            catch (error) {
                return []; // regex is incompatible with the ES regex engine; nothing can be done
            }
            return [regexToReturn];
        });
    }
    function getPullRequestDataFromApi(jsonData) {
        // only interested in open PRs by SD
        return jsonData.filter(item => item.user.id === smokeDetectorGithubId && item.state === 'open').flatMap(item => {
            var _a, _b;
            // Sample PR title => username: Watch example\.com
            const { number, title } = item;
            let regex;
            try {
                regex = new RegExp(((_a = /(?:Watch|Blacklist)\s(.*)/.exec(title)) === null || _a === void 0 ? void 0 : _a[1]) || '');
            }
            catch (error) {
                return [];
            }
            const authorName = (_b = (/^(.*?):/.exec(title))) === null || _b === void 0 ? void 0 : _b[1];
            const prType = (/^.*?:\s(Watch)\s/.exec(title)) ? 'watch' : 'blacklist';
            return [{ id: number, regex: regex, author: authorName || '', type: prType }];
        });
    }
    let watchedWebsitesRegexes = getRegexesFromTxtFile(watchedWebsites, 2);
    let blacklistedWebsitesRegexes = getRegexesFromTxtFile(blacklistedWebsites, 0);
    let githubPullRequests = getPullRequestDataFromApi(githubPrs);
    function getGraphQLInformation(query) {
        const payload = { 'query': query, 'variables': null };
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://metasmoke.erwaysoftware.com/api/graphql',
                data: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                onload: response => {
                    if (response.status === 200) {
                        const jsonResponse = JSON.parse(response.responseText);
                        // if an .errors field exists, then something went wrong
                        return 'errors' in jsonResponse ? reject(jsonResponse) : resolve(jsonResponse);
                    }
                    else { // status is not 200 (success), probably unauthorised/not logged in?
                        reject(`Failed to get information from GraphQL with error ${response.status}. Make sure you are logged in to Metasmoke before trying again.`);
                        console.error(response);
                    }
                },
                onerror: errorResponse => reject(errorResponse.responseText)
            });
        });
    }
    function getSeSearchResultsForDomain(domain) {
        const requestUrl = seSearchPage + encodeURIComponent(domain);
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: requestUrl,
                onload: response => {
                    if (response.status !== 200)
                        reject(getSeSearchErrorMessage(response.status, domain, response.statusText));
                    const parsedResponse = domParser.parseFromString(response.responseText, 'text/html');
                    const resultCount = Number(getResultCountFromParsedPage(parsedResponse));
                    const shortenedResultCount = resultCount > 999 ? (resultCount / 1000).toFixed(1) + 'k' : resultCount; // https://stackoverflow.com/a/9461657
                    resolve(shortenedResultCount.toString());
                },
                onerror: errorResponse => reject(getSeSearchErrorMessage(errorResponse.status, domain, errorResponse.statusText))
            });
        });
    }
    async function getAllDomainsFromPost(metasmokePostId) {
        const finalMsApiUrl = `${metasmokeApiBase}${metasmokePostId}/domains?key=${metasmokeApiKey}&filter=${postDomainsApiFilter}&per_page=100`;
        const apiCallResponse = await fetch(finalMsApiUrl);
        const jsonResponse = await apiCallResponse.json();
        return jsonResponse.items;
    }
    async function getTpFpNaaCountFromDomains(domainIds) {
        if (!domainIds.length)
            return;
        const graphiQL = getDomainPostsQuery(domainIds);
        const domainStats = {};
        /* domainStats contains the TP/FP/NAA count for the domain. Sample object:
           {
               'example.com': [ 5, 4, 10 ],
               'spamdomain.com': [ 5, 0, 0 ]
           }
           // The first item of the array is the tp count, the second the fp count and the third the naa count.
        */
        try {
            const results = await getGraphQLInformation(graphiQL);
            const parsedResults = JSON.parse(JSON.stringify(results));
            if ('errors' in parsedResults)
                return;
            parsedResults.data.spam_domains.forEach(spamDomain => {
                const tpPosts = spamDomain.posts.filter(post => post.is_tp).length;
                const fpPosts = spamDomain.posts.filter(post => post.is_fp).length;
                const naaPosts = spamDomain.posts.filter(post => post.is_naa).length;
                domainStats[spamDomain.domain] = [tpPosts, fpPosts, naaPosts];
            });
        }
        catch (error) {
            toastr.error(error);
            console.error('Error while trying to fetch domain stats from GraphiQL.', error);
        }
        return domainStats;
    }
    async function sendActionMessageToChat(messageType, domainOrPrId) {
        var _a;
        const messageToSend = `!!/${messageType === 'blacklist' ? messageType + '-website' : messageType}- ${domainOrPrId}`
            .replace('approve-', 'approve'); // no need for approve to have a dash
        const userFkey = (_a = document.querySelector('input[name="fkey"]')) === null || _a === void 0 ? void 0 : _a.value;
        toastr.error('Chat fkey not found');
        if (!userFkey)
            return; // fkey not found for some reason; chat message cannot be sent
        const params = new FormData();
        params.append('text', messageToSend);
        params.append('fkey', userFkey);
        const chatNewMessageCall = await fetch(`/chats/${currentRoomId}/messages/new`, {
            method: 'POST',
            body: params
        });
        if (chatNewMessageCall.status !== 200)
            throw new Error(`Failed to send message to chat. Returned error is ${chatNewMessageCall.status}`);
        const chatResponse = await chatNewMessageCall.json();
        // if .id or .time are null, then something went wrong
        if (!chatResponse.id || !chatResponse.time)
            throw new Error('Failed to send message to chat!');
    }
    function addActionListener(element, action, domainOrPrId) {
        if (!element)
            return;
        element.addEventListener('click', async () => {
            try {
                await sendActionMessageToChat(action, domainOrPrId);
                toastr.success('Successfully sent message to chat.');
            }
            catch (error) {
                toastr.error(error);
                console.error('Error while sending message to chat.', error);
            }
        });
    }
    function updateDomainInformation(domainName) {
        var _a, _b;
        const seResultCount = (_a = allDomainInformation[domainName]) === null || _a === void 0 ? void 0 : _a.stackexchange;
        const metasmokeStats = (_b = allDomainInformation[domainName]) === null || _b === void 0 ? void 0 : _b.metasmoke;
        if ((!seResultCount && seResultCount !== '0') || !(metasmokeStats === null || metasmokeStats === void 0 ? void 0 : metasmokeStats.length))
            return; // the SE hits might be zero, so using !hits returns true
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
        const watchButton = domainElementLi === null || domainElementLi === void 0 ? void 0 : domainElementLi.querySelector('.fire-extra-watch'), blacklistButton = domainElementLi === null || domainElementLi === void 0 ? void 0 : domainElementLi.querySelector('.fire-extra-blacklist');
        const watchInfo = domainElementLi === null || domainElementLi === void 0 ? void 0 : domainElementLi.querySelector('.fire-extra-watch-info'), blacklistInfo = domainElementLi === null || domainElementLi === void 0 ? void 0 : domainElementLi.querySelector('.fire-extra-blacklist-info');
        // add the tooltip to the emojis, e.g. watched: yes, blacklisted: no
        watchInfo === null || watchInfo === void 0 ? void 0 : watchInfo.setAttribute('fire-tooltip', watch.human);
        blacklistInfo === null || blacklistInfo === void 0 ? void 0 : blacklistInfo.setAttribute('fire-tooltip', blacklist.human);
        // append the tick or the cross (indicated if it should be watched/blacklisted or not)
        if (!watchInfo || !blacklistInfo)
            return;
        watchInfo.innerHTML = '👀: ' + (isWatched ? greenTick : redCross);
        blacklistInfo.innerHTML = '🚫: ' + (isBlacklisted ? greenTick : redCross);
        if (!watchButton || !blacklistButton)
            return; // the buttons do not exist if a PR is pending
        // add some ticks if the domain should be watch/blacklisted
        if (watch.suggested)
            watchButton.insertAdjacentHTML('afterend', greenTick);
        if (blacklist.suggested)
            blacklistButton.insertAdjacentHTML('afterend', greenTick);
        // disable buttons if necessary
        if (!watchButton.classList.contains(watch.class))
            watchButton.classList.add(watch.class);
        if (!blacklistButton.classList.contains(blacklist.class))
            blacklistButton.classList.add(blacklist.class);
        // add the tooltips (either !!/<action> example\.com or domain already <action>)
        watchButton.setAttribute('fire-tooltip', watch.tooltip);
        blacklistButton.setAttribute('fire-tooltip', blacklist.tooltip);
    }
    async function addHtmlToFirePopup() {
        const reportedPostDiv = document.querySelector('.fire-reported-post');
        const fireMetasmokeButton = document.querySelector('.fire-metasmoke-button');
        const nativeSeLink = [...new URL((fireMetasmokeButton === null || fireMetasmokeButton === void 0 ? void 0 : fireMetasmokeButton.href) || '').searchParams][0][1];
        const metasmokePostId = fire.reportCache[nativeSeLink].id; // taking advantage of FIRE's cache :)
        const domains = await getAllDomainsFromPost(metasmokePostId);
        if (!domains.length)
            return; // no domains; nothing to do
        const divider = document.createElement('hr');
        const dataWrapperElement = document.createElement('div');
        dataWrapperElement.classList.add('fire-extra-functionality');
        const header = document.createElement('h3');
        header.innerText = 'Domains';
        dataWrapperElement.appendChild(header);
        reportedPostDiv === null || reportedPostDiv === void 0 ? void 0 : reportedPostDiv.insertAdjacentElement('afterend', dataWrapperElement);
        reportedPostDiv === null || reportedPostDiv === void 0 ? void 0 : reportedPostDiv.insertAdjacentElement('afterend', divider);
        const domainList = document.createElement('ul');
        domainList.classList.add('fire-extra-domains-list');
        // exclude whitelisted domains, redirectors and domains that have a pending PR
        const domainIdsValid = domains.filter(domainObject => !whitelistedDomains.includes(domainObject.domain)
            && !redirectors.includes(domainObject.domain)).map(item => item.id);
        getTpFpNaaCountFromDomains(domainIdsValid).then(domainStats => {
            if (!domainStats)
                return;
            Object.entries(domainStats).forEach(([domainName, feedbackCount]) => {
                const domainId = getDomainId(domainName), domainElementLi = document.getElementById(domainId);
                if (!domainElementLi)
                    return; // in case the popup is closed before the process is complete
                allDomainInformation[domainName].metasmoke = feedbackCount;
                const metasmokeStatsElement = domainElementLi.querySelector('.fire-extra-ms-stats');
                if (!metasmokeStatsElement)
                    return;
                metasmokeStatsElement.innerHTML = getColouredSpans(feedbackCount);
                updateDomainInformation(domainName);
            });
        }).catch(error => toastr.error(error));
        domains.map(item => item.domain).forEach(domainName => {
            allDomainInformation[domainName] = {};
            const domainItem = document.createElement('li');
            domainItem.innerHTML = domainName + '&nbsp;';
            domainItem.id = getDomainId(domainName);
            domainList.appendChild(domainItem);
            // if the domain is whitelisted or a redirector, don't search for TPs/FPs/NAAs. They often have too many hits on SE/MS, and they make the script slower
            if (whitelistedDomains.includes(domainName)) {
                domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#whitelisted</span>');
                return;
            }
            else if (redirectors.includes(domainName)) {
                domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#redirector</span>');
                return;
            }
            const githubPrOpenItem = githubPullRequests.find(item => item.regex.test(domainName));
            const escapedDomain = domainName.replace(/\./g, '\\.'); // escape dots
            // use a function in case githubPrOpenItem is null (then it'd throw an error because we use .id)
            const watchBlacklistButtons = '<a class="fire-extra-watch">!!/watch</a>&nbsp;&nbsp;<a class="fire-extra-blacklist">!!/blacklist</a>&nbsp;&nbsp;';
            const actionsAreaHtml = githubPrOpenItem ? getPendingPrHtml(githubPrOpenItem) : watchBlacklistButtons;
            domainItem.insertAdjacentHTML('beforeend', `(
           <a href="${getMetasmokeSearchUrl(escapedDomain)}">MS</a>: <span class="fire-extra-ms-stats">${waitGifHtml}</span>&nbsp;
         |&nbsp;
           <span class="fire-extra-se-results"><a href="${seSearchPage}${domainName}">${waitGifHtml}</a></span>
         )&nbsp;&nbsp;${actionsAreaHtml}
         (<span class="fire-extra-watch-info">👀: ${waitGifHtml}</span>/<span class="fire-extra-blacklist-info">🚫: ${waitGifHtml}</span>)`
                .replace(/^\s+/mg, '').replace(/\n/g, ''));
            getSeSearchResultsForDomain(domainName).then(hitCount => {
                const domainElementLi = document.getElementById(getDomainId(domainName));
                if (!domainElementLi)
                    return; // in case the popup is closed before the request is finished
                allDomainInformation[domainName].stackexchange = hitCount;
                const seHitCountElement = domainElementLi.querySelector('.fire-extra-se-results a');
                if (!seHitCountElement)
                    return;
                seHitCountElement.innerHTML = `SE: ${hitCount}`;
                updateDomainInformation(domainName);
            }).catch(error => {
                toastr.error(error);
                console.error(error);
            });
            addActionListener(domainItem.querySelector('.fire-extra-watch'), 'watch', escapedDomain);
            addActionListener(domainItem.querySelector('.fire-extra-blacklist'), 'blacklist', escapedDomain);
            if (githubPrOpenItem)
                addActionListener(domainItem.querySelector('.fire-extra-approve'), 'approve', githubPrOpenItem.id);
        });
        dataWrapperElement.appendChild(domainList);
    }
    function updateWatchesAndBlacklists(parsedContent) {
        var _a, _b;
        if (!(/SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/.exec(((_a = parsedContent.querySelector('body')) === null || _a === void 0 ? void 0 : _a.innerText) || '')))
            return;
        try {
            const newRegex = new RegExp(parsedContent.querySelectorAll('code')[1].innerHTML);
            const anchorInnerHtml = (_b = parsedContent.querySelectorAll('a')) === null || _b === void 0 ? void 0 : _b[1].innerHTML;
            const isWatch = Boolean(/Auto\swatch\sof\s/.exec(anchorInnerHtml));
            const isBlacklist = Boolean(/Auto\sblacklist\sof\s/.exec(anchorInnerHtml));
            const isUnwatch = Boolean(/Auto\sunwatch\sof\s/.exec(anchorInnerHtml));
            const isUnblacklist = Boolean(/Auto\sunblacklist\sof\s/.exec(anchorInnerHtml));
            if (isWatch) {
                watchedWebsitesRegexes.push(newRegex);
            }
            else if (isBlacklist) { // if it is a blacklist, also remove the item from the watchlist
                watchedWebsitesRegexes = watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
                blacklistedWebsitesRegexes.push(newRegex);
            }
            else if (isUnwatch) {
                watchedWebsitesRegexes = watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            }
            else if (isUnblacklist) {
                blacklistedWebsitesRegexes = blacklistedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            }
        }
        catch (error) {
            return false;
        }
    }
    async function updateGithubPullRequestInfo(parsedContent) {
        var _a;
        if (!/Closed pull request |Merge pull request|opened by SmokeDetector/.test(((_a = parsedContent.querySelector('body')) === null || _a === void 0 ? void 0 : _a.innerText) || ''))
            return;
        const githubPrsApiCall = await fetch(githubPrApiUrl), githubPrsFromApi = await githubPrsApiCall.json();
        githubPullRequests = getPullRequestDataFromApi(githubPrsFromApi);
    }
    function newChatEventOccurred({ event_type, user_id, content }) {
        if ((user_id !== smokeDetectorId && user_id !== metasmokeId) || event_type !== 1)
            return;
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
