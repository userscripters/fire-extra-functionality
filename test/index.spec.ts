import { expect } from 'chai';
import { Domains } from '../src/domain_stats';
import { helpers } from '../src/index';

describe('index helpers', () => {
    before(async () => await Domains.fetchAllDomainInformation());

    it('should find if a domain with specific stats qualifies for watch', () => {
        expect(helpers.qualifiesForWatch([1, 0, 0], '0')).to.be.true;
        expect(helpers.qualifiesForWatch([5, 0, 0], '10')).to.be.false;
        expect(helpers.qualifiesForWatch([1, 0, 1], '2')).to.be.false;
    });

    it('should find if a domain with specific stats qualifies for blacklist', () => {
        expect(helpers.qualifiesForBlacklist([5, 0, 0], '4')).to.be.true;
        expect(helpers.qualifiesForBlacklist([10, 0, 0], '5')).to.be.false;
        expect(helpers.qualifiesForBlacklist([10, 2, 0], '4')).to.be.false;
    });

    it('should get the correct li id given a domain', () => {
        const data = {
            'stackoverflow.com': 'fire-extra-stackoverflow-com',
            'many.many.dots.here': 'fire-extra-many-many-dots-here'
        };

        Object
            .entries(data)
            .forEach(([ domain, expected ]) => {
                const domainId = helpers.getDomainId(domain);

                expect(domainId).to.be.equal(expected);
            });
    });

    it('should return valid and correct MS search URLs', () => {
        // test the whitelisted domains and the redirectors which are all valid domains
        [...Domains.whitelisted, ...Domains.redirectors]
            .filter(domain => domain.includes('.')) // exclude exception
            .map(domain => domain.replace(/\./g, '\\.'))
            .forEach(domainName => {
                const msSearchUrl = helpers.getMetasmokeSearchUrl(domainName);
                const url = new URL(msSearchUrl);

                const title = url.searchParams.get('title');
                const body = url.searchParams.get('body');
                const username = url.searchParams.get('username');

                expect(body)
                    .to.be.equal(title)
                    .to.be.equal(username)
                    .to.be.equal(
                        helpers.isBlacklisted(
                            // unescape
                            domainName.replace(/\\./g, '.')
                        )
                            ? `(?i)${domainName}`
                            : String.raw`(?s)${domainName}(?<=(?:^|\b)${domainName})(?:\b|$)`
                    );

                const or = url.searchParams.get('or_search');
                expect(or).to.equal('1');
            });

        const searchUrl = helpers.getMetasmokeSearchUrl('speakatoo\\.com');
        const url = new URL(searchUrl);
        const body = url.searchParams.get('body');

        expect(body).to.be.equal(`(?i)speakatoo\\.com`);
    });

    it('should figure out if a domain is caught or not', () => {
        const { isWatched, isBlacklisted } = helpers;

        const validWatches = ['essayssos.com', 'trimfire', 'erozon', 'saleleads.net', 'SaleLeads.net'];
        const invalidWatches = ['non-existent-keyword', 'google.com'];
        validWatches.forEach(keyword => expect(isWatched(keyword)).to.be.true);
        invalidWatches.forEach(keyword => expect(isWatched(keyword)).to.be.false);

        const validBlacklists = [
            // blacklisted websites
            'powerigfaustralia',
            'ewebtonic.in',
            'healthcaresup',
            'd680adc632091138ed9fd09659e15dc9',

            // bad keywords
            'orvigomax',
            'opstree.com'
        ];
        const invalidBlacklists = [
            ...invalidWatches,
            'blog.opstree.com' // test negative lookbehind
        ];

        validBlacklists.forEach(keyword => expect(isBlacklisted(keyword)).to.be.true);
        invalidBlacklists.forEach(keyword => expect(isBlacklisted(keyword)).to.be.false);

        // https://github.com/Charcoal-SE/SmokeDetector/wiki/Commands#non--number-blacklists-and-watchlist
        const partialW = ['randessayssos.com.com', 'atrimfire'];
        partialW.forEach(keyword => expect(isWatched(keyword)).to.be.false);

        const notPartialW = ['!erozon', '.SaleLeads.net', '.ESSAYssos.com'];
        notPartialW.forEach(keyword => expect(isWatched(keyword)).to.be.true);

        const partialB = ['testpowerigfaustralia', '!healthcaresup', '@ewebtonic.in'];
        partialB.forEach(keyword => expect(isBlacklisted(keyword)).to.be.true);
    });

    it('should correctly pluralise words', () => {
        expect(helpers.pluralise('hit', 1)).to.be.equal('hit');
        expect(helpers.pluralise('hit', 0)).to.be.equal('hits');
        expect(helpers.pluralise('hit', 100)).to.be.equal('hits');
    });

    it('should correctly fetch accurate tooltip texts for the emojis', () => {
        expect(helpers.getActionDone('watched', true)).to.be.equal('watched: yes');
        expect(helpers.getActionDone('watched', false)).to.be.equal('watched: no');

        expect(helpers.getActionDone('blacklisted', true)).to.be.equal('blacklisted: yes');
        expect(helpers.getActionDone('blacklisted', false)).to.be.equal('blacklisted: no');
    });

    it('should correctly fetch accurate tooltip texts for !!/watch and !!/blacklist', () => {
        const watchedNoAction = helpers.getButtonsText('watch', 'example.com', true);
        const blacklistedNoAction = helpers.getButtonsText('blacklist', 'example.com', true);

        const watchExampleCom = helpers.getButtonsText('watch', 'example.com', false);
        const blacklistManyDots = helpers.getButtonsText('blacklist', 'many.dots..com', false);

        expect(watchedNoAction).to.be.equal(blacklistedNoAction);
        expect(watchExampleCom).to.be.equal('!!/watch- example\\.com');
        expect(blacklistManyDots).to.be.equal('!!/blacklist-website- many\\.dots\\.\\.com');

        const watchShortenerPath = helpers.getButtonsText('watch', 'FNEuyd', false, 'goo.gl');
        expect(watchShortenerPath).to.be.equal('!!/watch- (?-i:FNEuyd)(?#goo.gl)');

        const watchBlogspotCom = helpers.getButtonsText('watch', 'abc.blogspot.com', false);
        const watchBlogspotDe = helpers.getButtonsText('watch', 'abc.blogspot.de', false);

        expect(watchBlogspotCom)
            .to.be.equal(watchBlogspotDe)
            .to.be.equal('!!/watch- abc\\.blogspot');
    });

    it('should correctly fetch the correct regex for paths of shorteners', () => {
        Object.entries(
            {
                '3vcWir3': ['bit.ly', '(?-i:3vcWir3)(?#bit.ly)'],
                'FNEuyd': ['goo.gl', '(?-i:FNEuyd)(?#goo.gl)'],
                'KdxEAt91D7k': ['youtu.be', '(?-i:KdxEAt91D7k)(?#youtu.be)'],
                // escape +
                '+jJyLwSpqLeAzNmFi': ['t.me', String.raw`(?-i:\+jJyLwSpqLeAzNmFi)(?#t.me)`],
                // don't escape /
                'davitacols/dataDisk': ['github repository', String.raw`(?-i:davitacols/dataDisk)(?#github repository)`],
                'arjun.muralidharan2': ['facebook', String.raw`(?-i:arjun\.muralidharan2)(?#facebook)`],
                // don't escape -
                'example-test': ['bit.ly', String.raw`(?-i:example-test)(?#bit.ly)`],
            }
        ).forEach(([path, info]) => {
            const [domain, expectedValue] = info;
            const withDomain = helpers.getRegexForPathShortener(path, domain);
            const withoutDomain = helpers.getRegexForPathShortener(path);

            const expectedNoComment = expectedValue.replace(/\(\?#.*/, '');

            expect(withDomain).to.be.equal(expectedValue);
            expect(withoutDomain).to.be.equal(expectedNoComment);
        });
    });
});
