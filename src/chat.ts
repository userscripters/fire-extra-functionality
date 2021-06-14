import { Toastr } from './index';
import * as github from './github';
import { Domains } from './domain_stats';
import fetch from 'node-fetch';

declare const toastr: Toastr;

export interface ChatObject {
    addEventHandlerHook(callback: (eventInfo: ChatEvent) => void): void;
}

export interface ChatParsedEvent {
    event_type: number;
    user_id: number;
    content: Document;
}

interface ChatEvent {
    event_type: number;
    user_id: number;
    content: string;
}

interface ChatResponse {
    id: number | null;
    time: number | null;
}

type MessageActions = 'watch' | 'blacklist' | 'approve';

const charcoalRoomId = 11540, smokedetectorId = 120914, metasmokeId = 478536;

async function sendActionMessageToChat(messageType: MessageActions, domainOrPrId: string | number): Promise<void> {
    const messageToSend = `!!/${messageType === 'blacklist' ? messageType + '-website' : messageType}- ${domainOrPrId}`
        .replace('approve-', 'approve'); // no need for approve to have a dash
    const userFkey = document.querySelector<HTMLInputElement>('input[name="fkey"]')?.value;
    if (!userFkey) throw new Error('Chat fkey not found'); // fkey not found for some reason; chat message cannot be sent

    const params = new FormData();
    params.append('text', messageToSend);
    params.append('fkey', userFkey);

    const chatNewMessageCall = await (window.fetch ? window.fetch : fetch)(`/chats/${charcoalRoomId}/messages/new`, {
        method: 'POST',
        body: params as URLSearchParams
    });
    if (chatNewMessageCall.status !== 200) throw new Error(`Failed to send message to chat. Returned error is ${chatNewMessageCall.status}`);

    const chatResponse = await chatNewMessageCall.json() as ChatResponse;
    // if .id or .time are null, then something went wrong
    if (!chatResponse.id || !chatResponse.time) throw new Error('Failed to send message to chat!');
}

export function addActionListener(element: HTMLElement | null, action: MessageActions, domainOrPrId: string | number): void {
    if (!element) return;
    element.addEventListener('click', async () => {
        try {
            await sendActionMessageToChat(action, domainOrPrId);
            toastr.success('Successfully sent message to chat.');
        } catch (error) {
            toastr.error(error);
            console.error('Error while sending message to chat.', error);
        }
    });
}

function updateWatchesAndBlacklists(parsedContent: Document): void {
    const messageText = parsedContent.body?.innerHTML || '';
    // make sure the (un)watch/blacklist happened recently (check for "Blacklists reloaded")
    if (!/SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/.exec(messageText) || !/Blacklists reloaded at/.exec(messageText)) return;
    try {
        const newRegex = new RegExp(parsedContent.querySelectorAll('code')[1].innerHTML);

        const anchorInnerHtml = parsedContent.querySelectorAll('a')?.[1].innerHTML;
        const isWatch = Boolean(/Auto\swatch\sof\s/.exec(anchorInnerHtml));
        const isBlacklist = Boolean(/Auto\sblacklist\sof\s/.exec(anchorInnerHtml));
        const isUnwatch = Boolean(/Auto\sunwatch\sof\s/.exec(anchorInnerHtml));
        const isUnblacklist = Boolean(/Auto\sunblacklist\sof/.exec(anchorInnerHtml));

        if (isWatch) {
            Domains.watchedWebsitesRegexes.push(newRegex);
        } else if (isBlacklist) {
            // if it is a blacklist, also remove the item from the watchlist
            Domains.watchedWebsitesRegexes = Domains.watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            Domains.blacklistedWebsitesRegexes.push(newRegex);
        } else if (isUnwatch) {
            Domains.watchedWebsitesRegexes = Domains.watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
        } else if (isUnblacklist) {
            Domains.blacklistedWebsitesRegexes = Domains.blacklistedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
        }
    } catch (error) {
        return;
    }
}

export function newChatEventOccurred({ event_type, user_id, content }: ChatParsedEvent): void {
    if ((user_id !== smokedetectorId && user_id !== metasmokeId) || event_type !== 1) return;
    updateWatchesAndBlacklists(content);
    // don't wait for that to finish for the function to return
    github.getUpdatedGithubPullRequestInfo(content)
        .then(newGithubPrInfo => newGithubPrInfo ? Domains.githubPullRequests = newGithubPrInfo : '')
        .catch(error => console.error(error));
}