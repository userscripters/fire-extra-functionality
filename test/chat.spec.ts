import { expect } from 'chai';
import jsdom from 'jsdom';
import { newChatEventOccurred } from '../src/chat.js';
import { Domains } from '../src/domain_stats.js';
import { helpers } from '../src/index.js';
const { JSDOM } = jsdom;

type ChatMessageActions = 'watch' | 'unwatch' | 'blacklist' | 'unblacklist';
function getRandomChatMessage(originalChatMessage: string, actionType: ChatMessageActions, escapedDomain: string): string {
    // linuxbuz\\.com is the (escaped domain) that's watched in the original message
    return originalChatMessage.replace('Auto watch', `Auto ${actionType}`).replace('linuxbuz\\.com', escapedDomain);
}

describe('chat helpers', function() {
    this.timeout(5e3); // before hook can timeout

    before(async () => await Domains.fetchAllDomainInformation());
    it('should update watches or blacklists based on the content of a chat message', async () => {
        const chatMessageCall = await fetch('https://chat.stackexchange.com/message/58329215');
        const chatMessageContent = await chatMessageCall.text();

        const messages = [
            'watch random-domain\\.com',
            'blacklist random-random-domain\\.com',  
            'unwatch random-domain\\.com',
            'unblacklist tenderpublish',
            'watch domain\\.with\\.a\\.few\\.dots\\.com',
            'blacklist domain\\.with\\.many\\.many\\.dots\\.com',
            'blacklist nayvi' // the keyword is watched
        ];
        messages
            .map(message => {
                const messageSplit = message.split(' ');
                const actionType = messageSplit[0] as ChatMessageActions;
                const domain = messageSplit[1];

                const fullMessage = getRandomChatMessage(chatMessageContent, actionType, domain)

                return new JSDOM(fullMessage).window.document;
            })
            // "post messages"
            .forEach(message => newChatEventOccurred({ event_type: 1, user_id: 120914, content: message }));

        const {
            watchedWebsites: watchedDomains,
            blacklistedWebsites: blacklistedDomains
        } = Domains;

        // random-domain.com was first watched, then unwatched and shouldn't be in the watchlist
        expect(helpers.isCaught(watchedDomains, 'random-domain.com')).to.be.false;
        expect(helpers.isCaught(blacklistedDomains, 'random-random-domain.com')).to.be.true;
        expect(helpers.isCaught(blacklistedDomains, 'tenderpublish')).to.be.false; // was unblacklisted
        expect(helpers.isCaught(watchedDomains, 'domain.with.a.few.dots.com')).to.be.true;
        expect(helpers.isCaught(blacklistedDomains, 'domain.with.many.many.dots.com')).to.be.true;

        // nayvi was blacklisted, therefore it shouldn't be in the watchlist, but in the blacklist
        expect(helpers.isCaught(watchedDomains, 'nayvi')).to.be.false;
        expect(helpers.isCaught(blacklistedDomains, 'nayvi')).to.be.true;

        // a user id other than SD's one shouldn't change the watchlist or the blacklist
        const randomMessage = new JSDOM(getRandomChatMessage(chatMessageContent, 'watch', 'example\\.com')).window.document;
        newChatEventOccurred({ event_type: 1, user_id: 123456, content: randomMessage }); // not Smokey's id
        newChatEventOccurred({ event_type: 12, user_id: 120914, content: randomMessage }); // not interested in that event type
        expect(helpers.isCaught(watchedDomains, 'example.com')).to.be.false;
    });
});