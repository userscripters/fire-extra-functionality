interface GraphQLPostFeedbackCount {
    is_tp: boolean;
    is_fp: boolean;
    is_naa: boolean;
}

interface GraphQLSpamDomains {
    id: string;
    domain: string;
    posts: GraphQLPostFeedbackCount[];
}

interface GraphQLErrorInformation {
    message: string;
    locations: ({
        line: number;
        column: number;
    })[];
}

type GraphQLResponse = {
    data: {
        spam_domains: GraphQLSpamDomains[];
    }
} | {
    errors: GraphQLErrorInformation[];
}

interface DomainsForPostIdItems {
    id: number;
    domain: string;
}

interface DomainsForPostIdResponse {
    items: DomainsForPostIdItems[];
    has_more: boolean;
}

const metasmokeApiBase = 'https://metasmoke.erwaysoftware.com/api/v2.0/posts/';
const metasmokeApiKey = '36d7b497b16d54e23641d0f698a2d7aab7d92777ef3108583b5bd7d9ddcd0a18';
const postDomainsApiFilter = 'HGGGFLHIHKIHOOH';

// generate the GraphQL query string
function getDomainPostsQuery(idsArray: number[]): string {
    return `{
        spam_domains(ids: [${idsArray.join(',')}]) {
            id, domain, posts {
                is_tp,
                is_fp,
                is_naa
            }
        }
    }`;
}

export async function getGraphQLInformation(idsArray: number[]): Promise<GraphQLResponse> {
    const query = getDomainPostsQuery(idsArray);
    const payload = {
        'query': query,
        'variables': null
    };

    const url = `https://metasmoke.erwaysoftware.com/api/graphql?key=${metasmokeApiKey}`;
    const call = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!call.ok) {
        const text = await call.text();
        console.error(text);

        throw new Error(`Failed to fetch information from GraphQL with error ${call.status}.`);
    }

    const response = await call.json() as GraphQLResponse;

    if ('errors' in response) { // something went wrong
        console.error(response);

        throw new Error('Failed to fetch information from GraphQL. See console for more details.');
    }

    return response;
}

function getPostCounts(parsedHtml: Document): number[] {
    const tabsSelector = '.nav-tabs li:not([role="presentation"])';

    const counts = [...parsedHtml.querySelectorAll<HTMLAnchorElement>(tabsSelector)]
        .map(element => /\d+/.exec(element?.textContent?.trim() || '')?.[0])
        .map(Number);

    // Note: in case no result is found in MS, the element
    //       matching tabsSelector does not exist, so we need to return [0, 0, 0]
    // See: https://chat.stackexchange.com/transcript/message/65741998
    return counts.length
        ? counts
        : [0, 0, 0];
}

export function getMsSearchResults(term: string): Promise<number[]> {
    const encoded = encodeURIComponent(term);

    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://metasmoke.erwaysoftware.com/search?utf8=✓&body=${encoded}`,
            onload: response => {
                const { status, responseText } = response;

                if (status === 200) {
                    const domParser = new DOMParser();
                    const parsedHtml = domParser.parseFromString(responseText, 'text/html');

                    resolve(getPostCounts(parsedHtml));
                } else {
                    reject(`Failed to get search results for ${term} on metasmoke search.`);
                    console.error(response);
                }
            },
            onerror: ({ responseText }) => reject(responseText)
        });
    });
}

export async function getAllDomainsFromPost(metasmokePostId: number): Promise<DomainsForPostIdItems[]> {
    const method = `${metasmokePostId}/domains`;
    const parameters = `?key=${metasmokeApiKey}&filter=${postDomainsApiFilter}&per_page=100`;
    const msApiUrl = metasmokeApiBase + method + parameters;

    const apiCallResponse = await fetch(msApiUrl);
    const jsonResponse = await apiCallResponse.json() as DomainsForPostIdResponse;

    return jsonResponse.items;
}
