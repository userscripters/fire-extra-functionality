// ==UserScript==
// @name        FIRE Additional Functionality
// @version     1.3.1
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
// @updateURL   https://github.com/userscripters/fire-extra-functionality/raw/master/dist/fire_extra.user.js
// @downloadURL https://github.com/userscripters/fire-extra-functionality/raw/master/dist/fire_extra.user.js
// @homepageURL https://github.com/userscripters/fire-extra-functionality
// @supportURL  https://github.com/userscripters/fire-extra-functionality/issues
// ==/UserScript==
/* globals fire, toastr, CHAT */
// NOTE: after installing this script, you need to modify FIRE. Add this line:
//     window.dispatchEvent(new CustomEvent('fire-popup-appeared'));
// before L1253 - hideReportImages(). This will fire an event when the FIRE popup opens which this userscript listens to.
// The script only runs on Charcoal HQ (11540) for now.
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__) => {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getDomainId": () => (/* binding */ getDomainId),
/* harmony export */   "watchedWebsitesRegexes": () => (/* binding */ watchedWebsitesRegexes),
/* harmony export */   "blacklistedWebsitesRegexes": () => (/* binding */ blacklistedWebsitesRegexes),
/* harmony export */   "githubPullRequests": () => (/* binding */ githubPullRequests)
/* harmony export */ });
/* harmony import */ var _github__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var _metasmoke__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);
/* harmony import */ var _chat__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3);
/* harmony import */ var _stackexchange__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4);
/* harmony import */ var _domain_stats__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(5);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_chat__WEBPACK_IMPORTED_MODULE_2__, _domain_stats__WEBPACK_IMPORTED_MODULE_4__]);
([_chat__WEBPACK_IMPORTED_MODULE_2__, _domain_stats__WEBPACK_IMPORTED_MODULE_4__] = __webpack_async_dependencies__.then ? await __webpack_async_dependencies__ : __webpack_async_dependencies__);





