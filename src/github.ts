import fetch from 'node-fetch';

export interface GithubApiResponse {
    number: number;
    title: string;
    state: 'open' | 'closed';
    user: {
        id: number;
    }
}

export interface GithubApiInformation {
    id: number;
    regex: RegExp;
    author: string;
    type: 'watch' | 'blacklist';
}

const smokeDetectorGithubRepo = 'Charcoal-SE/SmokeDetector';
const smokeDetectorGithubId = 11063859;

export const githubUrls = {
    api: `https://api.github.com/repos/${smokeDetectorGithubRepo}/pulls`,
    whitelisted: 'https://raw.githubusercontent.com/userscripters/fire-extra-functionality/master/ini/whitelisted_domains.txt',
    redirectors: 'https://raw.githubusercontent.com/userscripters/fire-extra-functionality/master/ini/redirectors.txt',
    watched: 'https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/watched_keywords.txt',
    blacklisted: 'https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/blacklisted_websites.txt'
};

const getGithubPrUrl = (pullRequestId: number): string => `//github.com/${smokeDetectorGithubRepo}/pull/${pullRequestId}`;
const getPrTooltip = ({ id, regex, author, type }: GithubApiInformation): string =>
    `${author} wants to ${type} ${regex.source} in PR#${id}`; // fire-tooltip text explaining pending PRs

export function getPendingPrElement(githubPrOpenItem: GithubApiInformation): HTMLDivElement {
    const prId = githubPrOpenItem.id;

    const container = document.createElement('div');

    const anchor = document.createElement('a');
    anchor.href = getGithubPrUrl(prId);
    anchor.innerHTML = `PR#${prId}`;
    anchor.setAttribute('fire-tooltip', getPrTooltip(githubPrOpenItem));

    const approve = document.createElement('a');
    approve.classList.add('fire-extra-approve');
    approve.innerHTML = '!!/approve';
    approve.setAttribute('fire-tooltip', `!!/approve ${prId}`);

    container.append(anchor, ' pending ', approve);

    return container;
}

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

export function parsePullRequestDataFromApi(jsonData: GithubApiResponse[]): GithubApiInformation[] {
    // only interested in open PRs by SD
    return jsonData
        .filter(item => item.user.id === smokeDetectorGithubId && item.state === 'open')
        .flatMap(item => {
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

            return [
                {
                    id: number,
                    regex: regex,
                    author: authorName || '',
                    type: prType
                }
            ];
        });
}

export async function getUpdatedPrInfo(parsedContent: Document): Promise<GithubApiInformation[] | undefined> {
    const messageText = parsedContent.body?.innerHTML || '';
    const prChanged = /Closed pull request |Merge pull request|opened by SmokeDetector/;
    if (!prChanged.test(messageText)) return;

    const githubPrsApiCall = await (fetch || window.fetch)(githubUrls.api);
    const githubPrsFromApi = await githubPrsApiCall.json() as GithubApiResponse[];

    return parsePullRequestDataFromApi(githubPrsFromApi);
}