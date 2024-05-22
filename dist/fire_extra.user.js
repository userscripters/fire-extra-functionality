// ==UserScript==
// @name         FIRE Additional Functionality
// @version      1.3.5
// @author       double-beep
// @contributor  Xnero
// @description  Watch, blacklist and see domain stats directly from the FIRE popup!
// @match        *://chat.stackexchange.com/rooms/11540/charcoal-hq*
// @match        *://chat.stackexchange.com/transcript/11540*
// @match        *://chat.stackexchange.com/transcript/message/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-start
// @license      GPL-3.0
// @connect      metasmoke.erwaysoftware.com
// @connect      stackexchange.com
// @updateURL    https://github.com/userscripters/fire-extra-functionality/raw/master/dist/fire_extra.user.js
// @downloadURL  https://github.com/userscripters/fire-extra-functionality/raw/master/dist/fire_extra.user.js
// @homepageURL  https://github.com/userscripters/fire-extra-functionality
// @homepage     https://github.com/userscripters/fire-extra-functionality
// @supportURL   https://github.com/userscripters/fire-extra-functionality/issues
// ==/UserScript==
/* globals fire, toastr, CHAT */

"use strict";
(() => {
  // src/metasmoke.ts
  var metasmokeApiBase = "https://metasmoke.erwaysoftware.com/api/v2.0/posts/";
  var metasmokeApiKey = "36d7b497b16d54e23641d0f698a2d7aab7d92777ef3108583b5bd7d9ddcd0a18";
  var postDomainsApiFilter = "HGGGFLHIHKIHOOH";
  function getDomainPostsQuery(idsArray) {
    return `{
        spam_domains(ids: [${idsArray.join(",")}]) {
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
    const payload = {
      "query": query,
      "variables": null
    };
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: `https://metasmoke.erwaysoftware.com/api/graphql?key=${metasmokeApiKey}`,
        data: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        },
        onload: (response) => {
          if (response.status === 200) {
            const jsonResponse = JSON.parse(response.responseText);
            const hasErrors = "errors" in jsonResponse;
            return hasErrors ? reject(jsonResponse) : resolve(jsonResponse);
          } else {
            reject(`Failed to get information from GraphQL with error ${response.status}.Make sure you are logged in to Metasmoke before trying again.`);
            console.error(response);
          }
        },
        onerror: (errorResponse) => reject(errorResponse.responseText)
      });
    });
  }
  function getPostCounts(parsedHtml) {
    const tabsSelector = '.nav-tabs li:not([role="presentation"])';
    return [...parsedHtml.querySelectorAll(tabsSelector)].map((element) => /\d+/.exec(element?.textContent?.trim() || "")?.[0]).map(Number);
  }
  function getMsSearchResults(term) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: `https://metasmoke.erwaysoftware.com/search?utf8=\u2713&body=${term}`,
        onload: (response) => {
          if (response.status === 200) {
            const parsedHtml = new DOMParser().parseFromString(response.responseText, "text/html");
            resolve(getPostCounts(parsedHtml));
          } else {
            reject(`Failed to get search results for ${term} on metasmoke search.`);
            console.error(response);
          }
        },
        onerror: (errorResponse) => reject(errorResponse.responseText)
      });
    });
  }
  async function getAllDomainsFromPost(metasmokePostId) {
    const method = `${metasmokePostId}/domains`;
    const parameters = `?key=${metasmokeApiKey}&filter=${postDomainsApiFilter}&per_page=100`;
    const msApiUrl = metasmokeApiBase + method + parameters;
    const apiCallResponse = await fetch(msApiUrl);
    const jsonResponse = await apiCallResponse.json();
    return jsonResponse.items;
  }

  // src/stackexchange.ts
  function getSeUrl(searchTerm) {
    const base = "https://stackexchange.com/search?q=";
    const isUrl = searchTerm.includes(".");
    return isUrl ? `${base}url%3A${searchTerm}` : `${base}${searchTerm}`;
  }
  function getShortenedResultCount(number) {
    return number > 999 ? (number / 1e3).toFixed(1).replace(".0", "") + "k" : number.toString();
  }
  function getSeSearchErrorMessage(status, statusText, domain) {
    return `Error ${status} while trying to fetch the SE search results for ${domain}: ${statusText}.`;
  }
  function getSeResultCount(pageHtml) {
    return pageHtml.querySelector(".results-header h2")?.textContent?.trim().replace(/,/g, "").match(/\d+/)?.[0] || "0";
  }
  function getSeSearchResults(term) {
    const encodedTerm = encodeURIComponent(term);
    const requestUrl = getSeUrl(encodedTerm);
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: requestUrl,
        onload: (response) => {
          if (response.status !== 200) {
            const errorMessage = getSeSearchErrorMessage(response.status, response.statusText, term);
            return reject(errorMessage);
          }
          const parsedResponse = new DOMParser().parseFromString(response.responseText, "text/html");
          const resultCount = Number(getSeResultCount(parsedResponse));
          const shortenedResultCount = getShortenedResultCount(resultCount);
          resolve(shortenedResultCount);
        },
        onerror: (errorResponse) => reject(
          getSeSearchErrorMessage(errorResponse.status, errorResponse.statusText, term)
        )
      });
    });
  }

  // src/github.ts
  var sdGithubRepo = "Charcoal-SE/SmokeDetector";
  var sdGhId = 11063859;
  var githubUrls = {
    api: `https://api.github.com/repos/${sdGithubRepo}/pulls`,
    whitelisted: "https://raw.githubusercontent.com/userscripters/fire-extra-functionality/master/ini/whitelisted_domains.txt",
    redirectors: "https://raw.githubusercontent.com/userscripters/fire-extra-functionality/master/ini/redirectors.txt",
    watched: "https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/watched_keywords.txt",
    blacklisted: "https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/blacklisted_websites.txt"
  };
  function makeRegexESCompatible(keyword) {
    const shortenerPathRegex = /\(\?-i:(\w+)\)\(\?#[a-zA-Z.]+\)/;
    const urlPath = keyword.match(shortenerPathRegex)?.[1];
    if (!urlPath) return [];
    else return [new RegExp(urlPath)];
  }
  function getRegexesFromTxtFile(fileContent, position) {
    return fileContent.split("\n").flatMap((line) => {
      const keyword = line.split("	")[position];
      if (!keyword) return [];
      let regexToReturn;
      try {
        regexToReturn = new RegExp(keyword);
      } catch (error) {
        return makeRegexESCompatible(keyword);
      }
      return [regexToReturn];
    });
  }
  function parsePullRequestDataFromApi(jsonData) {
    return jsonData.filter((item) => item.user.id === sdGhId && item.state === "open").flatMap((item) => {
      const { number, title } = item;
      let regex;
      try {
        regex = new RegExp(/(?:Watch|Blacklist)\s(.*)/.exec(title)?.[1] || "");
      } catch (error) {
        return [];
      }
      const authorName = /^(.*?):/.exec(title)?.[1];
      const prType = /^.*?:\s(Watch)\s/.exec(title) ? "watch" : "blacklist";
      return [
        {
          id: number,
          regex,
          author: authorName || "",
          type: prType
        }
      ];
    });
  }
  async function getUpdatedPrInfo(parsedContent) {
    const messageText = parsedContent.body?.innerHTML || "";
    const prChanged = /Closed pull request |Merge pull request|opened by SmokeDetector/;
    if (!prChanged.test(messageText)) return;
    const githubPrsApiCall = await fetch(githubUrls.api);
    const githubPrsFromApi = await githubPrsApiCall.json();
    return parsePullRequestDataFromApi(githubPrsFromApi);
  }

  // src/domain_stats.ts
  var Domains = class {
    static allDomainInformation = {};
    // contains both the SE hit count and the MS feedbacks
    static watchedWebsites;
    static blacklistedWebsites;
    static githubPullRequests;
    static whitelistedDomains;
    static redirectors;
    static async fetchAllDomainInformation() {
      if (this.watchedWebsites && this.blacklistedWebsites && this.githubPullRequests && this.whitelistedDomains && this.redirectors) return;
      const [
        watchedWebsitesCall,
        blacklistedWebsitesCall,
        githubPrsCall,
        whitelistedDomainsCall,
        redirectorsCall
      ] = await Promise.all([
        fetch(githubUrls.watched),
        fetch(githubUrls.blacklisted),
        fetch(githubUrls.api),
        fetch(githubUrls.whitelisted),
        fetch(githubUrls.redirectors)
      ]);
      const [watchedWebsites, blacklistedWebsites, githubPrs, whitelistedDomains, redirectors] = await Promise.all([
        watchedWebsitesCall.text(),
        blacklistedWebsitesCall.text(),
        githubPrsCall.json(),
        whitelistedDomainsCall.text(),
        redirectorsCall.text()
      ]);
      this.watchedWebsites = getRegexesFromTxtFile(watchedWebsites, 2);
      this.blacklistedWebsites = getRegexesFromTxtFile(blacklistedWebsites, 0);
      this.githubPullRequests = parsePullRequestDataFromApi(githubPrs);
      this.whitelistedDomains = whitelistedDomains.split("\n");
      this.redirectors = redirectors.split("\n");
    }
    static async getTpFpNaaCountFromDomains(domainIds) {
      if (!domainIds.length) return {};
      const domainStats = {};
      try {
        const results = await getGraphQLInformation(domainIds);
        const parsedResults = JSON.parse(JSON.stringify(results));
        if ("errors" in parsedResults) return {};
        parsedResults.data.spam_domains.forEach((spamDomain) => {
          const tpPosts = spamDomain.posts.filter((post) => post.is_tp).length;
          const fpPosts = spamDomain.posts.filter((post) => post.is_fp).length;
          const naaPosts = spamDomain.posts.filter((post) => post.is_naa).length;
          domainStats[spamDomain.domain] = [tpPosts, fpPosts, naaPosts];
        });
      } catch (error) {
        toastr.error(error);
        console.error("Error while trying to fetch domain stats from GraphiQL.", error);
      }
      return domainStats;
    }
  };

  // src/chat.ts
  var charcoalRoomId = 11540;
  var smokedetectorId = 120914;
  var metasmokeId = 478536;
  async function sendActionMessageToChat(element) {
    const messageToSend = element.getAttribute("fire-tooltip");
    const fkeyEl = document.querySelector('input[name="fkey"]');
    const userFkey = fkeyEl?.value;
    if (!userFkey) throw new Error("Chat fkey not found");
    else if (!messageToSend) throw new Error("No message found");
    const params = new FormData();
    params.append("text", messageToSend);
    params.append("fkey", userFkey);
    const newMessageUrl = `/chats/${charcoalRoomId}/messages/new`;
    const chatNewMessageCall = await fetch(newMessageUrl, {
      method: "POST",
      body: params
    });
    if (chatNewMessageCall.status !== 200) {
      throw new Error(`Failed to send message to chat. Returned error is ${chatNewMessageCall.status}`);
    }
    const chatResponse = await chatNewMessageCall.json();
    if (!chatResponse.id || !chatResponse.time) throw new Error("Failed to send message to chat!");
  }
  function addActionListener(element) {
    if (!element) return;
    element.addEventListener("click", async () => {
      try {
        await sendActionMessageToChat(element);
        toastr.success("Successfully sent message to chat.");
      } catch (error) {
        toastr.error(error);
        console.error("Error while sending message to chat.", error);
      }
    });
  }
  function updateWatchesAndBlacklists(parsedContent) {
    const messageText = parsedContent.body?.innerHTML || "";
    const autoReloadOf = /SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/;
    const blacklistsReloaded = /Blacklists reloaded at/;
    if (!autoReloadOf.exec(messageText) || !blacklistsReloaded.exec(messageText)) return;
    try {
      const regexText = parsedContent.querySelectorAll("code")[1].innerHTML;
      const newRegex = new RegExp(regexText);
      const anchorInnerHtml = parsedContent.querySelectorAll("a")?.[1].innerHTML;
      const regexMatch = (regex) => regex.toString() !== newRegex.toString();
      const isType = (regex) => Boolean(regex.exec(anchorInnerHtml));
      const isWatch = isType(/Auto\swatch\sof\s/);
      const isBlacklist = isType(/Auto\sblacklist\sof\s/);
      const isUnwatch = isType(/Auto\sunwatch\sof\s/);
      const isUnblacklist = isType(/Auto\sunblacklist\sof/);
      if (isWatch) {
        Domains.watchedWebsites.push(newRegex);
      } else if (isBlacklist) {
        Domains.watchedWebsites = Domains.watchedWebsites.filter(regexMatch);
        Domains.blacklistedWebsites.push(newRegex);
      } else if (isUnwatch) {
        Domains.watchedWebsites = Domains.watchedWebsites.filter(regexMatch);
      } else if (isUnblacklist) {
        Domains.blacklistedWebsites = Domains.blacklistedWebsites.filter(regexMatch);
      }
    } catch (error) {
      return;
    }
  }
  function newChatEventOccurred({ event_type, user_id, content }) {
    if (user_id !== smokedetectorId && user_id !== metasmokeId || event_type !== 1) return;
    updateWatchesAndBlacklists(content);
    getUpdatedPrInfo(content).then((newGithubPrInfo) => Domains.githubPullRequests = newGithubPrInfo || []).catch((error) => console.error(error));
  }

  // src/dom_utils.ts
  function getWaitGif() {
    const waitGif = document.createElement("img");
    waitGif.classList.add("fire-extra-wait");
    waitGif.src = "/content/img/progress-dots.gif";
    return waitGif;
  }
  function getTick() {
    const greenTick = document.createElement("span");
    greenTick.classList.add("fire-extra-green");
    greenTick.innerHTML = "\u2713";
    return greenTick;
  }
  function getCross() {
    const redCross = document.createElement("span");
    redCross.classList.add("fire-extra-red");
    redCross.innerHTML = "\u2717";
    return redCross;
  }
  function getWatchBlacklistButtons() {
    const container = document.createElement("div");
    const watchButton = document.createElement("a");
    watchButton.classList.add("fire-extra-watch");
    watchButton.style.display = "none";
    watchButton.innerHTML = "!!/watch";
    const blacklistButton = document.createElement("a");
    blacklistButton.classList.add("fire-extra-blacklist");
    blacklistButton.style.display = "none";
    blacklistButton.innerHTML = "!!/blacklist";
    container.append(watchButton, blacklistButton);
    return container;
  }
  function getMsResultsElement(escapedDomain) {
    const container = document.createElement("div");
    const anchor = document.createElement("a");
    anchor.href = helpers.getMetasmokeSearchUrl(escapedDomain);
    anchor.innerHTML = "MS";
    const stats = document.createElement("span");
    stats.classList.add("fire-extra-ms-stats");
    stats.append(getWaitGif());
    container.append(anchor, ": ", stats);
    return container;
  }
  function getSeResultsSpan(searchTerm) {
    const seResults = document.createElement("span");
    seResults.classList.add("fire-extra-se-results");
    const seResultsLink = document.createElement("a");
    seResultsLink.href = getSeUrl(searchTerm);
    seResultsLink.append(getWaitGif());
    seResults.append(seResultsLink);
    return seResults;
  }
  function getResultsContainer(term) {
    const escaped = term.replace(/\./g, "\\.");
    const container = document.createElement("div");
    container.style.marginRight = "7px";
    const metasmokeResults = getMsResultsElement(escaped);
    const stackResults = getSeResultsSpan(term);
    container.append("(", metasmokeResults, " | ", stackResults, ")");
    return container;
  }
  function getInfoContainer() {
    const container = document.createElement("div");
    const watchInfo = document.createElement("span");
    watchInfo.classList.add("fire-extra-watch-info");
    watchInfo.append("\u{1F440}: ", getWaitGif());
    const blacklistInfo = document.createElement("span");
    blacklistInfo.classList.add("fire-extra-blacklist-info");
    blacklistInfo.append("\u{1F6AB}: ", getWaitGif());
    container.append("(", watchInfo, "/", blacklistInfo, ")");
    return container;
  }
  function createTag(tagName) {
    const tag = document.createElement("span");
    tag.innerHTML = `#${tagName}`;
    tag.classList.add("fire-extra-tag");
    return tag;
  }
  function getColouredSpan(feedbackCount, feedback) {
    const feedbackType = helpers.pluralise(feedback.toUpperCase(), feedbackCount);
    const tooltipText = `${feedbackCount} ${feedbackType}`;
    const span = document.createElement("span");
    span.classList.add(`fire-extra-${feedback}`);
    span.setAttribute("fire-tooltip", tooltipText);
    span.innerHTML = feedbackCount.toString();
    return span;
  }
  function getColouredSpans([tpCount, fpCount, naaCount]) {
    const feedbacks = [
      {
        count: tpCount,
        type: "tp"
      },
      {},
      {
        count: fpCount,
        type: "fp"
      },
      {},
      {
        count: naaCount,
        type: "naa"
      }
    ];
    return feedbacks.map(({ count, type }) => type ? getColouredSpan(count, type) : ", ");
  }
  var getGithubPrUrl = (prId) => `//github.com/${sdGithubRepo}/pull/${prId}`;
  var getPrTooltip = ({ id, regex, author, type }) => `${author} wants to ${type} ${regex.source} in PR#${id}`;
  function getPendingPrElement(githubPrOpenItem) {
    const prId = githubPrOpenItem.id;
    const container = document.createElement("div");
    const anchor = document.createElement("a");
    anchor.href = getGithubPrUrl(prId);
    anchor.innerHTML = `PR#${prId}`;
    anchor.setAttribute("fire-tooltip", getPrTooltip(githubPrOpenItem));
    const approve = document.createElement("a");
    approve.classList.add("fire-extra-approve");
    approve.innerHTML = "!!/approve";
    approve.setAttribute("fire-tooltip", `!!/approve ${prId}`);
    container.append(anchor, " pending ", approve);
    return container;
  }
  function updateSeCount(count, domainLi) {
    if (!domainLi) return;
    const hitCountAnchor = domainLi.querySelector(".fire-extra-se-results a");
    if (!hitCountAnchor) return;
    const tooltipText = `${count} ${helpers.pluralise("hit", Number(count))} on SE`;
    hitCountAnchor.innerHTML = `SE: ${count}`;
    hitCountAnchor.setAttribute("fire-tooltip", tooltipText);
  }
  function updateMsCounts(counts, domainLi) {
    const msStats = domainLi?.querySelector(".fire-extra-ms-stats");
    if (!msStats) return;
    msStats.replaceChildren(...getColouredSpans(counts));
  }
  async function triggerDomainUpdate(domainIdsValid) {
    const domainStats = await Domains.getTpFpNaaCountFromDomains(domainIdsValid) || {};
    return Object.entries(domainStats).flatMap(([domainName, feedbackCount]) => {
      const domainId = helpers.getDomainId(domainName);
      const domainLi = document.getElementById(domainId);
      if (!domainLi) return [];
      updateMsCounts(feedbackCount, domainLi);
      Domains.allDomainInformation[domainName].metasmoke = feedbackCount;
      return [domainName];
    });
  }

  // src/index.ts
  var metasmokeSearchUrl = "https://metasmoke.erwaysoftware.com/search";
  var helpers = {
    // should be the same as "See the MS search here" text in PRs
    getMetasmokeSearchUrl: (term) => {
      const searchTerm = term.includes(".") ? term : helpers.getRegexForPathShortener(term);
      const bodyParam = `(?s:\\b${searchTerm}\\b)`;
      const parameters = `?utf8=\u2713&body_is_regex=1&body=${bodyParam}`;
      const fullUrl = metasmokeSearchUrl + parameters;
      return encodeURI(fullUrl);
    },
    // Follow https://charcoal-se.org/smokey/Guidance-for-Blacklisting-and-Watching:
    qualifiesForWatch: ([tpCount, fpCount, naaCount], seHits) => {
      return tpCount >= 1 && tpCount < 5 && fpCount + naaCount === 0 && Number(seHits) < 10;
    },
    qualifiesForBlacklist: ([tpCount, fpCount, naaCount], seHits) => {
      return tpCount >= 5 && fpCount + naaCount === 0 && Number(seHits) < 5;
    },
    // given a regexes array and a domain, find if the latter is matched by any items in the former
    isCaught: (regexes, domain) => regexes.some((regex) => regex.test(domain)),
    // get the id the domain li has - dots are replaced with dash
    getDomainId: (domainName) => `fire-extra-${domainName.replace(/\./g, "-")}`,
    // helper to pluralise strings
    pluralise: (word, count) => `${word}${count === 1 ? "" : "s"}`,
    // the tooltip text of 👀 or 🚫
    getActionDone: (action, isDone) => {
      const yesNo = isDone ? "yes" : "no";
      return `${action}: ${yesNo}`;
    },
    // the tooltip text of !!/watch, !!/blacklist buttons
    getButtonsText: (action, term, done, domain) => {
      const command = action === "watch" ? "!!/watch-" : "!!/blacklist-website-";
      const alreadyDone = "action already taken";
      const watchValue = domain ? helpers.getRegexForPathShortener(term, domain) : term.replace(/blogspot\.\w+(\.\w+)?$/, "blogspot").replace(/\./g, "\\.");
      return done ? alreadyDone : `${command} ${watchValue}`;
    },
    // (?-i:) - case sensitive
    // (?#)   - the shortener domain
    getRegexForPathShortener: (path, domain) => {
      const escaped = path.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
      const mainPart = `(?-i:${escaped})`;
      const comment = `(?#${domain || ""})`;
      return `${mainPart}${domain ? comment : ""}`;
    }
  };
  function updateEmojisInformation(term) {
    const {
      stackexchange: seResultCount,
      metasmoke: metasmokeStats
    } = Domains.allDomainInformation[term];
    const domainId = helpers.getDomainId(term);
    const domainLi = document.getElementById(domainId);
    const domainName = term.includes(".") ? "" : domainLi?.parentElement?.parentElement?.firstChild?.textContent;
    if (!seResultCount || !metasmokeStats?.length) return;
    const isWatched = helpers.isCaught(Domains.watchedWebsites, term);
    const isBlacklisted = helpers.isCaught(Domains.blacklistedWebsites, term);
    const qualifiesForWatch = helpers.qualifiesForWatch(metasmokeStats, seResultCount);
    const qualifiesForBlacklist = helpers.qualifiesForBlacklist(metasmokeStats, seResultCount);
    const watch = {
      human: helpers.getActionDone("watched", isWatched),
      tooltip: helpers.getButtonsText("watch", term, isWatched || isBlacklisted, domainName),
      suggested: qualifiesForWatch && !isWatched && !isBlacklisted
    };
    const blacklist = {
      human: helpers.getActionDone("blacklisted", isBlacklisted),
      tooltip: helpers.getButtonsText("blacklist", term, isBlacklisted, domainName),
      suggested: qualifiesForBlacklist && !isBlacklisted
    };
    const watchInfo = domainLi?.querySelector(".fire-extra-watch-info");
    const blacklistInfo = domainLi?.querySelector(".fire-extra-blacklist-info");
    if (!watchInfo || !blacklistInfo) return;
    watchInfo.setAttribute("fire-tooltip", watch.human);
    blacklistInfo.setAttribute("fire-tooltip", blacklist.human);
    watchInfo.replaceChildren("\u{1F440}: ", isWatched ? getTick() : getCross());
    blacklistInfo.replaceChildren("\u{1F6AB}: ", isBlacklisted ? getTick() : getCross());
    const watchButton = domainLi?.querySelector(".fire-extra-watch");
    const blacklistButton = domainLi?.querySelector(".fire-extra-blacklist");
    if (!watchButton || !blacklistButton) return;
    if (watch.suggested) watchButton.append(" ", getTick());
    if (blacklist.suggested) blacklistButton.append(" ", getTick());
    if (!isBlacklisted) {
      blacklistButton.style.display = "inline";
      if (!isWatched) {
        watchButton.style.display = "inline";
      }
    }
    watchButton.setAttribute("fire-tooltip", watch.tooltip);
    blacklistButton.setAttribute("fire-tooltip", blacklist.tooltip);
  }
  function updateStackSearchResultCount(term, domainLi) {
    getSeSearchResults(term).then((hitCount) => {
      Domains.allDomainInformation[term].stackexchange = hitCount;
      updateSeCount(hitCount, domainLi);
      const infoObject = Domains.allDomainInformation[term];
      if (!infoObject.metasmoke || !infoObject.stackexchange) return;
      updateEmojisInformation(term);
    }).catch((error) => {
      toastr.error(error);
      console.error(error);
    });
  }
  function updateMsResults(term, domainLi) {
    getMsSearchResults(term).then((results) => {
      Domains.allDomainInformation[term].metasmoke = results;
      updateMsCounts(results, domainLi);
      const infoObject = Domains.allDomainInformation[term];
      if (!infoObject.metasmoke || !infoObject.stackexchange) return;
      updateEmojisInformation(term);
    }).catch((error) => {
      toastr.error(error);
      console.error(error);
    });
  }
  function addChatListeners(domainItem, githubPr) {
    const watchButton = domainItem.querySelector(".fire-extra-watch");
    const blacklistButton = domainItem.querySelector(".fire-extra-blacklist");
    addActionListener(watchButton);
    addActionListener(blacklistButton);
    if (githubPr) {
      const approveButton = domainItem.querySelector(".fire-extra-approve");
      addActionListener(approveButton);
    }
  }
  function createHTMLForGivenList(domainName, domainItem) {
    const pullRequests = Domains.githubPullRequests;
    const githubPrOpenItem = pullRequests.find(({ regex }) => regex.test(domainName));
    const buttonContainer = getWatchBlacklistButtons();
    const actionsArea = githubPrOpenItem ? getPendingPrElement(githubPrOpenItem) : buttonContainer;
    const resultsContainer = getResultsContainer(domainName);
    const infoContainer = getInfoContainer();
    domainItem.append(resultsContainer, actionsArea, infoContainer);
    updateStackSearchResultCount(domainName, domainItem);
    addChatListeners(domainItem, githubPrOpenItem);
  }
  function createDomainHtml(domainName, domainList, child = false) {
    Domains.allDomainInformation[domainName] = {};
    const elementType = child ? "ul" : "li";
    const domainItem = document.createElement(elementType);
    domainItem.id = helpers.getDomainId(domainName) + (child ? "-children" : "");
    if (child) {
      domainItem.style.marginLeft = "15px";
      const pathnames = [...document.querySelectorAll(".fire-reported-post a")].map((anchor) => new URL(anchor.href)).filter((url) => url.host === domainName).map((url) => url.pathname.replace("/", ""));
      const uniquePathnames = [...new Set(pathnames)];
      uniquePathnames.forEach((pathname) => createDomainHtml(pathname, domainItem));
      domainList.append(domainItem);
      return;
    } else if (!domainName.includes(".")) {
      updateMsResults(domainName, domainItem);
      domainItem.append(domainName, " ");
    } else {
      domainItem.append(domainName, " ");
    }
    domainList.append(domainItem);
    if (Domains.whitelistedDomains.includes(domainName)) {
      domainItem.append(createTag("whitelisted"));
      return;
    } else if (Domains.redirectors.includes(domainName) && !child) {
      domainItem.append(createTag("shortener"));
      createDomainHtml(domainName, domainItem, true);
      return;
    }
    createHTMLForGivenList(domainName, domainItem);
  }
  async function addHtmlToFirePopup() {
    const reportedPostDiv = document.querySelector(".fire-reported-post");
    const fireMsButton = document.querySelector(".fire-metasmoke-button");
    const nativeSeLink = [...new URL(fireMsButton?.href || "").searchParams][0][1];
    const metasmokePostId = fire.reportCache[nativeSeLink].id;
    const domains = await getAllDomainsFromPost(metasmokePostId);
    if (!domains.length) return;
    const divider = document.createElement("hr");
    const dataWrapperElement = document.createElement("div");
    dataWrapperElement.classList.add("fire-extra-functionality");
    const header = document.createElement("h3");
    header.innerText = "Domains";
    dataWrapperElement.append(header);
    reportedPostDiv?.insertAdjacentElement("afterend", dataWrapperElement);
    reportedPostDiv?.insertAdjacentElement("afterend", divider);
    const domainList = document.createElement("ul");
    domainList.classList.add("fire-extra-domains-list");
    const domainIdsValid = domains.filter(
      (domainObject) => !Domains.whitelistedDomains.includes(domainObject.domain) && !Domains.redirectors.includes(domainObject.domain)
    ).map((item) => item.id);
    triggerDomainUpdate(domainIdsValid).then((domainNames) => domainNames.forEach((name) => updateEmojisInformation(name))).catch((error) => toastr.error(error));
    domains.map((item) => item.domain).forEach((domain) => createDomainHtml(domain, domainList));
    dataWrapperElement.append(domainList);
  }
  void async function() {
    if (!globalThis.window) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Domains.fetchAllDomainInformation();
    CHAT.addEventHandlerHook((event) => {
      const eventToPass = Object.assign({
        ...event,
        // because we can't use DOMParser with tests,
        // newChatEventOccurred has to accept a Document argument for content
        content: new DOMParser().parseFromString(event.content, "text/html")
      });
      newChatEventOccurred(eventToPass);
    });
    window.addEventListener("fire-popup-open", () => {
      void addHtmlToFirePopup();
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
  }();
})();
