import fs from "fs";
import path from 'path';
import webpack from "webpack";
const { BannerPlugin } = webpack; // for the banner plugin

const { version } = fs.readFileSync("./package.json");

const src = path.resolve(process.cwd(), 'src');

const fallback = () => {
    const paths = fs.readdirSync(src);
    const output = {};
    paths.forEach((mpath) =>
        output[`./${mpath.replace(".ts", ".js")}`] = path.join(src, mpath));
    return output;
};

export default /** @type {webpack.Configuration} */({
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
        extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.js'],
        fallback: fallback()
    },
    plugins: [
        new BannerPlugin({
            raw: true,
            banner: `// ==UserScript==
                     // @name        FIRE Additional Functionality
                     // @version     ${version}
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
                     // The script only runs on Charcoal HQ (11540) for now.`.replace(/^\s+/mg, '')
        }),
    ],
    module: {
        rules: [
            // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
            {
                test: /\.tsx?$/,
                include: path.resolve(src),
                loader: 'ts-loader'
            }
        ]
    }
});