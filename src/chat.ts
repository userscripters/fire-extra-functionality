import { Toastr } from './index';
import { getUpdatedPrInfo } from './github';
import { Domains } from './domain_stats';

declare const toastr: Toastr;

export interface ChatObject {
    addEventHandlerHook: (callback: (eventInfo: ChatEvent) => void) => void;
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

const charcoalHq = 11540;
const smokeyId = 120914;
const metasmokeId = 478536;

async function sendMessage(element: Element): Promise<void> {
    // so that the text in the tooltip is consistent with what's being watched
    const message = element.getAttribute('fire-tooltip');

    const fkeyEl = document.querySelector<HTMLInputElement>('input[name="fkey"]');
    const fkey = fkeyEl?.value;

    if (!fkey) throw new Error('Chat fkey not found'); // chat message cannot be sent
    else if (!message) throw new Error('No message found');

    const params = new FormData();
    params.append('text', message);
    params.append('fkey', fkey);

    const url = `/chats/${charcoalHq}/messages/new`;
    const call = await fetch(url, {
        method: 'POST',
        body: params
    });

    if (call.status !== 200 || !call.ok) {
        throw new Error(
            `Failed to send message to chat. Returned error is ${call.status}`
        );
    }

    const response = await call.json() as ChatResponse;

    // if .id or .time are null, then something went wrong
    if (!response.id || !response.time) {
        throw new Error('Failed to send message to chat!');
    }
}

export function addListener(element: Element | null): void {
    if (!element) return;

    element.addEventListener('click', async () => {
        try {
            await sendMessage(element);

            toastr.success('Successfully sent message to chat.');
        } catch (error) {
            toastr.error(error as string);

            console.error('Error while sending message to chat.', error);
        }
    });
}

function updateKeywordLists(
    regex: string,
    action: 'watch' | 'unwatch' | 'blacklist' | 'unblacklist'
): void {
    try {
        const newRegex = new RegExp(regex, 'is');

        const compare = (regexp: RegExp): boolean =>
            regexp.source !== newRegex.source && regexp.source !== `\\b${newRegex.source}\\b`;

        switch (action) {
            case 'watch': {
                const modified = new RegExp(`\\b${newRegex.source}\\b`, 'si');
                Domains.watched.push(modified);

                break;
            }
            case 'blacklist':
                // if it is a blacklist, also remove the item from the watchlist
                Domains.watched = Domains.watched.filter(compare);
                Domains.blacklisted.push(newRegex);

                break;
            case 'unwatch':
                Domains.watched = Domains.watched.filter(compare);

                break;
            case 'unblacklist':
                Domains.blacklisted = Domains.blacklisted.filter(compare);
                break;
            default:
        }
    } catch {
        // eslint-disable-next-line no-useless-return
        return;
    }
}

function parseChatMessage(content: Document): void {
    const message = content.body.innerHTML || '';
    const autoReloadOf = /SmokeDetector: Auto (?:un)?(?:watch|blacklist) of/;

    // make sure the (un)watch/blacklist happened recently
    if (!autoReloadOf.test(message) || !message.includes('Blacklists reloaded at')) return;

    const regexText = content.querySelectorAll('code')[1].innerHTML;
    const anchorHtml = content.querySelectorAll('a')[1].innerHTML;
    const action = (['watch', 'unwatch', 'blacklist', 'unblacklist'] as const)
        .find(word => {
            const regex = new RegExp(`Auto\\s${word}\\sof\\s`);

            return regex.test(anchorHtml);
        }) || 'watch'; // watch by default

    updateKeywordLists(regexText, action);
}

export function newChatEventOccurred(
    { event_type, user_id, content }: ChatParsedEvent,
    updateGithub = true
): void {
    if ((user_id !== smokeyId && user_id !== metasmokeId) || event_type !== 1) return;

    parseChatMessage(content);

    const message = content.body.innerHTML || '';
    // before updating Domains.pullRequests, make sure to update keyword lists
    // based on the pr that was merged
    const prId = Number(/Merge pull request #(\d+)/.exec(message)?.[1]);
    const pr = Domains.pullRequests.find(({ id }) => id === prId);
    if (pr && prId) {
        const { regex, type } = pr;

        updateKeywordLists(regex.source, type);
        Domains.pullRequests = Domains.pullRequests
            .filter(({ id }) => id !== prId);
    }

    if (!updateGithub) return;

    getUpdatedPrInfo(message)
        .then(info => {
            Domains.pullRequests = (info || [])
                // since info from API might be cached
                .filter(({ id }) => id !== prId);
        })
        .catch((error: unknown) => console.error(error));
}
