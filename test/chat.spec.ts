/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import jsdom from 'jsdom';
import fetch from 'node-fetch';
import { newChatEventOccurred } from '../src/chat.js';
import { Domains } from '../src/domain_stats.js';
import { indexHelpers } from '../src/index.js';
const { JSDOM } = jsdom;

type ChatMessageActions = 'watch' | 'unwatch' | 'blacklist' | 'unblacklist';
function getRandomChatMessage(originalChatMessage: string, actionType: ChatMessageActions, escapedDomain: string): string {
    // linuxbuz\\.com is the (escaped domain) that's watched in the original message
    return originalChatMessage.replace('Auto watch', `Auto ${actionType}`).replace('linuxbuz\\.com', escapedDomain);
}

describe('chat helpers', function () {

    this.timeout(5e3); // before hook can timeout

    before(async () => await Domains.fetchAllDomainInformation());
    it('should update watches or blacklists based on the content of a chat message', async () => {
        const chatMessageCall = await fetch('https://chat.stackexchange.com/message/58329215');
        const chatMessageContent = await chatMessageCall.text();
        const randomMessages = [
            getRandomChatMessage(chatMessageContent, 'watch', 'random-domain\\.com'),
            getRandomChatMessage(chatMessageContent, 'blacklist', 'random-random-domain\\.com'),
            getRandomChatMessage(chatMessageContent, 'unwatch', 'random-domain\\.com'),
            getRandomChatMessage(chatMessageContent, 'unblacklist', 'tenderpublish'), // keyword actually exists
            getRandomChatMessage(chatMessageContent, 'watch', 'domain\\.with\\.a\\.few\\.dots\\.com'),
            getRandomChatMessage(chatMessageContent, 'blacklist', 'domain\\.with\\.many\\.many\\.dots\\.com'),
            getRandomChatMessage(chatMessageContent, 'blacklist', 'nayvi') // test if item is removed from the watchlist
        ].map(message => new JSDOM(message).window.document);

        randomMessages.forEach(message => newChatEventOccurred({ event_type: 1, user_id: 120914, content: message }));
        // random-domain.com was first watched, then unwatched and shouldn't be in the watchlist
        expect(indexHelpers.isCaught(Domains.watchedWebsitesRegexes, 'random-domain.com')).to.be.false;
        expect(indexHelpers.isCaught(Domains.blacklistedWebsitesRegexes, 'random-random-domain.com')).to.be.true;
        expect(indexHelpers.isCaught(Domains.blacklistedWebsitesRegexes, 'tenderpublish')).to.be.false; // was unblacklisted
        expect(indexHelpers.isCaught(Domains.watchedWebsitesRegexes, 'domain.with.a.few.dots.com')).to.be.true;
        expect(indexHelpers.isCaught(Domains.blacklistedWebsitesRegexes, 'domain.with.many.many.dots.com')).to.be.true;

        // nayvi was blacklisted, therefore it shouldn't be in the watchlist, but in the blacklist
        expect(indexHelpers.isCaught(Domains.watchedWebsitesRegexes, 'nayvi')).to.be.false;
        expect(indexHelpers.isCaught(Domains.blacklistedWebsitesRegexes, 'nayvi')).to.be.true;

        // a user id other than SD's one shouldn't change the watchlist or the blacklist
        const randomMessage = new JSDOM(getRandomChatMessage(chatMessageContent, 'watch', 'example\\.com')).window.document;
        newChatEventOccurred({ event_type: 1, user_id: 123456, content: randomMessage }); // not Smokey's id
        newChatEventOccurred({ event_type: 12, user_id: 120914, content: randomMessage }); // not en event type we're interested in
        expect(indexHelpers.isCaught(Domains.watchedWebsitesRegexes, 'example.com')).to.be.false;
    });
});