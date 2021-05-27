import { Toastr, watchedWebsitesRegexes, blacklistedWebsitesRegexes, githubPullRequests } from './index';
import * as github from './github';

declare const toastr: Toastr;

export interface ChatObject {
    addEventHandlerHook(callback: (eventInfo: ChatEvent) => void): void;
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

const currentRoomId = Number((/\/rooms\/(\d+)\//.exec(window.location.pathname))?.[1]);
// Copied from FIRE
const smokeDetectorId = {
    'chat.stackexchange.com': 120914,
    'chat.stackoverflow.com': 3735529,
    'chat.meta.stackexchange.com': 266345
}[location.host];
const metasmokeId = {
    'chat.stackexchange.com': 478536,
    'chat.stackoverflow.com': 14262788,
    'chat.meta.stackexchange.com': 848503
}[location.host];

async function sendActionMessageToChat(messageType: MessageActions, domainOrPrId: string | number): Promise<void> {
    const messageToSend = `!!/${messageType === 'blacklist' ? messageType + '-website' : messageType}- ${domainOrPrId}`
        .replace('approve-', 'approve'); // no need for approve to have a dash
    const userFkey = document.querySelector<HTMLInputElement>('input[name="fkey"]')?.value;
    if (!userFkey) throw new Error('Chat fkey not found'); // fkey not found for some reason; chat message cannot be sent

    const params = new FormData();
    params.append('text', messageToSend);
    params.append('fkey', userFkey);

    const chatNewMessageCall = await fetch(`/chats/${currentRoomId}/messages/new`, {
        method: 'POST',
        body: params
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
    if (!(/SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/.exec(parsedContent.querySelector('body')?.innerText || ''))) return;
    try {
        const newRegex = new RegExp(parsedContent.querySelectorAll('code')[1].innerHTML);

        const anchorInnerHtml = parsedContent.querySelectorAll('a')?.[1].innerHTML;
        const isWatch = Boolean(/Auto\swatch\sof\s/.exec(anchorInnerHtml));
        const isBlacklist = Boolean(/Auto\sblacklist\sof\s/.exec(anchorInnerHtml));
        const isUnwatch = Boolean(/Auto\sunwatch\sof\s/.exec(anchorInnerHtml));
        const isUnblacklist = Boolean(/Auto\sunblacklist\sof\s/.exec(anchorInnerHtml));

        if (isWatch) {
            watchedWebsitesRegexes.push(newRegex);
        } else if (isBlacklist) {
            // use this trick to avoid reassigning and an error on the webpack-compiled file
            const newObjectArray = watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            Object.keys(watchedWebsitesRegexes).forEach(key => delete watchedWebsitesRegexes[Number(key)]);
            watchedWebsitesRegexes.push(...newObjectArray);
            blacklistedWebsitesRegexes.push(newRegex); // if it is a blacklist, also remove the item from the watchlist
        } else if (isUnwatch) {
            const newObjectArray = watchedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            Object.keys(watchedWebsitesRegexes).forEach(key => delete watchedWebsitesRegexes[Number(key)]);
            watchedWebsitesRegexes.push(...newObjectArray);
        } else if (isUnblacklist) {
            const newObjectArray = blacklistedWebsitesRegexes.filter(regex => regex.toString() !== newRegex.toString());
            Object.keys(blacklistedWebsitesRegexes).forEach(key => delete blacklistedWebsitesRegexes[Number(key)]);
            blacklistedWebsitesRegexes.push(...newObjectArray);
        }
    } catch (error) {
        return;
    }
}

export async function newChatEventOccurred({ event_type, user_id, content }: ChatEvent): Promise<void> {
    if ((user_id !== smokeDetectorId && user_id !== metasmokeId) || event_type !== 1) return;
    const parsedContent = new DOMParser().parseFromString(content, 'text/html');
    updateWatchesAndBlacklists(parsedContent);
    const newGithubPrInfo = await github.getUpdatedGithubPullRequestInfo(parsedContent);
    if (!newGithubPrInfo) return;
    Object.keys(githubPullRequests).forEach(key => delete githubPullRequests[Number(key)]);
    githubPullRequests.push(...newGithubPrInfo);
}