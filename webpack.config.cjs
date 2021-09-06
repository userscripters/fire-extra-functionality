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
                     // @name        FIRE Additional Functionality
                     // @version     ${userscriptInfo.version}
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
                     // NOTE: after installing this script, you need to modify FIRE. Add this line:
                     //     window.dispatchEvent(new CustomEvent('fire-popup-appeared'));
                     // before L1253 - hideReportImages(). This will fire an event when the FIRE popup opens which this userscript listens to.
                     // The script only runs on Charcoal HQ (11540) for now.`.replace(/^\s+/mg, '')
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