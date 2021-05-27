import * as metasmoke from './metasmoke';
import { Toastr, getDomainId } from './index';

declare const toastr: Toastr;
interface MetasmokeDomainStats {
    [key: string]: number[];
}

interface DomainStats {
    [key: string]: {
        metasmoke: number[]; // the tp, fp and naa count respectively
        stackexchange: string;
    }
}

export const allDomainInformation: DomainStats = {}; // contains both the SE hit count and the MS feedbacks
// Gets a coloured TP/FP/NAA span.
const getColouredSpan = (feedbackCount: number, feedback: string): string =>
    `<span class="fire-extra-${feedback}" fire-tooltip=${feedback.toUpperCase()}>${feedbackCount}</span>`;
const getColouredSpans = ([tpCount, fpCount, naaCount]: number[]): string =>
    `${getColouredSpan(tpCount, 'tp')}, ${getColouredSpan(fpCount, 'fp')}, ${getColouredSpan(naaCount, 'naa')}`;

async function getTpFpNaaCountFromDomains(domainIds: number[]): Promise<MetasmokeDomainStats> {
    if (!domainIds.length) return {};
    const domainStats: MetasmokeDomainStats = {};
    /* domainStats contains the TP/FP/NAA count for the domain. Sample object:
       {
           'example.com': [ 5, 4, 10 ],
           'spamdomain.com': [ 5, 0, 0 ]
       }
       // The first item of the array is the tp count, the second the fp count and the third the naa count.
    */
    try {
        const results = await metasmoke.getGraphQLInformation(domainIds);
        const parsedResults = JSON.parse(JSON.stringify(results)) as metasmoke.GraphQLResponse;
        if ('errors' in parsedResults) return {};

        parsedResults.data.spam_domains.forEach(spamDomain => {
            const tpPosts = spamDomain.posts.filter(post => post.is_tp).length;
            const fpPosts = spamDomain.posts.filter(post => post.is_fp).length;
            const naaPosts = spamDomain.posts.filter(post => post.is_naa).length;
            domainStats[spamDomain.domain] = [tpPosts, fpPosts, naaPosts];
        });
    } catch (error) {
        toastr.error(error);
        console.error('Error while trying to fetch domain stats from GraphiQL.', error);
    }
    return domainStats;
}

export async function triggerDomainUpdate(domainIdsValid: number[]): Promise<string[]> {
    const domainStats = await getTpFpNaaCountFromDomains(domainIdsValid);
    return Object.entries(domainStats || {}).flatMap(([domainName, feedbackCount]) => {
        const domainId = getDomainId(domainName), domainElementLi = document.getElementById(domainId);
        if (!domainElementLi) return []; // in case the popup is closed before the process is complete

        allDomainInformation[domainName].metasmoke = feedbackCount;
        const metasmokeStatsElement = domainElementLi.querySelector('.fire-extra-ms-stats');
        if (!metasmokeStatsElement) return [];

        metasmokeStatsElement.innerHTML = getColouredSpans(feedbackCount);
        return [domainName];
    });
}