const metasmokeSearchUrl = 'https://metasmoke.erwaysoftware.com/search';
const waitGifHtml = '<img class="fire-extra-wait" src="/content/img/progress-dots.gif">';
const greenTick = '<span class="fire-extra-green"> ✓</span>', redCross = '<span class="fire-extra-red"> ✗</span>';
const getMetasmokeSearchUrl = (domain) => encodeURI(`${metasmokeSearchUrl}?utf8=✓&body_is_regex=1&body=(?s:\\b${domain}\\b)`);
const qualifiesForWatch = ([tpCount, fpCount, naaCount], seHits) => tpCount >= 1 && tpCount < 5 && fpCount + naaCount === 0 && Number(seHits) < 10;
const qualifiesForBlacklist = ([tpCount, fpCount, naaCount], seHits) => tpCount >= 5 && fpCount + naaCount === 0 && Number(seHits) < 5;
const isCaught = (regexesArray, domain) => regexesArray.some(regex => regex.test(domain));
const getDomainId = (domainName) => `fire-extra-${domainName.replace(/\./g, '-')}`;
function updateDomainInformation(domainName) {
    const seResultCount = _domain_stats__WEBPACK_IMPORTED_MODULE_4__.allDomainInformation[domainName]?.stackexchange;
    const metasmokeStats = _domain_stats__WEBPACK_IMPORTED_MODULE_4__.allDomainInformation[domainName]?.metasmoke;
    if ((!seResultCount && seResultCount !== '0') || !metasmokeStats?.length)
        return;
    const isWatched = isCaught(watchedWebsitesRegexes, domainName);
    const isBlacklisted = isCaught(blacklistedWebsitesRegexes, domainName);
    const escapedDomain = domainName.replace(/\./, '\\.');
    const watch = {
        human: 'watched: ' + (isWatched ? 'yes' : 'no'),
        tooltip: isWatched || isBlacklisted ? 'domain already watched' : `!!/watch- ${escapedDomain}`,
        suggested: qualifiesForWatch(metasmokeStats, seResultCount) && !isWatched && !isBlacklisted,
        class: `fire-extra-${isWatched || isBlacklisted ? 'disabled' : 'watch'}`
    };
    const blacklist = {
        human: 'blacklisted: ' + (isBlacklisted ? 'yes' : 'no'),
        tooltip: isBlacklisted ? 'domain already blacklisted' : `!!/blacklist-website- ${escapedDomain}`,
        suggested: qualifiesForBlacklist(metasmokeStats, seResultCount) && !isBlacklisted,
        class: `fire-extra-${isBlacklisted ? 'disabled' : 'blacklist'}`
    };
    const domainId = getDomainId(domainName), domainElementLi = document.getElementById(domainId);
    const watchButton = domainElementLi?.querySelector('.fire-extra-watch'), blacklistButton = domainElementLi?.querySelector('.fire-extra-blacklist');
    const watchInfo = domainElementLi?.querySelector('.fire-extra-watch-info'), blacklistInfo = domainElementLi?.querySelector('.fire-extra-blacklist-info');
    watchInfo?.setAttribute('fire-tooltip', watch.human);
    blacklistInfo?.setAttribute('fire-tooltip', blacklist.human);
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
    const nativeSeLink = [...new URL(fireMetasmokeButton?.href || '').searchParams][0][1];
    const metasmokePostId = fire.reportCache[nativeSeLink].id;
    const domains = await _metasmoke__WEBPACK_IMPORTED_MODULE_1__.getAllDomainsFromPost(metasmokePostId);
    if (!domains.length)
        return;
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
    const domainIdsValid = domains.filter(domainObject => !_github__WEBPACK_IMPORTED_MODULE_0__.whitelistedDomains.includes(domainObject.domain)
        && !_github__WEBPACK_IMPORTED_MODULE_0__.redirectors.includes(domainObject.domain)).map(item => item.id);
    _domain_stats__WEBPACK_IMPORTED_MODULE_4__.triggerDomainUpdate(domainIdsValid)
        .then(domainNames => domainNames.forEach(domainName => updateDomainInformation(domainName)))
        .catch(error => toastr.error(error));
    domains.map(item => item.domain).forEach(domainName => {
        _domain_stats__WEBPACK_IMPORTED_MODULE_4__.allDomainInformation[domainName] = {};
        const domainItem = document.createElement('li');
        domainItem.innerHTML = domainName + '&nbsp;';
        domainItem.id = getDomainId(domainName);
        domainList.appendChild(domainItem);
        if (_github__WEBPACK_IMPORTED_MODULE_0__.whitelistedDomains.includes(domainName)) {
            domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#whitelisted</span>');
            return;
        }
        else if (_github__WEBPACK_IMPORTED_MODULE_0__.redirectors.includes(domainName)) {
            domainItem.insertAdjacentHTML('beforeend', '<span class="fire-extra-tag">#redirector</span>');
            return;
        }
        const githubPrOpenItem = githubPullRequests.find(item => item.regex.test(domainName));
        const escapedDomain = domainName.replace(/\./g, '\\.');
        const watchBlacklistButtons = '<a class="fire-extra-watch">!!/watch</a>&nbsp;&nbsp;<a class="fire-extra-blacklist">!!/blacklist</a>&nbsp;&nbsp;';
        const actionsAreaHtml = githubPrOpenItem ? _github__WEBPACK_IMPORTED_MODULE_0__.getPendingPrHtml(githubPrOpenItem) : watchBlacklistButtons;
        domainItem.insertAdjacentHTML('beforeend', `(
           <a href="${getMetasmokeSearchUrl(escapedDomain)}">MS</a>: <span class="fire-extra-ms-stats">${waitGifHtml}</span>&nbsp;
         |&nbsp;
           <span class="fire-extra-se-results"><a href="${_stackexchange__WEBPACK_IMPORTED_MODULE_3__.seSearchPage}${domainName}">${waitGifHtml}</a></span>
         )&nbsp;&nbsp;${actionsAreaHtml}
         (<span class="fire-extra-watch-info">👀: ${waitGifHtml}</span>/<span class="fire-extra-blacklist-info">🚫: ${waitGifHtml}</span>)`
            .replace(/^\s+/mg, '').replace(/\n/g, ''));
        _stackexchange__WEBPACK_IMPORTED_MODULE_3__.getSeSearchResultsForDomain(domainName).then(hitCount => {
            const domainElementLi = document.getElementById(getDomainId(domainName));
            if (!domainElementLi)
                return;
            _domain_stats__WEBPACK_IMPORTED_MODULE_4__.allDomainInformation[domainName].stackexchange = hitCount;
            const seHitCountElement = domainElementLi.querySelector('.fire-extra-se-results a');
            if (!seHitCountElement)
                return;
            seHitCountElement.innerHTML = `SE: ${hitCount}`;
            updateDomainInformation(domainName);
        }).catch(error => {
            toastr.error(error);
            console.error(error);
        });
        _chat__WEBPACK_IMPORTED_MODULE_2__.addActionListener(domainItem.querySelector('.fire-extra-watch'), 'watch', escapedDomain);
        _chat__WEBPACK_IMPORTED_MODULE_2__.addActionListener(domainItem.querySelector('.fire-extra-blacklist'), 'blacklist', escapedDomain);
        if (githubPrOpenItem)
            _chat__WEBPACK_IMPORTED_MODULE_2__.addActionListener(domainItem.querySelector('.fire-extra-approve'), 'approve', githubPrOpenItem.id);
    });
    dataWrapperElement.appendChild(domainList);
}
const [watchedWebsitesCall, blacklistedWebsitesCall, githubPrsCall] = await Promise.all([
    fetch('https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/watched_keywords.txt'),
    fetch('https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/blacklisted_websites.txt'),
    fetch(_github__WEBPACK_IMPORTED_MODULE_0__.githubPrApiUrl)
]);
const [watchedWebsites, blacklistedWebsites, githubPrs] = await Promise.all([
    watchedWebsitesCall.text(),
    blacklistedWebsitesCall.text(),
    githubPrsCall.json()
]);
const watchedWebsitesRegexes = _github__WEBPACK_IMPORTED_MODULE_0__.getRegexesFromTxtFile(watchedWebsites, 2);
const blacklistedWebsitesRegexes = _github__WEBPACK_IMPORTED_MODULE_0__.getRegexesFromTxtFile(blacklistedWebsites, 0);
const githubPullRequests = _github__WEBPACK_IMPORTED_MODULE_0__.getPullRequestDataFromApi(githubPrs);
(function () {
    CHAT.addEventHandlerHook(_chat__WEBPACK_IMPORTED_MODULE_2__.newChatEventOccurred);
    window.addEventListener('fire-popup-appeared', addHtmlToFirePopup);
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

__webpack_handle_async_dependencies__();
}, 1);

