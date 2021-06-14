/* eslint-disable no-tabs, no-unused-expressions */
import { expect } from 'chai';
import { indexHelpers } from '../src/index';
import * as github from '../src/github';
import { JSDOM } from 'jsdom';

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
        expect(watchedNoBackslashes.every(keyword => indexHelpers.isCaught(watchedParsed, keyword))).to.be.true;
        expect(blacklistedNoBackslashes.every(keyword => indexHelpers.isCaught(blacklistedParsed, keyword))).to.be.true;
    });

    it('should correctly parse a sample GH API response', () => {
        const parsedContent = github.parsePullRequestDataFromApi(sampleGithubApiResponse);
        expect(parsedContent.length).to.equal(2);

        const [firstItem, secondItem] = parsedContent;
        expect(firstItem.regex.test('goodhousekeeping.com')).to.be.true;
        expect(secondItem.regex.test('some-domain.with.dots.com')).to.be.true;

        // also test getPendingPrHtml while verifying the *Item's properties are correct
        const firstItemHtml = '<a href="//github.com/Charcoal-SE/SmokeDetector/pull/1" '
                            + 'fire-tooltip="Xnero wants to watch goodhousekeeping\\.com in PR#1">PR#1</a>'
                            + '&nbsp;pending <a class="fire-extra-approve" fire-tooltip="!!/approve 1">!!/approve</a>&nbsp;&nbsp;';
        const secondItemHtml = '<a href="//github.com/Charcoal-SE/SmokeDetector/pull/4829" '
                             + 'fire-tooltip="username wants to watch some-domain\\.with\\.dots\\.com in PR#4829">PR#4829</a>&nbsp;'
                             + 'pending <a class="fire-extra-approve" fire-tooltip="!!/approve 4829">!!/approve</a>&nbsp;&nbsp;';
        expect(github.getPendingPrHtml(firstItem)).to.be.equal(firstItemHtml);
        expect(github.getPendingPrHtml(secondItem)).to.be.equal(secondItemHtml);
    });

    it('should find if a PR is opened, closed or merged and update the list accordingly', async () => {
        const validChatMessages = [
            '<a href="//github.com/...">PR#1823</a> ("Xnero: Watch goodhousekeeping\\.com") opened by SmokeDetector',
            '@user Closed pull request <a href="https://github.com/...">#2934</a>.',
            'Blacklists reloaded at <a href="//domain.com">rev ... (SmokeDetector: Merge pull request #10...)</a>...'
        ];
        validChatMessages.forEach(async message => {
            const parsedMessageHtml = new JSDOM(message).window.document;
            const functionReturnValue = await github.getUpdatedGithubPullRequestInfo(parsedMessageHtml);
            expect(functionReturnValue).not.to.be.undefined;
        });
        const irrelevantMessage = 'This is an unrelated message about a pull request';
        expect(await github.getUpdatedGithubPullRequestInfo(new JSDOM(irrelevantMessage).window.document)).to.be.undefined;
    });
});