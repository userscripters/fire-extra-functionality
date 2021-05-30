import * as metasmoke from './metasmoke';
import * as github from './github';
import { Toastr, indexHelpers } from './index';

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

// Gets a coloured TP/FP/NAA span.
const getColouredSpan = (feedbackCount: number, feedback: string): string =>
    `<span class="fire-extra-${feedback}" fire-tooltip=${feedback.toUpperCase()}>${feedbackCount}</span>`;
const getColouredSpans = ([tpCount, fpCount, naaCount]: number[]): string =>
    `${getColouredSpan(tpCount, 'tp')}, ${getColouredSpan(fpCount, 'fp')}, ${getColouredSpan(naaCount, 'naa')}`;

// this class hack is used to avoid using top-level await which is tricky in testing
// and requires module: esnext which messes up the compiled file
export class Domains {
    public static allDomainInformation: DomainStats = {}; // contains both the SE hit count and the MS feedbacks
    public static watchedWebsitesRegexes: RegExp[];
    public static blacklistedWebsitesRegexes: RegExp[];
    public static githubPullRequests: github.GithubApiInformation[];
    public static whitelistedDomains: string;
    public static redirectors: string;

    public static async fetchAllDomainInformation(): Promise<void> {
        // nothing to do; all information is successfully fetched
        if (this.watchedWebsitesRegexes && this.blacklistedWebsitesRegexes && this.githubPullRequests) return;
        // Those files are frequently updated, so they can't be in @resources
        // Thanks tripleee! https://github.com/Charcoal-SE/halflife/blob/ab0fa5fc2a048b9e17762ceb6e3472e4d9c65317/halflife.py#L77
        const [
            watchedWebsitesCall, blacklistedWebsitesCall, githubPrsCall, whitelistedDomainsCall, redirectorsCall
        ] = await Promise.all([
            fetch(github.watchedKeywordsUrl),
            fetch(github.blacklistedKeywordsUrl),
            fetch(github.githubPrApiUrl),
            fetch(github.whitelisted),
            fetch(github.redirectors)
        ]);
        const [watchedWebsites, blacklistedWebsites, githubPrs, whitelistedDomains, redirectors] = await Promise.all([
            watchedWebsitesCall.text(),
            blacklistedWebsitesCall.text(),
            githubPrsCall.json() as Promise<github.GithubApiResponse[]>,
            whitelistedDomainsCall.text(),
            redirectorsCall.text()
        ]);
        this.watchedWebsitesRegexes = github.getRegexesFromTxtFile(watchedWebsites, 2);
        this.blacklistedWebsitesRegexes = github.getRegexesFromTxtFile(blacklistedWebsites, 0);
        this.githubPullRequests = github.getPullRequestDataFromApi(githubPrs);
        this.whitelistedDomains = whitelistedDomains;
        this.redirectors = redirectors;
    }

    public static async getTpFpNaaCountFromDomains(domainIds: number[]): Promise<MetasmokeDomainStats> {
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

    public static async triggerDomainUpdate(domainIdsValid: number[]): Promise<string[]> {
        const domainStats = await this.getTpFpNaaCountFromDomains(domainIdsValid);
        return Object.entries(domainStats || {}).flatMap(([domainName, feedbackCount]) => {
            const domainId = indexHelpers.getDomainId(domainName), domainElementLi = document.getElementById(domainId);
            if (!domainElementLi) return []; // in case the popup is closed before the process is complete

            this.allDomainInformation[domainName].metasmoke = feedbackCount;
            const metasmokeStatsElement = domainElementLi.querySelector('.fire-extra-ms-stats');
            if (!metasmokeStatsElement) return [];

            metasmokeStatsElement.innerHTML = getColouredSpans(feedbackCount);
            return [domainName];
        });
    }
}