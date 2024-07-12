import { expect } from 'chai';
import { helpers } from '../src/index';
import { getPendingPrElement } from '../src/dom_utils';
import {
    GithubApiResponse,
    getRegexesFromTxtFile,
    getUpdatedPrInfo,
    parseApiResponse
} from '../src/github';
import jsdom from "jsdom";
import { Domains } from '../src/domain_stats';

const { JSDOM } = jsdom;

global.document = new JSDOM().window.document;

const watchSample = String.raw
`1494929269	tripleee	thewellnesscorner\.com
1494929399	tripleee	optisolbusiness\.com
1494997469	tripleee	careinfo\.in
1494997580	tripleee	carebaba\.com
1494999587	tripleee	punjabimp3club\.com
1495002561	tripleee	erozon
1495005325	tripleee	onlinesupplementworld\.com
1495006487	tripleee	ahealthadvisory\.com`;
const blacklistedSample = String.raw
`resolit\.us
techinpost\.com
hackerscontent\.com
hrsoftwaresolution\.com
qboffers\.com
webbuildersguide\.com
idealshare\.net
lankabpoacademy\.com`;

const sampleGithubApiResponse: GithubApiResponse[] = [
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
        const watchedParsed = getRegexesFromTxtFile(watchSample, 2);
        const blacklistedParsed = getRegexesFromTxtFile(blacklistedSample, 0);
        const allParsed = watchedParsed.concat(blacklistedParsed);

        // for watches we need to split and get the third column
        const watches = watchSample
            .replace(/\\/mg, '')
            .split('\n')
            .map(line => line.split('\t')[2]);

        const blacklists = blacklistedSample
            .replace(/\\/mg, '')
            .split('\n');

        expect(allParsed.every(item => item instanceof RegExp)).to.be.true; // make sure they're all regexes

        const oldWatched = Domains.watched;
        const oldBlacklisted = Domains.blacklisted;

        Domains.watched = watchedParsed;
        Domains.blacklisted = blacklistedParsed;

        // the array should contain the right regexes
        expect(watches.every(keyword => helpers.isWatched(keyword))).to.be.true;
        expect(blacklists.every(keyword => helpers.isBlacklisted(keyword))).to.be.true;

        Domains.watched = oldWatched;
        Domains.blacklisted = oldBlacklisted;
    });

    it('should correctly parse a sample GH API response', () => {
        const parsed = parseApiResponse(sampleGithubApiResponse);
        expect(parsed.length).to.equal(2);

        const [first, second] = parsed;
        expect(first.regex.test('goodhousekeeping.com')).to.be.true;
        expect(second.regex.test('some-domain.with.dots.com')).to.be.true;

        const firstExpectedTooltip = 'Xnero wants to watch goodhousekeeping\\.com in PR#1';
        const secondExpectedTooltip = 'username wants to watch some-domain\\.with\\.dots\\.com in PR#4829';

        const firstPrItem = getPendingPrElement(first);
        const secondPrItem = getPendingPrElement(second);

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
            const content = new JSDOM(message).window.document;

            const text = content.body?.innerHTML || '';
            const functionReturnValue = await getUpdatedPrInfo(text);

            expect(functionReturnValue).not.to.be.undefined;
        });

        const irrelevantMessage = 'This is an unrelated message about a pull request';
        expect(await getUpdatedPrInfo(irrelevantMessage)).to.be.undefined;
    });
});