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

export const sdGithubRepo = 'Charcoal-SE/SmokeDetector';
const sdGhId = 11063859;

export const githubUrls = {
    api: `https://api.github.com/repos/${sdGithubRepo}/pulls`,
    whitelisted: 'https://raw.githubusercontent.com/userscripters/fire-extra-functionality/master/ini/whitelisted_domains.txt',
    redirectors: 'https://raw.githubusercontent.com/userscripters/fire-extra-functionality/master/ini/redirectors.txt',
    watched: 'https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/watched_keywords.txt',
    blacklisted: 'https://raw.githubusercontent.com/Charcoal-SE/SmokeDetector/master/blacklisted_websites.txt'
};

function makeRegexESCompatible(keyword: string): RegExp[] {
    const shortenerPathRegex = /\(\?-i:(\w+)\)\(\?#[a-zA-Z.]+\)/;

    const urlPath = keyword.match(shortenerPathRegex)?.[1];
    if (!urlPath) return [];
    else return [new RegExp(urlPath)];
}

export function getRegexesFromTxtFile(fileContent: string, position: number): RegExp[] {
    return fileContent.split('\n').flatMap(line => {
        const keyword = line.split('\t')[position];
        if (!keyword) return [];

        let regexToReturn;
        try {
            regexToReturn = new RegExp(keyword, 'i');
        } catch (error) {
            // regex is incompatible with the ES regex engine
            // for (?-i:abcdefg)(?#bit.ly) regexes
            // we should attempt to make them ES compatible
            // since watching/blacklisting shorteners' paths is supported
            return makeRegexESCompatible(keyword);
        }
        return [regexToReturn];
    });
}

export function parseApiResponse(jsonData: GithubApiResponse[]): GithubApiInformation[] {
    // only interested in open PRs by SD
    return jsonData
        .filter(item => item.user.id === sdGhId && item.state === 'open')
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

    const call = await fetch(githubUrls.api);
    const response = await call.json() as GithubApiResponse[];

    return parseApiResponse(response);
}