/***/ }),
/* 1 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "githubPrApiUrl": () => (/* binding */ githubPrApiUrl),
/* harmony export */   "whitelistedDomains": () => (/* binding */ whitelistedDomains),
/* harmony export */   "redirectors": () => (/* binding */ redirectors),
/* harmony export */   "getPendingPrHtml": () => (/* binding */ getPendingPrHtml),
/* harmony export */   "getRegexesFromTxtFile": () => (/* binding */ getRegexesFromTxtFile),
/* harmony export */   "getPullRequestDataFromApi": () => (/* binding */ getPullRequestDataFromApi),
/* harmony export */   "getUpdatedGithubPullRequestInfo": () => (/* binding */ getUpdatedGithubPullRequestInfo)
/* harmony export */ });
const smokeDetectorGithubRepo = 'Charcoal-SE/SmokeDetector';
const smokeDetectorGithubId = 11063859;
const githubPrApiUrl = `https://api.github.com/repos/${smokeDetectorGithubRepo}/pulls`;
const whitelistedDomains = GM_getResourceText('whitelisted'), redirectors = GM_getResourceText('redirectors');
const getGithubPrUrl = (pullRequestId) => `//github.com/${smokeDetectorGithubRepo}/pull/${pullRequestId}`;
const getPrTooltip = ({ id, regex, author, type }) => `${author} wants to ${type} ${regex.source} in PR#${id}`;
const getPendingPrHtml = (githubPrOpenItem) => `<a href=${getGithubPrUrl(githubPrOpenItem.id)} fire-tooltip="${getPrTooltip(githubPrOpenItem)}">PR#${githubPrOpenItem.id}</a>`
    + `&nbsp;pending <a class="fire-extra-approve" fire-tooltip="!!/approve ${githubPrOpenItem.id}">!!/approve</a>&nbsp;&nbsp;`;
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
function getPullRequestDataFromApi(jsonData) {
    return jsonData.filter(item => item.user.id === smokeDetectorGithubId && item.state === 'open').flatMap(item => {
        const { number, title } = item;
        let regex;
        try {
            regex = new RegExp(/(?:Watch|Blacklist)\s(.*)/.exec(title)?.[1] || '');
        }
        catch (error) {
            return [];
        }
        const authorName = (/^(.*?):/.exec(title))?.[1];
        const prType = (/^.*?:\s(Watch)\s/.exec(title)) ? 'watch' : 'blacklist';
        return [{ id: number, regex: regex, author: authorName || '', type: prType }];
    });
}
async function getUpdatedGithubPullRequestInfo(parsedContent) {
    const messageText = parsedContent.querySelector('body')?.innerText || '';
    if (!/Closed pull request |Merge pull request|opened by SmokeDetector/.test(messageText))
        return;
    const githubPrsApiCall = await fetch(githubPrApiUrl), githubPrsFromApi = await githubPrsApiCall.json();
    return getPullRequestDataFromApi(githubPrsFromApi);
}


