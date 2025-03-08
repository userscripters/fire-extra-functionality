// ==UserScript==
// @name         FIRE Additional Functionality
// @version      1.4.2
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
  async function getGraphQLInformation(idsArray) {
    const query = getDomainPostsQuery(idsArray);
    const payload = {
      query,
      variables: null
    };
    const url = `https://metasmoke.erwaysoftware.com/api/graphql?key=${metasmokeApiKey}`;
    const call = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!call.ok) {
      const text = await call.text();
      console.error(text);
      throw new Error(`Failed to fetch information from GraphQL with error ${call.status}.`);
    }
    const response = await call.json();
    if ("errors" in response) {
      console.error(response);
      throw new Error("Failed to fetch information from GraphQL. See console for more details.");
    }
    return response;
  }
  function getPostCounts(parsedHtml) {
    const tabsSelector = '.nav-tabs li:not([role="presentation"])';
    const counts = [...parsedHtml.querySelectorAll(tabsSelector)].map((element) => /\d+/.exec(element.textContent?.trim() || "")?.[0]).map(Number);
    return counts.length ? counts : [0, 0, 0];
  }
  function getMsSearchResults(term) {
    const url = new URL("https://metasmoke.erwaysoftware.com/search");
    url.searchParams.set("utf8", "\u2713");
    url.searchParams.set("body", term);
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url.toString(),
        onload: (response) => {
          const { status, responseText } = response;
          if (status === 200) {
            const domParser = new DOMParser();
            const parsedHtml = domParser.parseFromString(responseText, "text/html");
            resolve(getPostCounts(parsedHtml));
          } else {
            reject(`Failed to get search results for ${term} on metasmoke search.`);
            console.error(response);
          }
        },
        onerror: ({ responseText }) => reject(responseText)
      });
    });
  }
  async function getAllDomainsFromPost(metasmokePostId) {
    const url = new URL(`${metasmokeApiBase}${metasmokePostId}/domains`);
    url.searchParams.set("key", metasmokeApiKey);
    url.searchParams.set("filter", postDomainsApiFilter);
    url.searchParams.set("per_page", "100");
    const apiCallResponse = await fetch(url.toString());
    const jsonResponse = await apiCallResponse.json();
    return jsonResponse.items;
  }

  // src/github.ts
  var sdGithubRepo = "Charcoal-SE/SmokeDetector";
  var sdGhId = 11063859;
  var githubUrls = {
    api: `https://api.github.com/repos/${sdGithubRepo}/pulls`,
    whitelisted: "https://raw.githubusercontent.com/userscripters/fire-extra-functionality/master/ini/whitelisted_domains.txt",
    redirectors: "https://raw.githubusercontent.com/userscripters/fire-extra-functionality/master/ini/redirectors.txt",
    watched: "https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/watched_keywords.txt",
    blacklisted: "https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/blacklisted_websites.txt",
    bad: "https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/bad_keywords.txt"
  };
  function makeRegexESCompatible(keyword) {
    const shortenerPathRegex = /\(\?-i:(\w+)\)\(\?#\s*[a-zA-Z.]+\)/;
    const path = shortenerPathRegex.exec(keyword)?.[1];
    if (!path) return [];
    else return [new RegExp(path, "s")];
  }
  function getRegexesFromTxtFile(fileContent, position) {
    return fileContent.split("\n").flatMap((line) => {
      const keyword = line.split("	")[position];
      if (!keyword) return [];
      let regexToReturn;
      try {
        regexToReturn = new RegExp(
          // https://github.com/Charcoal-SE/SmokeDetector/wiki/Commands#non--number-blacklists-and-watchlist
          position === 2 ? `\\b${keyword}\\b` : keyword,
          "is"
        );
      } catch {
        return makeRegexESCompatible(keyword);
      }
      return [regexToReturn];
    });
  }
  function parseApiResponse(jsonData) {
    return jsonData.filter((item) => item.user.id === sdGhId && item.state === "open").flatMap((item) => {
      const { number, title } = item;
      let regex;
      try {
        regex = new RegExp(/(?:Watch|Blacklist)\s(.*)/.exec(title)?.[1] || "");
      } catch {
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
  async function getUpdatedPrInfo(message) {
    const prChanged = /Closed pull request |Merge pull request|opened by SmokeDetector/;
    if (!prChanged.test(message)) return;
    const call = await fetch(githubUrls.api);
    const response = await call.json();
    return parseApiResponse(response);
  }

  // src/domain_stats.ts
  var Domains = class {
    // contains both the SE hit count and the MS feedbacks
    static allDomainInformation = {};
    static watched = [];
    static blacklisted;
    static pullRequests;
    static whitelisted;
    static redirectors;
    static async fetchAllDomainInformation() {
      if (this.watched.length) return;
      const [
        watchedCall,
        blacklistedCall,
        prsCall,
        whitelistedCall,
        redirectorsCall,
        badCall
      ] = await Promise.all([
        fetch(githubUrls.watched),
        fetch(githubUrls.blacklisted),
        fetch(githubUrls.api),
        fetch(githubUrls.whitelisted),
        fetch(githubUrls.redirectors),
        fetch(githubUrls.bad)
      ]);
      const [
        watched,
        blacklisted,
        prs,
        whitelisted,
        redirectors,
        bad
      ] = await Promise.all([
        watchedCall.text(),
        blacklistedCall.text(),
        prsCall.json(),
        whitelistedCall.text(),
        redirectorsCall.text(),
        badCall.text()
      ]);
      const badRegexes = getRegexesFromTxtFile(blacklisted, 0);
      const blacklistedRegexes = getRegexesFromTxtFile(bad, 0);
      this.watched = getRegexesFromTxtFile(watched, 2);
      this.blacklisted = badRegexes.concat(blacklistedRegexes);
      this.pullRequests = parseApiResponse(prs);
      this.whitelisted = whitelisted.split("\n");
      this.redirectors = redirectors.split("\n");
    }
    static async getTpFpNaaCountFromDomains(domainIds) {
      if (!domainIds.length) return {};
      const domainStats = {};
      try {
        const results = await getGraphQLInformation(domainIds);
        if ("errors" in results) return {};
        results.data.spam_domains.forEach(({ posts, domain }) => {
          const stats = ["tp", "fp", "naa"].map((feedback) => posts.filter((post) => post[`is_${feedback}`]).length);
          domainStats[domain] = stats;
        });
      } catch (error) {
        if (error instanceof Error) {
          toastr.error(error.message);
        }
        console.error("Error while trying to fetch domain stats from GraphiQL.", error);
      }
      return domainStats;
    }
  };

  // src/chat.ts
  var charcoalHq = 11540;
  var smokeyId = 120914;
  var metasmokeId = 478536;
  async function sendMessage(element) {
    const message = element.getAttribute("fire-tooltip");
    const fkeyEl = document.querySelector('input[name="fkey"]');
    const fkey = fkeyEl?.value;
    if (!fkey) throw new Error("Chat fkey not found");
    else if (!message) throw new Error("No message found");
    const params = new FormData();
    params.append("text", message);
    params.append("fkey", fkey);
    const url = `/chats/${charcoalHq}/messages/new`;
    const call = await fetch(url, {
      method: "POST",
      body: params
    });
    if (call.status !== 200 || !call.ok) {
      throw new Error(
        `Failed to send message to chat. Returned error is ${call.status}`
      );
    }
    const response = await call.json();
    if (!response.id || !response.time) {
      throw new Error("Failed to send message to chat!");
    }
  }
  function addListener(element) {
    if (!element) return;
    element.addEventListener("click", async () => {
      try {
        await sendMessage(element);
        toastr.success("Successfully sent message to chat.");
      } catch (error) {
        toastr.error(error);
        console.error("Error while sending message to chat.", error);
      }
    });
  }
  function updateKeywordLists(regex, action) {
    try {
      const newRegex = new RegExp(regex, "is");
      const compare = (regexp) => regexp.source !== newRegex.source && regexp.source !== `\\b${newRegex.source}\\b`;
      switch (action) {
        case "watch": {
          const modified = new RegExp(`\\b${newRegex.source}\\b`, "si");
          Domains.watched.push(modified);
          break;
        }
        case "blacklist":
          Domains.watched = Domains.watched.filter(compare);
          Domains.blacklisted.push(newRegex);
          break;
        case "unwatch":
          Domains.watched = Domains.watched.filter(compare);
          break;
        case "unblacklist":
          Domains.blacklisted = Domains.blacklisted.filter(compare);
          break;
        default:
      }
    } catch {
      return;
    }
  }
  function parseChatMessage(content) {
    const message = content.body.innerHTML || "";
    const autoReloadOf = /SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/;
    if (!autoReloadOf.test(message) || !message.includes("Blacklists reloaded at")) return;
    const regexText = content.querySelectorAll("code")[1].innerHTML;
    const anchorHtml = content.querySelectorAll("a")[1].innerHTML;
    const action = ["watch", "unwatch", "blacklist", "unblacklist"].find((word) => {
      const regex = new RegExp(`Auto\\s${word}\\sof\\s`);
      return regex.test(anchorHtml);
    }) || "watch";
    updateKeywordLists(regexText, action);
  }
  function newChatEventOccurred({ event_type, user_id, content }, updateGithub = true) {
    if (user_id !== smokeyId && user_id !== metasmokeId || event_type !== 1) return;
    parseChatMessage(content);
    const message = content.body.innerHTML || "";
    const prId = Number(/Merge pull request #(\d+)/.exec(message)?.[1]);
    const pr = Domains.pullRequests.find(({ id }) => id === prId);
    if (pr && prId) {
      const { regex, type } = pr;
      updateKeywordLists(regex.source, type);
      Domains.pullRequests = Domains.pullRequests.filter(({ id }) => id !== prId);
    }
    if (!updateGithub) return;
    getUpdatedPrInfo(message).then((info) => {
      Domains.pullRequests = (info || []).filter(({ id }) => id !== prId);
    }).catch((error) => console.error(error));
  }

  // src/stackexchange.ts
  function getSeUrl(searchTerm) {
    const base = "https://stackexchange.com/search?q=";
    const isUrl = searchTerm.includes(".");
    return isUrl ? `${base}url%3A${searchTerm}` : `${base}${searchTerm}`;
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
  function getButton(action) {
    const button = document.createElement("a");
    button.classList.add(`fire-extra-${action}`);
    button.style.display = "none";
    button.innerHTML = `!!/${action}`;
    return button;
  }
  function getWatchBlacklistButtons() {
    const container = document.createElement("div");
    const watch = getButton("watch");
    const blacklist = getButton("blacklist");
    container.append(watch, blacklist);
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
    const results = document.createElement("span");
    results.classList.add("fire-extra-se-results");
    const link = document.createElement("a");
    link.href = getSeUrl(searchTerm);
    link.append(getWaitGif());
    results.append(link);
    return results;
  }
  function getResultsContainer(term) {
    const escaped = term.replace(/\./g, "\\.");
    const container = document.createElement("div");
    container.style.marginRight = "7px";
    const metasmoke = getMsResultsElement(escaped);
    const stack = getSeResultsSpan(term);
    container.append("(", metasmoke, " | ", stack, ")");
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
  function getTag(name) {
    const tag = document.createElement("span");
    tag.innerHTML = `#${name}`;
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
      {
        count: fpCount,
        type: "fp"
      },
      {
        count: naaCount,
        type: "naa"
      }
    ];
    return feedbacks.map(({ count, type }) => getColouredSpan(count, type)).flatMap((item, i) => i === feedbacks.length - 1 ? [item] : [item, ", "]);
  }
  function getPendingPrElement(pr) {
    const { author, type, regex, id } = pr;
    const container = document.createElement("div");
    const anchor = document.createElement("a");
    anchor.href = `//github.com/${sdGithubRepo}/pull/${id}`;
    anchor.innerHTML = `PR#${id}`;
    const text = `${author} wants to ${type} ${regex.source} in PR#${id}`;
    anchor.setAttribute("fire-tooltip", text);
    const approve = document.createElement("a");
    approve.classList.add("fire-extra-approve");
    approve.innerHTML = "!!/approve";
    approve.setAttribute("fire-tooltip", `!!/approve ${id}`);
    container.append(anchor, " pending ", approve);
    return container;
  }
  function updateSeCount(count, domainLi) {
    if (!domainLi || !count) return;
    const hitCountAnchor = domainLi.querySelector(".fire-extra-se-results a");
    if (!hitCountAnchor) return;
    hitCountAnchor.innerHTML = "SE search";
  }
  function updateMsCounts(counts, domainLi) {
    const msStats = domainLi?.querySelector(".fire-extra-ms-stats");
    if (!msStats) return;
    msStats.replaceChildren(...getColouredSpans(counts));
  }
  async function triggerDomainUpdate(domainIdsValid) {
    const domainStats = await Domains.getTpFpNaaCountFromDomains(domainIdsValid);
    return Object.entries(domainStats).flatMap(([domainName, feedbackCount]) => {
      const domainId = helpers.getDomainId(domainName);
      const domainLi = document.getElementById(domainId);
      if (!domainLi) return [];
      updateMsCounts(feedbackCount, domainLi);
      if (Domains.allDomainInformation[domainName]) {
        Domains.allDomainInformation[domainName].metasmoke = feedbackCount;
      } else {
        Domains.allDomainInformation[domainName] = {
          metasmoke: feedbackCount,
          stackexchange: "0"
        };
      }
      return [domainName];
    });
  }

  // src/index.ts
  var metasmokeSearchUrl = "https://metasmoke.erwaysoftware.com/search";
  var helpers = {
    generateSearchRegex: (text) => {
      let searchTerm = `(?s)(?:^|\\b)${text}(?:\\b|$)`;
      const textNoNoncaptureGroups = text.replace(/\(\?:/g, "(").replace(/\(\?-i:([^()]+)\)/, "$1");
      const regex = /^(\w+(?![?*+{])|\(\?-i:[^+?*{}()|]+\)\w*(?![?*+{]))/;
      if (!/[+?*{}()|]/.test(textNoNoncaptureGroups)) {
        searchTerm = `(?s)${text}(?<=(?:^|\\b)${text})(?:\\b|$)`;
      } else if (regex.test(text)) {
        const replaced = text.replace(
          regex,
          "$1(?<=(?:^|\\b)$1)"
        );
        searchTerm = `(?s)${replaced}(?:\\b|$)`;
      }
      return searchTerm;
    },
    // should be the same as "See the MS search here" text in PRs
    getMetasmokeSearchUrl: (term) => {
      const text = term.includes(".") ? term : helpers.getRegexForPathShortener(term);
      const unescaped = term.replace(/\\./g, ".");
      const searchTerm = helpers.isBlacklisted(unescaped) ? `(?i)${text}` : helpers.generateSearchRegex(text);
      const url = new URL(metasmokeSearchUrl);
      url.searchParams.set("utf8", "\u2713");
      url.searchParams.set("or_search", "1");
      url.searchParams.set("title_is_regex", "1");
      url.searchParams.set("body_is_regex", "1");
      url.searchParams.set("username_is_regex", "1");
      url.searchParams.set("title", searchTerm);
      url.searchParams.set("body", searchTerm);
      url.searchParams.set("username", searchTerm);
      return url.toString();
    },
    // Follow https://charcoal-se.org/smokey/Guidance-for-Blacklisting-and-Watching:
    qualifiesForWatch: ([tpCount, fpCount, naaCount], seHits) => {
      return tpCount >= 1 && tpCount < 5 && fpCount + naaCount === 0 && Number(seHits) < 10;
    },
    qualifiesForBlacklist: ([tpCount, fpCount, naaCount], seHits) => {
      return tpCount >= 5 && fpCount + naaCount === 0 && Number(seHits) < 5;
    },
    // find if given string exists in the watchlist/blacklist
    // returns the last regex from that list which matches that string
    isCaught: (type, domain) => {
      const regexes = Domains[`${type}ed`];
      return regexes.findLast((regex) => regex.test(domain));
    },
    isWatched: (domain) => helpers.isCaught("watch", domain),
    isBlacklisted: (domain) => Boolean(helpers.isCaught("blacklist", domain)),
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
    getButtonsText: (action, term, done, domain, regex) => {
      const command = action === "watch" ? "!!/watch-" : "!!/blacklist-website-";
      const alreadyDone = "action already taken";
      const watchValue = domain ? helpers.getRegexForPathShortener(term, domain) : term.replace(/blogspot\.\w+(\.\w+)?$/, "blogspot").replace(/\./g, "\\.");
      const replacement = regex?.source.slice(2, -2).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      return done ? alreadyDone : `${command} ${action === "blacklist" && regex ? replacement : watchValue}`;
    },
    // (?-i:) - case sensitive
    // (?#)   - the shortener domain
    getRegexForPathShortener: (path, domain) => {
      const escaped = path.replace(/[+\\^$*?.()|[\]{}]/g, "\\$&");
      const mainPart = `(?-i:${escaped})`;
      const comment = `(?#${domain || ""})`;
      return `${mainPart}${domain ? comment : ""}`;
    }
  };
  function updateEmojisInformation(term) {
    if (!Domains.allDomainInformation[term]) return;
    const {
      stackexchange: seResultCount,
      metasmoke: metasmokeStats = []
    } = Domains.allDomainInformation[term];
    const domainId = helpers.getDomainId(term);
    const domainLi = document.getElementById(domainId);
    const domainName = term.includes(".") ? "" : domainLi?.parentElement?.parentElement?.firstChild?.textContent;
    if (!seResultCount || !metasmokeStats.length) return;
    const isWatched = helpers.isWatched(term);
    const isBlacklisted = helpers.isBlacklisted(term);
    const qualifiesForWatch = helpers.qualifiesForWatch(metasmokeStats, seResultCount);
    const qualifiesForBlacklist = helpers.qualifiesForBlacklist(metasmokeStats, seResultCount);
    const watch = {
      human: helpers.getActionDone("watched", Boolean(isWatched)),
      tooltip: helpers.getButtonsText("watch", term, Boolean(isWatched) || isBlacklisted, domainName),
      suggested: qualifiesForWatch && !isWatched && !isBlacklisted
    };
    const blacklist = {
      human: helpers.getActionDone("blacklisted", isBlacklisted),
      tooltip: helpers.getButtonsText("blacklist", term, isBlacklisted, domainName, isWatched),
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
    new Promise((resolve) => resolve("0")).then((hitCount) => {
      if (!Domains.allDomainInformation[term]) return;
      Domains.allDomainInformation[term].stackexchange = hitCount;
      updateSeCount(hitCount, domainLi);
      updateEmojisInformation(term);
    }).catch((error) => {
      toastr.error(error);
      console.error(error);
    });
  }
  function updateMsResults(term, domainLi) {
    getMsSearchResults(term).then((results) => {
      if (!Domains.allDomainInformation[term]) return;
      Domains.allDomainInformation[term].metasmoke = results;
      updateMsCounts(results, domainLi);
      updateEmojisInformation(term);
    }).catch((error) => {
      toastr.error(error);
      console.error(error);
    });
  }
  function addChatListeners(domainItem, githubPr) {
    const watchButton = domainItem.querySelector(".fire-extra-watch");
    const blacklistButton = domainItem.querySelector(".fire-extra-blacklist");
    addListener(watchButton);
    addListener(blacklistButton);
    if (githubPr) {
      const approveButton = domainItem.querySelector(".fire-extra-approve");
      addListener(approveButton);
    }
  }
  function createHTMLForGivenList(domainName, domainItem) {
    const pullRequests = Domains.pullRequests;
    const githubPrOpenItem = pullRequests.find(({ regex }) => regex.test(domainName));
    const buttonContainer = getWatchBlacklistButtons();
    const actionsArea = githubPrOpenItem ? getPendingPrElement(githubPrOpenItem) : buttonContainer;
    const resultsContainer = getResultsContainer(domainName);
    const infoContainer = getInfoContainer();
    domainItem.append(resultsContainer, actionsArea, infoContainer);
    updateStackSearchResultCount(domainName, domainItem);
    addChatListeners(domainItem, githubPrOpenItem);
  }
  function createDomainHtml(name, list, child = false) {
    Domains.allDomainInformation[name] = {};
    const elementType = child ? "ul" : "li";
    const domainItem = document.createElement(elementType);
    domainItem.id = helpers.getDomainId(name) + (child ? "-children" : "");
    if (child) {
      domainItem.style.marginLeft = "15px";
      const pathnames = [...document.querySelectorAll(".fire-reported-post a")].map((anchor) => new URL(anchor.href)).filter((url) => url.host === name).map((url) => url.pathname.replace("/", ""));
      const uniquePathnames = [...new Set(pathnames)];
      if (!uniquePathnames.every(Boolean)) return;
      uniquePathnames.forEach((pathname) => createDomainHtml(pathname, domainItem));
      list.append(domainItem);
      return;
    } else if (!name.includes(".")) {
      updateMsResults(name, domainItem);
      domainItem.append(name, " ");
    } else {
      domainItem.append(name, " ");
    }
    list.append(domainItem);
    if (Domains.whitelisted.includes(name)) {
      domainItem.append(getTag("whitelisted"));
      return;
    } else if (Domains.redirectors.includes(name)) {
      domainItem.append(getTag("shortener"));
      createDomainHtml(name, domainItem, true);
      return;
    }
    createHTMLForGivenList(name, domainItem);
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
      (domainObject) => !Domains.whitelisted.includes(domainObject.domain) && !Domains.redirectors.includes(domainObject.domain)
    ).map((item) => item.id);
    triggerDomainUpdate(domainIdsValid).then((domainNames) => domainNames.forEach((name) => updateEmojisInformation(name))).catch((error) => toastr.error(error));
    domains.map((item) => item.domain).forEach((domain) => createDomainHtml(domain, domainList));
    dataWrapperElement.append(domainList);
  }
  void async function() {
    if (!globalThis.window) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Domains.fetchAllDomainInformation();
    const domParser = new DOMParser();
    CHAT.addEventHandlerHook((event) => {
      const eventToPass = Object.assign({
        ...event,
        // because we can't use DOMParser with tests,
        // newChatEventOccurred has to accept a Document argument for content
        content: domParser.parseFromString(event.content, "text/html")
      });
      newChatEventOccurred(eventToPass);
    });
    try {
      const fkey = document.querySelector("#fkey")?.value;
      const formData = new FormData();
      formData.append("since", "0");
      formData.append("mode", "Messages");
      formData.append("msgCount", "100");
      formData.append("fkey", fkey || "");
      const request = await fetch(
        "https://chat.stackexchange.com/chats/11540/events",
        {
          method: "POST",
          body: formData
        }
      );
      const response = await request.json();
      response.events.filter(({ event_type, content }) => event_type === 1 && content).forEach((event) => {
        const parsed = Object.assign({
          ...event,
          content: domParser.parseFromString(event.content, "text/html")
        });
        newChatEventOccurred(parsed, false);
      });
    } catch (error) {
      console.error(error);
    }
    window.addEventListener("fire-popup-open", () => {
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
  }();
})();
