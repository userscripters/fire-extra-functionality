// ==UserScript==
// @name        FIRE Additional Functionality
// @version     1.3.3
// @author      double-beep
// @contributor Xnero
// @match       https://chat.stackexchange.com/rooms/11540/charcoal-hq
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @run-at      document-start
// @license     GPL-3.0
// @connect     metasmoke.erwaysoftware.com
// @connect     stackexchange.com
// @updateURL   https://github.com/userscripters/fire-extra-functionality/raw/master/dist/fire_extra.user.js
// @downloadURL https://github.com/userscripters/fire-extra-functionality/raw/master/dist/fire_extra.user.js
// @homepageURL https://github.com/userscripters/fire-extra-functionality
// @supportURL  https://github.com/userscripters/fire-extra-functionality/issues
// ==/UserScript==
/* globals fire, toastr, CHAT */
// The script only runs on Charcoal HQ (11540) for now.
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.indexHelpers = void 0;
const github = __webpack_require__(1);
const metasmoke = __webpack_require__(3);
const chat = __webpack_require__(4);
const stackexchange = __webpack_require__(6);
const domain_stats_js_1 = __webpack_require__(5);
const metasmokeSearchUrl = 'https://metasmoke.erwaysoftware.com/search';
const waitGifHtml = '<img class="fire-extra-wait" src="/content/img/progress-dots.gif">';
const greenTick = '<span class="fire-extra-green"> ✓</span>', redCross = '<span class="fire-extra-red"> ✗</span>';
exports.indexHelpers = {
    getMetasmokeSearchUrl: (domain) => encodeURI(`${metasmokeSearchUrl}?utf8=✓&body_is_regex=1&body=(?s:\\b${domain}\\b)`),
    qualifiesForWatch: ([tpCount, fpCount, naaCount], seHits) => tpCount >= 1 && tpCount < 5 && fpCount + naaCount === 0 && Number(seHits) < 10,
    qualifiesForBlacklist: ([tpCount, fpCount, naaCount], seHits) => tpCount >= 5 && fpCount + naaCount === 0 && Number(seHits) < 5,
    isCaught: (regexesArray, domain) => regexesArray.some(regex => regex.test(domain)),
    getDomainId: (domainName) => `fire-extra-${domainName.replace(/\./g, '-')}`
};
function updateDomainInformation(domainName) {
    var _a, _b;
    const seResultCount = (_a = domain_stats_js_1.Domains.allDomainInformation[domainName]) === null || _a === void 0 ? void 0 : _a.stackexchange;
    const metasmokeStats = (_b = domain_stats_js_1.Domains.allDomainInformation[domainName]) === null || _b === void 0 ? void 0 : _b.metasmoke;
    if ((!seResultCount && seResultCount !== '0') || !(metasmokeStats === null || metasmokeStats === void 0 ? void 0 : metasmokeStats.length))
        return;
    const isWatched = exports.indexHelpers.isCaught(domain_stats_js_1.Domains.watchedWebsitesRegexes, domainName);
    const isBlacklisted = exports.indexHelpers.isCaught(domain_stats_js_1.Domains.blacklistedWebsitesRegexes, domainName);
    const escapedDomain = domainName.replace(/\./, '\\.');
    const watch = {
        human: 'watched: ' + (isWatched ? 'yes' : 'no'),
        tooltip: isWatched || isBlacklisted ? 'domain already watched' : `!!/watch- ${escapedDomain}`,
        suggested: exports.indexHelpers.qualifiesForWatch(metasmokeStats, seResultCount) && !isWatched && !isBlacklisted,
        class: `fire-extra-${isWatched || isBlacklisted ? 'disabled' : 'watch'}`
    };
    const blacklist = {
        human: 'blacklisted: ' + (isBlacklisted ? 'yes' : 'no'),
        tooltip: isBlacklisted ? 'domain already blacklisted' : `!!/blacklist-website- ${escapedDomain}`,
        suggested: exports.indexHelpers.qualifiesForBlacklist(metasmokeStats, seResultCount) && !isBlacklisted,
        class: `fire-extra-${isBlacklisted ? 'disabled' : 'blacklist'}`
    };
    const domainId = exports.indexHelpers.getDomainId(domainName), domainElementLi = document.getElementById(domainId);
    const watchButton = domainElementLi === null || domainElementLi === void 0 ? void 0 : domainElementLi.querySelector('.fire-extra-watch'), blacklistButton = domainElementLi === null || domainElementLi === void 0 ? void 0 : domainElementLi.querySelector('.fire-extra-blacklist');
    const watchInfo = domainElementLi === null || domainElementLi === void 0 ? void 0 : domainElementLi.querySelector('.fire-extra-watch-info'), blacklistInfo = domainElementLi === null || domainElementLi === void 0 ? void 0 : domainElementLi.querySelector('.fire-extra-blacklist-info');
    watchInfo === null || watchInfo === void 0 ? void 0 : watchInfo.setAttribute('fire-tooltip', watch.human);
    blacklistInfo === null || blacklistInfo === void 0 ? void 0 : blacklistInfo.setAttribute('fire-tooltip', blacklist.human);
    if (!watchInfo || !blacklistInfo)
        return;
    watchInfo.innerHTML = '👀: ' + (isWatched ? greenTick : redCross);
    blacklistInfo.innerHTML = '🚫: ' + (isBlacklisted ? greenTick : redCross);
    if (!watchButton || !blacklistButton)
        return;
    if (watch.suggested)
        watchButton.insertAdjacentHTML('afterend', greenTick);
    if (blacklist.suggested)
        blacklistButton.insertAdjacentHTML('afterend', greenTick);
    if (!watchButton.classList.contains(watch.class))
        watchButton.classList.add(watch.class);
    if (!blacklistButton.classList.contains(blacklist.class))
        blacklistButton.classList.add(blacklist.class);
    watchButton.setAttribute('fire-tooltip', watch.tooltip);
    blacklistButton.setAttribute('fire-tooltip', blacklist.tooltip);
}
async function addHtmlToFirePopup() {
    const reportedPostDiv = document.querySelector('.fire-reported-post');
    const fireMetasmokeButton = document.querySelector('.fire-metasmoke-button');
    const nativeSeLink = [...new URL((fireMetasmokeButton === null || fireMetasmokeButton === void 0 ? void 0 : fireMetasmokeButton.href) || '').searchParams][0][1];
    const metasmokePostId = fire.reportCache[nativeSeLink].id;
    const domains = await metasmoke.getAllDomainsFromPost(metasmokePostId);
    if (!domains.length)
        return;
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
    const domainIdsValid = domains.filter(domainObject => !domain_stats_js_1.Domains.whitelistedDomains.includes(domainObject.domain)
        && !github.redirectors.includes(domainObject.domain)).map(item => item.id);
    domain_stats_js_1.Domains.triggerDomainUpdate(domainIdsValid)
        .then(domainNames => domainNames.forEach(domainName => updateDomainInformation(domainName)))
        .catch(error => toastr.error(error));
    domains.map(item => item.domain).forEach(domainName => {
        domain_stats_js_1.Domains.allDomainInformation[domainName] = {};
        const domainItem = document.createElement('li');
        domainItem.innerHTML = domainName + '&nbsp;';
        domainItem.id = exports.indexHelpers.getDomainId(domainName);
        domainList.appendChild(domainItem);
        if (domain_stats_js_1.Domains.whitelistedDomains.includes(domainName)) {
            domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#whitelisted</span>');
            return;
        }
        else if (github.redirectors.includes(domainName)) {
            domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#redirector</span>');
            return;
        }
        const githubPrOpenItem = domain_stats_js_1.Domains.githubPullRequests.find(item => item.regex.test(domainName));
        const escapedDomain = domainName.replace(/blogspot\..*$/g, 'blogspot').replace(/\./g, '\\.');
        const watchBlacklistButtons = '<a class="fire-extra-watch">!!/watch</a>&nbsp;&nbsp;<a class="fire-extra-blacklist">!!/blacklist</a>&nbsp;&nbsp;';
        const actionsAreaHtml = githubPrOpenItem ? github.getPendingPrHtml(githubPrOpenItem) : watchBlacklistButtons;
        const msSearchUrl = exports.indexHelpers.getMetasmokeSearchUrl(escapedDomain);
        domainItem.insertAdjacentHTML('beforeend', `(
           <a href="${msSearchUrl}">MS</a>: <span class="fire-extra-ms-stats">${waitGifHtml}</span>&nbsp;
         |&nbsp;
           <span class="fire-extra-se-results"><a href="${stackexchange.seSearchPage}${domainName}">${waitGifHtml}</a></span>
         )&nbsp;&nbsp;${actionsAreaHtml}
         (<span class="fire-extra-watch-info">👀: ${waitGifHtml}</span>/<span class="fire-extra-blacklist-info">🚫: ${waitGifHtml}</span>)`
            .replace(/^\s+/mg, '').replace(/\n/g, ''));
        stackexchange.getSeSearchResultsForDomain(domainName).then(hitCount => {
            const domainElementLi = document.getElementById(exports.indexHelpers.getDomainId(domainName));
            if (!domainElementLi)
                return;
            domain_stats_js_1.Domains.allDomainInformation[domainName].stackexchange = hitCount;
            const seHitCountElement = domainElementLi.querySelector('.fire-extra-se-results a');
            if (!seHitCountElement)
                return;
            seHitCountElement.innerHTML = `SE: ${hitCount}`;
            updateDomainInformation(domainName);
        }).catch(error => {
            toastr.error(error);
            console.error(error);
        });
        chat.addActionListener(domainItem.querySelector('.fire-extra-watch'), 'watch', escapedDomain);
        chat.addActionListener(domainItem.querySelector('.fire-extra-blacklist'), 'blacklist', escapedDomain);
        if (githubPrOpenItem)
            chat.addActionListener(domainItem.querySelector('.fire-extra-approve'), 'approve', githubPrOpenItem.id);
    });
    dataWrapperElement.appendChild(domainList);
}
void (async function () {
    await new Promise(resolve => setTimeout(resolve, 0));
    await domain_stats_js_1.Domains.fetchAllDomainInformation();
    CHAT.addEventHandlerHook(event => {
        const eventToPass = Object.assign({
            ...event,
            content: new DOMParser().parseFromString(event.content, 'text/html')
        });
        chat.newChatEventOccurred(eventToPass);
    });
    window.addEventListener('fire-popup-open', addHtmlToFirePopup);
    GM_addStyle(`
.fire-extra-domains-list {
  padding: 5px !important;
  margin-left: 12px;
}

.fire-extra-tp, .fire-extra-green { color: #3c763d; }
.fire-extra-fp, .fire-extra-red { color: #a94442; }
.fire-extra-naa { color: #8a6d3b; }
.fire-extra-blacklist, .fire-extra-watch, .fire-extra-approve { cursor: pointer; }
.fire-popup { width: 700px !important; }
.fire-extra-none { display: none; }
.fire-extra-wait { padding-bottom: 5px; }

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


/***/ }),
/* 1 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getUpdatedGithubPullRequestInfo = exports.parsePullRequestDataFromApi = exports.getRegexesFromTxtFile = exports.getPendingPrHtml = exports.blacklistedKeywordsUrl = exports.watchedKeywordsUrl = exports.redirectors = exports.whitelisted = exports.githubPrApiUrl = void 0;
const node_fetch_1 = __webpack_require__(2);
const smokeDetectorGithubRepo = 'Charcoal-SE/SmokeDetector';
const smokeDetectorGithubId = 11063859;
exports.githubPrApiUrl = `https://api.github.com/repos/${smokeDetectorGithubRepo}/pulls`;
exports.whitelisted = 'https://gist.githubusercontent.com/double-beep/db30adf42967187382d2d261bf0a2bc1/raw/whitelisted_domains.txt';
exports.redirectors = 'https://gist.githubusercontent.com/double-beep/ef22d986621ade6cacadae604f20ee59/raw/redirectors.txt';
exports.watchedKeywordsUrl = 'https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/watched_keywords.txt';
exports.blacklistedKeywordsUrl = 'https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/blacklisted_websites.txt';
const getGithubPrUrl = (pullRequestId) => `//github.com/${smokeDetectorGithubRepo}/pull/${pullRequestId}`;
const getPrTooltip = ({ id, regex, author, type }) => `${author} wants to ${type} ${regex.source} in PR#${id}`;
const getPendingPrHtml = (githubPrOpenItem) => `<a href="${getGithubPrUrl(githubPrOpenItem.id)}" fire-tooltip="${getPrTooltip(githubPrOpenItem)}">PR#${githubPrOpenItem.id}</a>`
    + `&nbsp;pending <a class="fire-extra-approve" fire-tooltip="!!/approve ${githubPrOpenItem.id}">!!/approve</a>&nbsp;&nbsp;`;
exports.getPendingPrHtml = getPendingPrHtml;
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
            return [];
        }
        return [regexToReturn];
    });
}
exports.getRegexesFromTxtFile = getRegexesFromTxtFile;
function parsePullRequestDataFromApi(jsonData) {
    return jsonData.filter(item => item.user.id === smokeDetectorGithubId && item.state === 'open').flatMap(item => {
        var _a, _b;
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
exports.parsePullRequestDataFromApi = parsePullRequestDataFromApi;
async function getUpdatedGithubPullRequestInfo(parsedContent) {
    var _a;
    const messageText = ((_a = parsedContent.body) === null || _a === void 0 ? void 0 : _a.innerHTML) || '';
    if (!/Closed pull request |Merge pull request|opened by SmokeDetector/.test(messageText))
        return;
    const githubPrsApiCall = await (window.fetch ? window.fetch : node_fetch_1.default)(exports.githubPrApiUrl);
    const githubPrsFromApi = await githubPrsApiCall.json();
    return parsePullRequestDataFromApi(githubPrsFromApi);
}
exports.getUpdatedGithubPullRequestInfo = getUpdatedGithubPullRequestInfo;


/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = fetch;

/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getAllDomainsFromPost = exports.getGraphQLInformation = void 0;
const node_fetch_1 = __webpack_require__(2);
const metasmokeApiBase = 'https://metasmoke.erwaysoftware.com/api/v2.0/posts/';
const metasmokeApiKey = '36d7b497b16d54e23641d0f698a2d7aab7d92777ef3108583b5bd7d9ddcd0a18';
const postDomainsApiFilter = 'HGGGFLHIHKIHOOH';
function getDomainPostsQuery(idsArray) {
    return `{
        spam_domains(ids: [${idsArray.join(',')}]) {
            id, domain, posts {
                is_tp,
                is_fp,
                is_naa
            }
        }
    }`;
}
function getGraphQLInformation(idsArray) {
    const query = getDomainPostsQuery(idsArray);
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
                    return 'errors' in jsonResponse ? reject(jsonResponse) : resolve(jsonResponse);
                }
                else {
                    reject(`Failed to get information from GraphQL with error ${response.status}. Make sure you are logged in to Metasmoke before trying again.`);
                    console.error(response);
                }
            },
            onerror: errorResponse => reject(errorResponse.responseText)
        });
    });
}
exports.getGraphQLInformation = getGraphQLInformation;
async function getAllDomainsFromPost(metasmokePostId) {
    const msApiUrl = `${metasmokeApiBase}${metasmokePostId}/domains?key=${metasmokeApiKey}&filter=${postDomainsApiFilter}&per_page=100`;
    const apiCallResponse = await (window.fetch ? window.fetch : node_fetch_1.default)(msApiUrl);
    const jsonResponse = await apiCallResponse.json();
    return jsonResponse.items;
}
exports.getAllDomainsFromPost = getAllDomainsFromPost;


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.newChatEventOccurred = exports.addActionListener = void 0;
const github = __webpack_require__(1);
const domain_stats_js_1 = __webpack_require__(5);
const node_fetch_1 = __webpack_require__(2);
const charcoalRoomId = 11540, smokedetectorId = 120914, metasmokeId = 478536;
async function sendActionMessageToChat(messageType, domainOrPrId) {
    var _a;
    const messageToSend = `!!/${messageType === 'blacklist' ? messageType + '-website' : messageType}- ${domainOrPrId}`
        .replace('approve-', 'approve');
    const userFkey = (_a = document.querySelector('input[name="fkey"]')) === null || _a === void 0 ? void 0 : _a.value;
    if (!userFkey)
        throw new Error('Chat fkey not found');
    const params = new FormData();
    params.append('text', messageToSend);
    params.append('fkey', userFkey);
    const chatNewMessageCall = await (window.fetch ? window.fetch : node_fetch_1.default)(`/chats/${charcoalRoomId}/messages/new`, {
        method: 'POST',
        body: params
    });
    if (chatNewMessageCall.status !== 200)
        throw new Error(`Failed to send message to chat. Returned error is ${chatNewMessageCall.status}`);
    const chatResponse = await chatNewMessageCall.json();
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
exports.addActionListener = addActionListener;
function updateWatchesAndBlacklists(parsedContent) {
    var _a, _b;
    const messageText = ((_a = parsedContent.body) === null || _a === void 0 ? void 0 : _a.innerHTML) || '';
    if (!/SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/.exec(messageText) || !/Blacklists reloaded at/.exec(messageText))
        return;
    try {
        const newRegex = new RegExp(parsedContent.querySelectorAll('code')[1].innerHTML);
        const anchorInnerHtml = (_b = parsedContent.querySelectorAll('a')) === null || _b === void 0 ? void 0 : _b[1].innerHTML;
        const isWatch = Boolean(/Auto\swatch\sof\s/.exec(anchorInnerHtml));
        const isBlacklist = Boolean(/Auto\sblacklist\sof\s/.exec(anchorInnerHtml));
        const isUnwatch = Boolean(/Auto\sunwatch\sof\s/.exec(anchorInnerHtml));
        const isUnblacklist = Boolean(/Auto\sunblacklist\sof/.exec(anchorInnerHtml));
        if (isWatch) {
            domain_stats_js_1.Domains.watchedWebsitesRegexes.push(newRegex);
        }
        else if (isBlacklist) {
            domain_stats_js_1.Domains.watchedWebsitesRegexes = domain_stats_js_1.Domains.watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            domain_stats_js_1.Domains.blacklistedWebsitesRegexes.push(newRegex);
        }
        else if (isUnwatch) {
            domain_stats_js_1.Domains.watchedWebsitesRegexes = domain_stats_js_1.Domains.watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
        }
        else if (isUnblacklist) {
            domain_stats_js_1.Domains.blacklistedWebsitesRegexes = domain_stats_js_1.Domains.blacklistedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
        }
    }
    catch (error) {
        return;
    }
}
function newChatEventOccurred({ event_type, user_id, content }) {
    if ((user_id !== smokedetectorId && user_id !== metasmokeId) || event_type !== 1)
        return;
    updateWatchesAndBlacklists(content);
    github.getUpdatedGithubPullRequestInfo(content)
        .then(newGithubPrInfo => newGithubPrInfo ? domain_stats_js_1.Domains.githubPullRequests = newGithubPrInfo : '')
        .catch(error => console.error(error));
}
exports.newChatEventOccurred = newChatEventOccurred;


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Domains = void 0;
const metasmoke = __webpack_require__(3);
const github = __webpack_require__(1);
const index_js_1 = __webpack_require__(0);
const node_fetch_1 = __webpack_require__(2);
const getColouredSpan = (feedbackCount, feedback) => `<span class="fire-extra-${feedback}" fire-tooltip=${feedback.toUpperCase()}>${feedbackCount}</span>`;
const getColouredSpans = ([tpCount, fpCount, naaCount]) => `${getColouredSpan(tpCount, 'tp')}, ${getColouredSpan(fpCount, 'fp')}, ${getColouredSpan(naaCount, 'naa')}`;
class Domains {
    static async fetchAllDomainInformation() {
        if (this.watchedWebsitesRegexes && this.blacklistedWebsitesRegexes && this.githubPullRequests
            && this.whitelistedDomains && this.redirectors)
            return;
        const [watchedWebsitesCall, blacklistedWebsitesCall, githubPrsCall, whitelistedDomainsCall, redirectorsCall] = await Promise.all(([
            (node_fetch_1.default || window.fetch)(github.watchedKeywordsUrl),
            (node_fetch_1.default || window.fetch)(github.blacklistedKeywordsUrl),
            (node_fetch_1.default || window.fetch)(github.githubPrApiUrl),
            (node_fetch_1.default || window.fetch)(github.whitelisted),
            (node_fetch_1.default || window.fetch)(github.redirectors)
        ]));
        const [watchedWebsites, blacklistedWebsites, githubPrs, whitelistedDomains, redirectors] = await Promise.all([
            watchedWebsitesCall.text(),
            blacklistedWebsitesCall.text(),
            githubPrsCall.json(),
            whitelistedDomainsCall.text(),
            redirectorsCall.text()
        ]);
        this.watchedWebsitesRegexes = github.getRegexesFromTxtFile(watchedWebsites, 2);
        this.blacklistedWebsitesRegexes = github.getRegexesFromTxtFile(blacklistedWebsites, 0);
        this.githubPullRequests = github.parsePullRequestDataFromApi(githubPrs);
        this.whitelistedDomains = whitelistedDomains;
        this.redirectors = redirectors;
    }
    static async getTpFpNaaCountFromDomains(domainIds) {
        if (!domainIds.length)
            return {};
        const domainStats = {};
        try {
            const results = await metasmoke.getGraphQLInformation(domainIds);
            const parsedResults = JSON.parse(JSON.stringify(results));
            if ('errors' in parsedResults)
                return {};
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
    static async triggerDomainUpdate(domainIdsValid) {
        const domainStats = await this.getTpFpNaaCountFromDomains(domainIdsValid);
        return Object.entries(domainStats || {}).flatMap(([domainName, feedbackCount]) => {
            const domainId = index_js_1.indexHelpers.getDomainId(domainName), domainElementLi = document.getElementById(domainId);
            if (!domainElementLi)
                return [];
            this.allDomainInformation[domainName].metasmoke = feedbackCount;
            const metasmokeStatsElement = domainElementLi.querySelector('.fire-extra-ms-stats');
            if (!metasmokeStatsElement)
                return [];
            metasmokeStatsElement.innerHTML = getColouredSpans(feedbackCount);
            return [domainName];
        });
    }
}
exports.Domains = Domains;
Domains.allDomainInformation = {};


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getSeSearchResultsForDomain = exports.getShortenedResultCount = exports.seSearchPage = void 0;
exports.seSearchPage = 'https://stackexchange.com/search?q=url%3A';
function getShortenedResultCount(number) {
    return number > 999
        ? (number / 1000).toFixed(1).replace('.0', '') + 'k'
        : number.toString();
}
exports.getShortenedResultCount = getShortenedResultCount;
function getSeSearchErrorMessage(status, statusText, domain) {
    return `Error ${status} while trying to fetch the SE search results for ${domain}: ${statusText}.`;
}
function getSeResultCount(pageHtml) {
    var _a, _b, _c;
    return ((_c = (_b = (_a = pageHtml.querySelector('.results-header h2')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim().replace(/,/g, '').match(/\d+/)) === null || _c === void 0 ? void 0 : _c[0]) || '0';
}
function getSeSearchResultsForDomain(domain) {
    const requestUrl = exports.seSearchPage + encodeURIComponent(domain);
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: requestUrl,
            onload: response => {
                if (response.status !== 200)
                    reject(getSeSearchErrorMessage(response.status, response.statusText, domain));
                const parsedResponse = new DOMParser().parseFromString(response.responseText, 'text/html');
                const resultCount = Number(getSeResultCount(parsedResponse));
                const shortenedResultCount = getShortenedResultCount(resultCount);
                resolve(shortenedResultCount);
            },
            onerror: errorResponse => reject(getSeSearchErrorMessage(errorResponse.status, errorResponse.statusText, domain))
        });
    });
}
exports.getSeSearchResultsForDomain = getSeSearchResultsForDomain;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	
/******/ })()
;