/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getGraphQLInformation": () => (/* binding */ getGraphQLInformation),
/* harmony export */   "getAllDomainsFromPost": () => (/* binding */ getAllDomainsFromPost)
/* harmony export */ });
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
async function getAllDomainsFromPost(metasmokePostId) {
    const finalMsApiUrl = `${metasmokeApiBase}${metasmokePostId}/domains?key=${metasmokeApiKey}&filter=${postDomainsApiFilter}&per_page=100`;
    const apiCallResponse = await fetch(finalMsApiUrl);
    const jsonResponse = await apiCallResponse.json();
    return jsonResponse.items;
}


/***/ }),
/* 3 */
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__) => {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "addActionListener": () => (/* binding */ addActionListener),
/* harmony export */   "newChatEventOccurred": () => (/* binding */ newChatEventOccurred)
/* harmony export */ });
/* harmony import */ var _index__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(0);
/* harmony import */ var _github__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_index__WEBPACK_IMPORTED_MODULE_0__]);
_index__WEBPACK_IMPORTED_MODULE_0__ = (__webpack_async_dependencies__.then ? await __webpack_async_dependencies__ : __webpack_async_dependencies__)[0];


const currentRoomId = Number((/\/rooms\/(\d+)\//.exec(window.location.pathname))?.[1]);
const smokeDetectorId = {
    'chat.stackexchange.com': 120914,
    'chat.stackoverflow.com': 3735529,
    'chat.meta.stackexchange.com': 266345
}[location.host];
const metasmokeId = {
    'chat.stackexchange.com': 478536,
    'chat.stackoverflow.com': 14262788,
    'chat.meta.stackexchange.com': 848503
}[location.host];
async function sendActionMessageToChat(messageType, domainOrPrId) {
    const messageToSend = `!!/${messageType === 'blacklist' ? messageType + '-website' : messageType}- ${domainOrPrId}`
        .replace('approve-', 'approve');
    const userFkey = document.querySelector('input[name="fkey"]')?.value;
    if (!userFkey)
        throw new Error('Chat fkey not found');
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
function updateWatchesAndBlacklists(parsedContent) {
    if (!(/SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/.exec(parsedContent.querySelector('body')?.innerText || '')))
        return;
    try {
        const newRegex = new RegExp(parsedContent.querySelectorAll('code')[1].innerHTML);
        const anchorInnerHtml = parsedContent.querySelectorAll('a')?.[1].innerHTML;
        const isWatch = Boolean(/Auto\swatch\sof\s/.exec(anchorInnerHtml));
        const isBlacklist = Boolean(/Auto\sblacklist\sof\s/.exec(anchorInnerHtml));
        const isUnwatch = Boolean(/Auto\sunwatch\sof\s/.exec(anchorInnerHtml));
        const isUnblacklist = Boolean(/Auto\sunblacklist\sof\s/.exec(anchorInnerHtml));
        if (isWatch) {
            _index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes.push(newRegex);
        }
        else if (isBlacklist) {
            const newObjectArray = _index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            Object.keys(_index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes).forEach(key => delete _index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes[Number(key)]);
            _index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes.push(...newObjectArray);
            _index__WEBPACK_IMPORTED_MODULE_0__.blacklistedWebsitesRegexes.push(newRegex);
        }
        else if (isUnwatch) {
            const newObjectArray = _index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            Object.keys(_index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes).forEach(key => delete _index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes[Number(key)]);
            _index__WEBPACK_IMPORTED_MODULE_0__.watchedWebsitesRegexes.push(...newObjectArray);
        }
        else if (isUnblacklist) {
            const newObjectArray = _index__WEBPACK_IMPORTED_MODULE_0__.blacklistedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            Object.keys(_index__WEBPACK_IMPORTED_MODULE_0__.blacklistedWebsitesRegexes).forEach(key => delete _index__WEBPACK_IMPORTED_MODULE_0__.blacklistedWebsitesRegexes[Number(key)]);
            _index__WEBPACK_IMPORTED_MODULE_0__.blacklistedWebsitesRegexes.push(...newObjectArray);
        }
    }
    catch (error) {
        return;
    }
}
async function newChatEventOccurred({ event_type, user_id, content }) {
    if ((user_id !== smokeDetectorId && user_id !== metasmokeId) || event_type !== 1)
        return;
    const parsedContent = new DOMParser().parseFromString(content, 'text/html');
    updateWatchesAndBlacklists(parsedContent);
    const newGithubPrInfo = await _github__WEBPACK_IMPORTED_MODULE_1__.getUpdatedGithubPullRequestInfo(parsedContent);
    if (!newGithubPrInfo)
        return;
    Object.keys(_index__WEBPACK_IMPORTED_MODULE_0__.githubPullRequests).forEach(key => delete _index__WEBPACK_IMPORTED_MODULE_0__.githubPullRequests[Number(key)]);
    _index__WEBPACK_IMPORTED_MODULE_0__.githubPullRequests.push(...newGithubPrInfo);
}

});

/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "seSearchPage": () => (/* binding */ seSearchPage),
/* harmony export */   "getSeSearchResultsForDomain": () => (/* binding */ getSeSearchResultsForDomain)
/* harmony export */ });
const seSearchPage = 'https://stackexchange.com/search?q=url%3A';
function getSeSearchErrorMessage(status, statusText, domain) {
    return `Error ${status} while trying to fetch the SE search results for ${domain}: ${statusText}.`;
}
function getSeResultCount(pageHtml) {
    return pageHtml.querySelector('.results-header h2')?.textContent?.trim().replace(/,/g, '').match(/\d+/)?.[0] || '0';
}
function getSeSearchResultsForDomain(domain) {
    const requestUrl = seSearchPage + encodeURIComponent(domain);
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: requestUrl,
            onload: response => {
                if (response.status !== 200)
                    reject(getSeSearchErrorMessage(response.status, response.statusText, domain));
                const parsedResponse = new DOMParser().parseFromString(response.responseText, 'text/html');
                const resultCount = Number(getSeResultCount(parsedResponse));
                const shortenedResultCount = resultCount > 999 ? (resultCount / 1000).toFixed(1) + 'k' : resultCount;
                resolve(shortenedResultCount.toString());
            },
            onerror: errorResponse => reject(getSeSearchErrorMessage(errorResponse.status, errorResponse.statusText, domain))
        });
    });
}


