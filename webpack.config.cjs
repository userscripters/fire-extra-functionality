const path = require('path');
const webpack = require('webpack'); // for the banner plugin
const userscriptInfo = require('./package.json');
const { default: ResolveTypeScriptPlugin } = require("resolve-typescript-plugin");

module.exports = {
    entry: './src/index.ts',
    mode: 'none',
    target: 'node',
    output: {
        filename: './fire_extra.user.js',
        iife: true
    },
    experiments: {
        topLevelAwait: true
    },
    resolve: {
        // Add '.ts' and '.tsx' as a resolvable extension.
        extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.js']
    },
    plugins: [
        new webpack.BannerPlugin({
            raw: true,
            banner: `// ==UserScript==
                     // @name         FIRE Additional Functionality
                     // @version      ${userscriptInfo.version}
                     // @author       double-beep
                     // @contributor  Xnero
                     // @description  Watch, blacklist and see domain stats directly from the FIRE popup!
                     // @match       *://chat.stackexchange.com/transcript/*
                     // @match       *://chat.meta.stackexchange.com/transcript/*
                     // @match       *://chat.stackoverflow.com/transcript/*
                     // @match       *://chat.stackexchange.com/users/120914/*
                     // @match       *://chat.stackexchange.com/users/120914?*
                     // @match       *://chat.stackoverflow.com/users/3735529/*
                     // @match       *://chat.stackoverflow.com/users/3735529?*
                     // @match       *://chat.meta.stackexchange.com/users/266345/*
                     // @match       *://chat.meta.stackexchange.com/users/266345?*
                     // @match       *://chat.stackexchange.com/users/478536/*
                     // @match       *://chat.stackexchange.com/users/478536?*
                     // @match       *://chat.stackoverflow.com/users/14262788/*
                     // @match       *://chat.stackoverflow.com/users/14262788?*
                     // @match       *://chat.meta.stackexchange.com/users/848503/*
                     // @match       *://chat.meta.stackexchange.com/users/848503?*
                     // @include     /^https?://chat\.stackexchange\.com/(?:rooms/|search.*[?&]room=)(?:11|27|95|201|388|468|511|2165|3877|8089|11540|22462|24938|34620|35068|38932|46061|47869|56223|58631|59281|61165|65945|84778|96491|106445|109836|109841|129590)(?:[&/].*$|$)/
                     // @include     /^https?://chat\.meta\.stackexchange\.com/(?:rooms/|search.*[?&]room=)(?:89|1037|1181)(?:[&/].*$|$)/
                     // @include     /^https?://chat\.stackoverflow\.com/(?:rooms/|search.*[?&]room=)(?:41570|90230|111347|126195|167826|170175|202954)(?:[&/].*$|$)/
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
                     /* globals fire, toastr, CHAT */`.replace(/^\s+/mg, '')
        })
    ],
    externals: {
        'node-fetch': 'fetch', // added for tests, already native in modern browsers
    },
    module: {
        rules: [
            // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
            {
                test: /\.tsx?$/,
                include: path.resolve(__dirname, 'src'),
                loader: 'ts-loader'
            }
        ]
    },
    // until WebPack supports .js imports:
    resolve: {
        fullySpecified: true,
        plugins: [new ResolveTypeScriptPlugin()]
    }
};