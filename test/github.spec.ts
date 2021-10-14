/* eslint-disable no-tabs, no-unused-expressions */
import { expect } from 'chai';
import { helpers } from '../src/index.js';
import * as github from '../src/github.js';
import jsdom from "jsdom";
const { JSDOM } = jsdom;

global.document = new JSDOM().window.document;

const watchedKeywordsExample = String.raw`1494929269	tripleee	thewellnesscorner\.com
1494929399	tripleee	optisolbusiness\.com
1494997469	tripleee	careinfo\.in
1494997580	tripleee	carebaba\.com
1494999587	tripleee	punjabimp3club\.com
1495002561	tripleee	erozon
1495005325	tripleee	onlinesupplementworld\.com
1495006487	tripleee	ahealthadvisory\.com`;
const blacklistedKeywordsExample = String.raw`resolit\.us
techinpost\.com
hackerscontent\.com
hrsoftwaresolution\.com
qboffers\.com
webbuildersguide\.com
idealshare\.net
lankabpoacademy\.com`;

const sampleGithubApiResponse: github.GithubApiResponse[] = [
    {
        number: 1,
        title: 'Xnero: Watch goodhousekeeping\\.com',
        state: 'open',
        user: {
            id: 11063859
        }
    }, {
        number: 2038,
        title: 'double-beep: Watch example\\.com',
        state: 'closed', // shouldn't happen because the default filter is state=open
        user: {
            id: 11063859
        }
    }, {
        number: 4829,
        title: 'username: Watch some-domain\\.with\\.dots\\.com',
        state: 'open',
        user: {
            id: 11063859
        }
    }, {
        number: 2883,
        title: 'username: Watch some-domain\\.com',
        state: 'open',
        user: {
            id: 11362834 // not SmokeDetector
        }
    }
];

describe('github helpers', () => {
    it('should correctly parse the content of sample keywords files', () => {
        const watchedParsed = github.getRegexesFromTxtFile(watchedKeywordsExample, 2);
        const blacklistedParsed = github.getRegexesFromTxtFile(blacklistedKeywordsExample, 0);
        const allParsed = watchedParsed.concat(blacklistedParsed);

        // for watches we need to split and get the third column
        const watchedNoBackslashes = watchedKeywordsExample.replace(/\\/mg, '').split('\n').map(line => line.split('\t')[2]);
        const blacklistedNoBackslashes = blacklistedKeywordsExample.replace(/\\/mg, '').split('\n');
        expect(allParsed.every(item => item instanceof RegExp)); // make sure they're all regexes
        // the array should contain the right regexes
        expect(watchedNoBackslashes.every(keyword => helpers.isCaught(watchedParsed, keyword))).to.be.true;
        expect(blacklistedNoBackslashes.every(keyword => helpers.isCaught(blacklistedParsed, keyword))).to.be.true;
    });

    it('should correctly parse a sample GH API response', () => {
        const parsedContent = github.parsePullRequestDataFromApi(sampleGithubApiResponse);
        expect(parsedContent.length).to.equal(2);

        const [firstItem, secondItem] = parsedContent;
        expect(firstItem.regex.test('goodhousekeeping.com')).to.be.true;
        expect(secondItem.regex.test('some-domain.with.dots.com')).to.be.true;

        const firstExpectedTooltip = 'Xnero wants to watch goodhousekeeping\\.com in PR#1';
        const secondExpectedTooltip = 'username wants to watch some-domain\\.with\\.dots\\.com in PR#4829';

        const firstPrItem = github.getPendingPrElement(firstItem);
        const secondPrItem = github.getPendingPrElement(secondItem);

        const firstPrLink = firstPrItem.firstElementChild as HTMLAnchorElement;
        expect(firstPrLink.href).to.be.equal('//github.com/Charcoal-SE/SmokeDetector/pull/1');
        expect(firstPrLink.getAttribute('fire-tooltip')).to.be.equal(firstExpectedTooltip);
        expect(firstPrLink.innerHTML).to.be.equal('PR#1');

        const firstApprove = firstPrItem.querySelector('.fire-extra-approve');
        expect(firstApprove?.getAttribute('fire-tooltip')).to.be.equal('!!/approve 1');
        expect(firstApprove?.innerHTML).to.be.equal('!!/approve');

        const secondPrLink = secondPrItem.firstElementChild as HTMLAnchorElement;
        expect(secondPrLink.href).to.be.equal('//github.com/Charcoal-SE/SmokeDetector/pull/4829');
        expect(secondPrLink.getAttribute('fire-tooltip')).to.be.equal(secondExpectedTooltip);
        expect(secondPrLink.innerHTML).to.be.equal('PR#4829');

        const secondApprove = secondPrItem.querySelector('.fire-extra-approve');
        expect(secondApprove?.getAttribute('fire-tooltip')).to.be.equal('!!/approve 4829');
        expect(secondApprove?.innerHTML).to.be.equal('!!/approve');
    });

    it('should find if a PR is opened, closed or merged and update the list accordingly', async () => {
        const validChatMessages = [
            '<a href="//github.com/...">PR#1823</a> ("Xnero: Watch goodhousekeeping\\.com") opened by SmokeDetector',
            '@user Closed pull request <a href="https://github.com/...">#2934</a>.',
            'Blacklists reloaded at <a href="//domain.com">rev ... (SmokeDetector: Merge pull request #10...)</a>...'
        ];
        validChatMessages.forEach(async message => {
            const parsedMessageHtml = new JSDOM(message).window.document;
            const functionReturnValue = await github.getUpdatedPrInfo(parsedMessageHtml);
            expect(functionReturnValue).not.to.be.undefined;
        });

        const irrelevantMessage = 'This is an unrelated message about a pull request';
        expect(await github.getUpdatedPrInfo(new JSDOM(irrelevantMessage).window.document)).to.be.undefined;
    });
});