/***/ }),
/* 5 */
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__) => {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "allDomainInformation": () => (/* binding */ allDomainInformation),
/* harmony export */   "triggerDomainUpdate": () => (/* binding */ triggerDomainUpdate)
/* harmony export */ });
/* harmony import */ var _metasmoke__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
/* harmony import */ var _index__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(0);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_index__WEBPACK_IMPORTED_MODULE_1__]);
_index__WEBPACK_IMPORTED_MODULE_1__ = (__webpack_async_dependencies__.then ? await __webpack_async_dependencies__ : __webpack_async_dependencies__)[0];


const allDomainInformation = {};
const getColouredSpan = (feedbackCount, feedback) => `<span class="fire-extra-${feedback}" fire-tooltip=${feedback.toUpperCase()}>${feedbackCount}</span>`;
const getColouredSpans = ([tpCount, fpCount, naaCount]) => `${getColouredSpan(tpCount, 'tp')}, ${getColouredSpan(fpCount, 'fp')}, ${getColouredSpan(naaCount, 'naa')}`;
async function getTpFpNaaCountFromDomains(domainIds) {
    if (!domainIds.length)
        return {};
    const domainStats = {};
    try {
        const results = await _metasmoke__WEBPACK_IMPORTED_MODULE_0__.getGraphQLInformation(domainIds);
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
async function triggerDomainUpdate(domainIdsValid) {
    const domainStats = await getTpFpNaaCountFromDomains(domainIdsValid);
    return Object.entries(domainStats || {}).flatMap(([domainName, feedbackCount]) => {
        const domainId = (0,_index__WEBPACK_IMPORTED_MODULE_1__.getDomainId)(domainName), domainElementLi = document.getElementById(domainId);
        if (!domainElementLi)
            return [];
        allDomainInformation[domainName].metasmoke = feedbackCount;
        const metasmokeStatsElement = domainElementLi.querySelector('.fire-extra-ms-stats');
        if (!metasmokeStatsElement)
            return [];
        metasmokeStatsElement.innerHTML = getColouredSpans(feedbackCount);
        return [domainName];
    });
}

});

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
/******/ 	/* webpack/runtime/async module */
/******/ 	(() => {
/******/ 		var webpackThen = typeof Symbol === "function" ? Symbol("webpack then") : "__webpack_then__";
/******/ 		var webpackExports = typeof Symbol === "function" ? Symbol("webpack exports") : "__webpack_exports__";
/******/ 		var completeQueue = (queue) => {
/******/ 			if(queue) {
/******/ 				queue.forEach((fn) => (fn.r--));
/******/ 				queue.forEach((fn) => (fn.r-- ? fn.r++ : fn()));
/******/ 			}
/******/ 		}
/******/ 		var completeFunction = (fn) => (!--fn.r && fn());
/******/ 		var queueFunction = (queue, fn) => (queue ? queue.push(fn) : completeFunction(fn));
/******/ 		var wrapDeps = (deps) => (deps.map((dep) => {
/******/ 			if(dep !== null && typeof dep === "object") {
/******/ 				if(dep[webpackThen]) return dep;
/******/ 				if(dep.then) {
/******/ 					var queue = [];
/******/ 					dep.then((r) => {
/******/ 						obj[webpackExports] = r;
/******/ 						completeQueue(queue);
/******/ 						queue = 0;
/******/ 					});
/******/ 					var obj = { [webpackThen]: (fn, reject) => (queueFunction(queue, fn), dep.catch(reject)) };
/******/ 					return obj;
/******/ 				}
/******/ 			}
/******/ 			return { [webpackThen]: (fn) => (completeFunction(fn)), [webpackExports]: dep };
/******/ 		}));
/******/ 		__webpack_require__.a = (module, body, hasAwait) => {
/******/ 			var queue = hasAwait && [];
/******/ 			var exports = module.exports;
/******/ 			var currentDeps;
/******/ 			var outerResolve;
/******/ 			var reject;
/******/ 			var isEvaluating = true;
/******/ 			var nested = false;
/******/ 			var whenAll = (deps, onResolve, onReject) => {
/******/ 				if (nested) return;
/******/ 				nested = true;
/******/ 				onResolve.r += deps.length;
/******/ 				deps.map((dep, i) => (dep[webpackThen](onResolve, onReject)));
/******/ 				nested = false;
/******/ 			};
/******/ 			var promise = new Promise((resolve, rej) => {
/******/ 				reject = rej;
/******/ 				outerResolve = () => (resolve(exports), completeQueue(queue), queue = 0);
/******/ 			});
/******/ 			promise[webpackExports] = exports;
/******/ 			promise[webpackThen] = (fn, rejectFn) => {
/******/ 				if (isEvaluating) { return completeFunction(fn); }
/******/ 				if (currentDeps) whenAll(currentDeps, fn, rejectFn);
/******/ 				queueFunction(queue, fn);
/******/ 				promise.catch(rejectFn);
/******/ 			};
/******/ 			module.exports = promise;
/******/ 			body((deps) => {
/******/ 				if(!deps) return outerResolve();
/******/ 				currentDeps = wrapDeps(deps);
/******/ 				var fn, result;
/******/ 				var promise = new Promise((resolve, reject) => {
/******/ 					fn = () => (resolve(result = currentDeps.map((d) => (d[webpackExports]))));
/******/ 					fn.r = 0;
/******/ 					whenAll(currentDeps, fn, reject);
/******/ 				});
/******/ 				return fn.r ? promise : result;
/******/ 			}).then(outerResolve, reject);
/******/ 			isEvaluating = false;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
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