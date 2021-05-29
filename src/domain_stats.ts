import * as metasmoke from './metasmoke.js';
import * as github from './github.js';
import { Toastr, getDomainId } from './index.js';

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

    public static async fetchAllDomainInformation(): Promise<void> {
        // nothing to do; all information is successfully fetched
        if (this.watchedWebsitesRegexes && this.blacklistedWebsitesRegexes && this.githubPullRequests) return;
        // Those files are frequently updated, so they can't be in @resources
        const [watchedWebsitesCall, blacklistedWebsitesCall, githubPrsCall] = await Promise.all([
            fetch('https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/watched_keywords.txt'),
            fetch('https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/blacklisted_websites.txt'),
            fetch(github.githubPrApiUrl)
        ]);
        const [watchedWebsites, blacklistedWebsites, githubPrs] = await Promise.all([
            watchedWebsitesCall.text(),
            blacklistedWebsitesCall.text(),
            githubPrsCall.json() as Promise<github.GithubApiResponse[]>
        ]);
        this.watchedWebsitesRegexes = github.getRegexesFromTxtFile(watchedWebsites, 2);
        this.blacklistedWebsitesRegexes = github.getRegexesFromTxtFile(blacklistedWebsites, 0);
        this.githubPullRequests = github.getPullRequestDataFromApi(githubPrs);
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
            const domainId = getDomainId(domainName), domainElementLi = document.getElementById(domainId);
            if (!domainElementLi) return []; // in case the popup is closed before the process is complete

            this.allDomainInformation[domainName].metasmoke = feedbackCount;
            const metasmokeStatsElement = domainElementLi.querySelector('.fire-extra-ms-stats');
            if (!metasmokeStatsElement) return [];

            metasmokeStatsElement.innerHTML = getColouredSpans(feedbackCount);
            return [domainName];
        });
    }
}