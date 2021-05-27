export interface GithubApiResponse {
    number: number;
    title: string;
    state: 'open' | 'closed';
    user: {
        id: number;
    }
}

interface GithubApiInformation {
    id: number;
    regex: RegExp;
    author: string;
    type: 'watch' | 'blacklist';
}

const smokeDetectorGithubRepo = 'Charcoal-SE/SmokeDetector';
const smokeDetectorGithubId = 11063859;
export const githubPrApiUrl = `https://api.github.com/repos/${smokeDetectorGithubRepo}/pulls`;

// Thanks tripleee! https://github.com/Charcoal-SE/halflife/blob/ab0fa5fc2a048b9e17762ceb6e3472e4d9c65317/halflife.py#L77
export const whitelistedDomains = GM_getResourceText('whitelisted'), redirectors = GM_getResourceText('redirectors');

const getGithubPrUrl = (pullRequestId: number): string => `//github.com/${smokeDetectorGithubRepo}/pull/${pullRequestId}`;
const getPrTooltip = ({ id, regex, author, type }: GithubApiInformation): string =>
    `${author} wants to ${type} ${regex.source} in PR#${id}`; // fire-tooltip text explaining pending PRs
export const getPendingPrHtml = (githubPrOpenItem: GithubApiInformation): string =>
    `<a href=${getGithubPrUrl(githubPrOpenItem.id)} fire-tooltip="${getPrTooltip(githubPrOpenItem)}">PR#${githubPrOpenItem.id}</a>`
  + `&nbsp;pending <a class="fire-extra-approve" fire-tooltip="!!/approve ${githubPrOpenItem.id}">!!/approve</a>&nbsp;&nbsp;`;

export function getRegexesFromTxtFile(fileContent: string, position: number): RegExp[] {
    return fileContent.split('\n').flatMap(line => {
        const keyword = line.split('\t')[position];
        if (!keyword) return [];
        let regexToReturn;
        try {
            regexToReturn = new RegExp(keyword);
        } catch (error) {
            return []; // regex is incompatible with the ES regex engine; nothing can be done
        }
        return [regexToReturn];
    });
}

export function getPullRequestDataFromApi(jsonData: GithubApiResponse[]): GithubApiInformation[] {
    // only interested in open PRs by SD
    return jsonData.filter(item => item.user.id === smokeDetectorGithubId && item.state === 'open').flatMap(item => {
        // Sample PR title => username: Watch example\.com
        const { number, title } = item;
        let regex;
        try {
            regex = new RegExp(/(?:Watch|Blacklist)\s(.*)/.exec(title)?.[1] || '');
        } catch (error) {
            return [];
        }
        const authorName = (/^(.*?):/.exec(title))?.[1];
        const prType = (/^.*?:\s(Watch)\s/.exec(title)) ? 'watch' : 'blacklist';
        return [{ id: number, regex: regex, author: authorName || '', type: prType }];
    });
}

export async function getUpdatedGithubPullRequestInfo(parsedContent: Document): Promise<GithubApiInformation[] | undefined> {
    const messageText = parsedContent.querySelector('body')?.innerText || '';
    if (!/Closed pull request |Merge pull request|opened by SmokeDetector/.test(messageText)) return;
    const githubPrsApiCall = await fetch(githubPrApiUrl), githubPrsFromApi = await githubPrsApiCall.json() as GithubApiResponse[];
    return getPullRequestDataFromApi(githubPrsFromApi);
}