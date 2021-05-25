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
