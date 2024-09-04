import { build } from 'esbuild';
import info from './package.json' with { type: 'json' };

const svgsNeeded = ['Checkmark', 'Clear', 'EyeOff', 'Flag', 'Pencil', 'Trash'];
const svgsUrls = svgsNeeded.map(svgName => {
    return `// @resource     icon${svgName} https://cdn.sstatic.net/Img/stacks-icons/${svgName}.svg`;
});

const userscriptHeader = `// ==UserScript==
// @name         FIRE Additional Functionality
// @version      ${info.version}
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
/* globals fire, toastr, CHAT */\n`;


await build({
    entryPoints: [ 'src/index.ts' ],
    bundle: true,
    banner: {
        js: userscriptHeader
    },
    external: ['node-fetch'],
    outfile: 'dist/fire_extra.user.js',
});