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

async function getMessage(id: number): Promise<string> {
    const call = await fetch(`https://chat.stackexchange.com/message/${id}`);
    const message = await call.text();

    return message;
}

describe('chat helpers', function() {
    this.timeout(5e3); // before hook can timeout

    before(async () => await Domains.fetchAllDomainInformation());

    it('should update watches or blacklists based on the content of a chat message', async () => {
        const chatMessage = await getMessage(58329215);

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

        const { isWatched, isBlacklisted } = helpers;

        // random-domain.com was first watched, then unwatched and shouldn't be in the watchlist
        expect(isWatched('random-domain.com')).to.be.false;
        expect(isBlacklisted('random-random-domain.com')).to.be.true;
        expect(isBlacklisted('tenderpublish')).to.be.false; // was unblacklisted
        expect(isWatched('domain.with.a.few.dots.com')).to.be.true;
        expect(isBlacklisted('domain.with.many.many.dots.com')).to.be.true;

        // nayvi was blacklisted, therefore it shouldn't be in the watchlist, but in the blacklist
        expect(isWatched('nayvi')).to.be.false;
        expect(isBlacklisted('nayvi')).to.be.true;
        expect(isBlacklisted('naYvi')).to.be.true;

        // a user id other than SD's one shouldn't change the watchlist or the blacklist
        const random = new JSDOM(getRandomMessage(chatMessage, 'watch', 'example\\.com')).window.document;

        newChatEventOccurred({ event_type: 1, user_id: 123456, content: random }); // not Smokey's id
        newChatEventOccurred({ event_type: 12, user_id: 120914, content: random }); // not interested in that event type

        expect(isWatched('example.com')).to.be.false;
    });

    it('should update keyword lists once a pull request is merged', async () => {
        // fill Domains.pullRequests
        Domains.pullRequests = [
            {
                id: 12080,
                regex: /example\.com/,
                author: 'double-beep',
                type: 'watch',
            },
            {
                id: 12085,
                regex: /spam\.com/,
                author: 'double-beep',
                type: 'blacklist'
            }
        ];

        const { isWatched, isBlacklisted } = helpers;

        // Merge pull request #12085
        expect(isBlacklisted('spam.com')).to.be.false;
        const merge = await getMessage(65938518);
        newChatEventOccurred(
            { event_type: 1, user_id: 120914, content: new JSDOM(merge).window.document }
        );
        expect(isBlacklisted('spam.com')).to.be.true;

        // Closed pull request #12080.
        expect(Domains.pullRequests.find(pr => pr.id === 12080)).to.not.be.undefined;
        const close = await getMessage(65937100);
        newChatEventOccurred(
            { event_type: 1, user_id: 120914, content: new JSDOM(close).window.document }
        );
        expect(isWatched('example.com')).to.be.false;
        expect(isBlacklisted('example.com')).to.be.false;

        // #12085 and #12080 should be removed from Domains.pullRequests
        expect(Domains.pullRequests.find(pr => pr.id === 12085)).to.be.undefined;
        expect(Domains.pullRequests.find(pr => pr.id === 12080)).to.be.undefined;
    });
});