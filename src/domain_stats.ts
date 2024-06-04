import { getGraphQLInformation } from './metasmoke';
import {
    GithubApiInformation,
    GithubApiResponse,
    githubUrls,
    getRegexesFromTxtFile,
    parseApiResponse
} from './github';
import { Toastr } from './index';

declare const toastr: Toastr;
interface MetasmokeDomainStats {
    [key: string]: number[];
}

export interface DomainStats {
    [key: string]: {
        metasmoke: number[]; // the tp, fp and naa count respectively
        stackexchange: string;
    }
}

// this class hack is used to avoid using top-level await which is tricky in testing
// and requires module: esnext which messes up the compiled file
export class Domains {
    public static allDomainInformation: DomainStats = {}; // contains both the SE hit count and the MS feedbacks

    public static watchedWebsites: RegExp[];
    public static blacklistedWebsites: RegExp[];
    public static githubPullRequests: GithubApiInformation[];

    public static whitelistedDomains: string[];
    public static redirectors: string[];

    public static async fetchAllDomainInformation(): Promise<void> {
        // nothing to do; all information is successfully fetched
        if (this.watchedWebsites
         && this.blacklistedWebsites
         && this.githubPullRequests
         && this.whitelistedDomains
         && this.redirectors) return;

        // Those files are frequently updated, so they can't be in @resources
        // Thanks tripleee! https://github.com/Charcoal-SE/halflife/blob/ab0fa5fc2a048b9e17762ceb6e3472e4d9c65317/halflife.py#L77
        const [
            watchedCall, blacklistedCall, prsCall, whitelistedCall, redirectorsCall
        ] = await Promise.all(([
            fetch(githubUrls.watched),
            fetch(githubUrls.blacklisted),
            fetch(githubUrls.api),
            fetch(githubUrls.whitelisted),
            fetch(githubUrls.redirectors)
        ]));

        const [watched, blacklisted, prs, whitelisted, redirectors] = await Promise.all([
            watchedCall.text(),
            blacklistedCall.text(),
            prsCall.json() as Promise<GithubApiResponse[]>,
            whitelistedCall.text(),
            redirectorsCall.text()
        ]);

        this.watchedWebsites = getRegexesFromTxtFile(watched, 2);
        this.blacklistedWebsites = getRegexesFromTxtFile(blacklisted, 0);
        this.githubPullRequests = parseApiResponse(prs);

        this.whitelistedDomains = whitelisted.split('\n');
        this.redirectors = redirectors.split('\n');
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
            const results = await getGraphQLInformation(domainIds);
            if ('errors' in results) return {};

            results.data.spam_domains.forEach(spamDomain => {
                const tpPosts = spamDomain.posts.filter(post => post.is_tp).length;
                const fpPosts = spamDomain.posts.filter(post => post.is_fp).length;
                const naaPosts = spamDomain.posts.filter(post => post.is_naa).length;

                domainStats[spamDomain.domain] = [tpPosts, fpPosts, naaPosts];
            });
        } catch (error) {
            if (error instanceof Error) {
                toastr.error(error.message);
            }

            console.error('Error while trying to fetch domain stats from GraphiQL.', error);
        }
        return domainStats;
    }
}