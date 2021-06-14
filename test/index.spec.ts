/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { Domains } from '../src/domain_stats';
import { indexHelpers } from '../src/index';

describe('index helpers', () => {
    before(async () => await Domains.fetchAllDomainInformation());
    it('should find if a domain with specific stats qualifies for watch', () => {
        expect(indexHelpers.qualifiesForWatch([1, 0, 0], '0')).to.be.true;
        expect(indexHelpers.qualifiesForWatch([5, 0, 0], '10')).to.be.false;
        expect(indexHelpers.qualifiesForWatch([1, 0, 1], '2')).to.be.false;
    });

    it('should find if a domain with specific stats qualifies for blacklist', () => {
        expect(indexHelpers.qualifiesForBlacklist([5, 0, 0], '4')).to.be.true;
        expect(indexHelpers.qualifiesForBlacklist([10, 0, 0], '5')).to.be.false;
        expect(indexHelpers.qualifiesForBlacklist([10, 2, 0], '4')).to.be.false;
    });

    it('should get the correct li id given a domain', () => {
        expect(indexHelpers.getDomainId('stackoverflow.com')).to.be.equal('fire-extra-stackoverflow-com');
        expect(indexHelpers.getDomainId('many.many.dots.here')).to.be.equal('fire-extra-many-many-dots-here');
    });

    it('should return valid and correct MS search URLs', () => {
        // test the whitelisted domains and the redirectors which are all valid domains
        Domains.whitelistedDomains.concat(Domains.redirectors).split('\n').forEach(domainName => {
            const urlObject = new URL(indexHelpers.getMetasmokeSearchUrl(domainName));
            expect(urlObject.searchParams.get('body')).to.be.equal(`(?s:\\b${domainName}\\b)`);
        });
    });

    it('should figure out if a domain is caught or not', () => {
        const validWatches = ['essayssos.com', 'trimfire', 'dream-night-tours'], invalidWatches = ['non-existent-keyword, google.com'];
        validWatches.forEach(keyword => expect(indexHelpers.isCaught(Domains.watchedWebsitesRegexes, keyword)).to.be.true);
        invalidWatches.forEach(keyword => expect(indexHelpers.isCaught(Domains.watchedWebsitesRegexes, keyword)).to.be.false);

        const validBlacklists = ['powerigfaustralia', 'ewebtonic.in', 'beautyskin'], invalidBlacklists = invalidWatches;
        validBlacklists.forEach(keyword => expect(indexHelpers.isCaught(Domains.blacklistedWebsitesRegexes, keyword)).to.be.true);
        invalidBlacklists.forEach(keyword => expect(indexHelpers.isCaught(Domains.blacklistedWebsitesRegexes, keyword)).to.be.false);
    });
});