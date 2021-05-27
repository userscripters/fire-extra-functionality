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

export type GraphQLResponse = {
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

export function getGraphQLInformation(idsArray: number[]): Promise<GraphQLResponse> {
    const query = getDomainPostsQuery(idsArray);
    const payload = { 'query': query, 'variables': null };
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://metasmoke.erwaysoftware.com/api/graphql',
            data: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
            onload: response => {
                if (response.status === 200) {
                    const jsonResponse = JSON.parse(response.responseText) as GraphQLResponse;
                    // if an .errors field exists, then something went wrong
                    return 'errors' in jsonResponse ? reject(jsonResponse) : resolve(jsonResponse);
                } else { // status is not 200 (success), probably unauthorised/not logged in?
                    reject(`Failed to get information from GraphQL with error ${response.status}. Make sure you are logged in to Metasmoke before trying again.`);
                    console.error(response);
                }
            },
            onerror: errorResponse => reject(errorResponse.responseText)
        });
    });
}

export async function getAllDomainsFromPost(metasmokePostId: number): Promise<DomainsForPostIdItems[]> {
    const finalMsApiUrl = `${metasmokeApiBase}${metasmokePostId}/domains?key=${metasmokeApiKey}&filter=${postDomainsApiFilter}&per_page=100`;
    const apiCallResponse = await fetch(finalMsApiUrl);
    const jsonResponse = await apiCallResponse.json() as DomainsForPostIdResponse;
    return jsonResponse.items;
}