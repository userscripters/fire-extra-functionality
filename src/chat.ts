import { Toastr } from './index.js';
import { getUpdatedPrInfo } from './github.js';
import { Domains } from './domain_stats.js';
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

const charcoalRoomId = 11540, smokedetectorId = 120914, metasmokeId = 478536;

async function sendActionMessageToChat(element: Element): Promise<void> {
    // so that the text in the tooltip is consistent with what's being watched
    const messageToSend = element.getAttribute('fire-tooltip');

    const fkeyEl = document.querySelector<HTMLInputElement>('input[name="fkey"]');
    const userFkey = fkeyEl?.value;
    if (!userFkey) throw new Error('Chat fkey not found'); // chat message cannot be sent
    else if (!messageToSend) throw new Error('No message found');

    const params = new FormData();
    params.append('text', messageToSend);
    params.append('fkey', userFkey);

    const newMessageUrl = `/chats/${charcoalRoomId}/messages/new`;
    const chatNewMessageCall = await (fetch || window.fetch)(newMessageUrl, {
        method: 'POST',
        body: params
    });

    if (chatNewMessageCall.status !== 200) {
        throw new Error(`Failed to send message to chat. Returned error is ${chatNewMessageCall.status}`);
    }

    const chatResponse = await chatNewMessageCall.json() as ChatResponse;

    // if .id or .time are null, then something went wrong
    if (!chatResponse.id || !chatResponse.time) throw new Error('Failed to send message to chat!');
}

export function addActionListener(element: Element | null,): void {
    if (!element) return;

    element.addEventListener('click', async () => {
        try {
            await sendActionMessageToChat(element);
            toastr.success('Successfully sent message to chat.');
        } catch (error) {
            toastr.error(error as string);
            console.error('Error while sending message to chat.', error);
        }
    });
}

function updateWatchesAndBlacklists(parsedContent: Document): void {
    const messageText = parsedContent.body?.innerHTML || '';
    const autoReloadOf = /SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/;
    const blacklistsReloaded = /Blacklists reloaded at/;

    // make sure the (un)watch/blacklist happened recently
    if (!autoReloadOf.exec(messageText) || !blacklistsReloaded.exec(messageText)) return;

    try {
        const regexText = parsedContent.querySelectorAll('code')[1].innerHTML;
        const newRegex = new RegExp(regexText);
        const anchorInnerHtml = parsedContent.querySelectorAll('a')?.[1].innerHTML;

        const regexMatch = (regex: RegExp): boolean => regex.toString() !== newRegex.toString();
        const isType = (regex: RegExp): boolean => Boolean(regex.exec(anchorInnerHtml));

        const isWatch = isType(/Auto\swatch\sof\s/);
        const isBlacklist = isType(/Auto\sblacklist\sof\s/);
        const isUnwatch = isType(/Auto\sunwatch\sof\s/);
        const isUnblacklist = isType(/Auto\sunblacklist\sof/);

        if (isWatch) {
            Domains.watchedWebsites.push(newRegex);
        } else if (isBlacklist) {
            // if it is a blacklist, also remove the item from the watchlist
            Domains.watchedWebsites = Domains.watchedWebsites.filter(regexMatch);
            Domains.blacklistedWebsites.push(newRegex);
        } else if (isUnwatch) {
            Domains.watchedWebsites = Domains.watchedWebsites.filter(regexMatch);
        } else if (isUnblacklist) {
            Domains.blacklistedWebsites = Domains.blacklistedWebsites.filter(regexMatch);
        }
    } catch (error) {
        return;
    }
}

export function newChatEventOccurred({ event_type, user_id, content }: ChatParsedEvent): void {
    if ((user_id !== smokedetectorId && user_id !== metasmokeId) || event_type !== 1) return;

    updateWatchesAndBlacklists(content);

    // don't wait for that to finish for the function to return
    getUpdatedPrInfo(content)
        .then(newGithubPrInfo => Domains.githubPullRequests = newGithubPrInfo || [])
        .catch(error => console.error(error));
}
