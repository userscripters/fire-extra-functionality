import { expect } from 'chai';
import { Domains } from '../src/domain_stats';

describe('whitelisted domains and URL shorteners', () => {
    before(async () => await Domains.fetchAllDomainInformation());

    it('should correctly recognise whitelisted domains', () => {
        [
            'docs.google.com',
            'www.google.com',
            'sites.google.com',
            'www.sites.google.com',
            'www.google.ae',
            'play.google.com',
            'www.dropbox.com',
            'developers.google.com',
            'dba.stackexchange.com',
            'imgur.com',
            'localhost',
            'maps.google.com',
            'accounts.google.com',
            'wiki.ubuntu.com',
            'system-image.ubuntu.com',
            'meta.stackexchange.com',
            'i.imgur.com',
            'workplace.stackexchange.com',
            'superuser.com',
        ].forEach(domain => {
            const isWhitelisted = Domains.whitelisted.includes(domain);
            const isRedirector = Domains.redirectors.includes(domain);

            expect(isWhitelisted && !isRedirector).to.be.true; // can't be both
        });

        // shouldn't return true for just parts of URLs
        [
            'ocs.google.co',
            'uperuser.com',
            'ers.google.com'
        ].forEach(domain => {
            const isWhitelisted = Domains.whitelisted.includes(domain);

            expect(isWhitelisted).to.be.false;
        });
    });

    it('should correctly recognise URL shorteners', () => {
        [
            'cl.ly',
            'clck.ru',
            'clk.ink',
            'cut-urls.com',
            'cutt.ly',
            'firsturl.de',
            'git.io',
            'goo.gl',
            'is.gd',
            'linktr.ee',
            'lish.ir',
            'lnkd.in',
            'murl.com',
            'n9.cl',
            'ow.ly',
            'pin.it',
        ].forEach(domain => {
            const isWhitelisted = Domains.whitelisted.includes(domain);
            const isRedirector = Domains.redirectors.includes(domain);

            expect(!isWhitelisted && isRedirector).to.be.true; // can't be both
        });

        [
            'inktr.ee',
            'sh.ir',
            'rl.co'
        ].forEach(domain => {
            const isWhitelisted = Domains.whitelisted.includes(domain);

            expect(isWhitelisted).to.be.false;
        });
    });
});
