import { expect } from 'chai';
import jsdom from 'jsdom';
import { newChatEventOccurred } from '../src/chat';
import { Domains } from '../src/domain_stats';
import { helpers } from '../src/index';

const { JSDOM } = jsdom;

type ChatMessageActions = 'watch' | 'unwatch' | 'blacklist' | 'unblacklist';

function getRandomMessage(
    original: string,
    action: ChatMessageActions,
    escapedDomain: string
): string {
    // linuxbuz\\.com is the (escaped domain) that's watched in the original message
    return original
      .replace("Auto watch", `Auto ${action}`)
      .replace("linuxbuz\\.com", escapedDomain);
}

describe('chat helpers', function() {
    this.timeout(5e3); // before hook can timeout

    before(async () => await Domains.fetchAllDomainInformation());

    it('should update watches or blacklists based on the content of a chat message', async () => {
        const call = await fetch('https://chat.stackexchange.com/message/58329215');
        const chatMessage = await call.text();

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

                const fullMessage = getRandomMessage(chatMessage, actionType, domain)

                return new JSDOM(fullMessage).window.document;
            })
            // "post messages"
            .forEach(message => {
                newChatEventOccurred(
                    {
                        event_type: 1,
                        user_id: 120914,
                        content: message
                    }
                );
            });

        const {
            watchedWebsites: watched,
            blacklistedWebsites: blacklisted
        } = Domains;

        const { isCaught } = helpers;

        // random-domain.com was first watched, then unwatched and shouldn't be in the watchlist
        expect(isCaught(watched, 'random-domain.com')).to.be.false;
        expect(isCaught(blacklisted, 'random-random-domain.com')).to.be.true;
        expect(isCaught(blacklisted, 'tenderpublish')).to.be.false; // was unblacklisted
        expect(isCaught(watched, 'domain.with.a.few.dots.com')).to.be.true;
        expect(isCaught(blacklisted, 'domain.with.many.many.dots.com')).to.be.true;

        // nayvi was blacklisted, therefore it shouldn't be in the watchlist, but in the blacklist
        expect(isCaught(watched, 'nayvi')).to.be.false;
        expect(isCaught(blacklisted, 'nayvi')).to.be.true;

        // a user id other than SD's one shouldn't change the watchlist or the blacklist
        const random = new JSDOM(getRandomMessage(chatMessage, 'watch', 'example\\.com')).window.document;

        newChatEventOccurred({ event_type: 1, user_id: 123456, content: random }); // not Smokey's id
        newChatEventOccurred({ event_type: 12, user_id: 120914, content: random }); // not interested in that event type

        expect(isCaught(watched, 'example.com')).to.be.false;
    });
});