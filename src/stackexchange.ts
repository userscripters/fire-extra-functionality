export const seSearchPage = 'https://stackexchange.com/search?q=url%3A';

function getSeSearchErrorMessage(status: number, statusText: string, domain: string): string {
    return `Error ${status} while trying to fetch the SE search results for ${domain}: ${statusText}.`;
}

// returns the number of hits given the SE search result page HTML
function getSeResultCount (pageHtml: Document): string {
    return pageHtml.querySelector('.results-header h2')?.textContent?.trim().replace(/,/g, '').match(/\d+/)?.[0] || '0';
}

export function getSeSearchResultsForDomain(domain: string): Promise<string> {
    const requestUrl = seSearchPage + encodeURIComponent(domain);
    return new Promise<string>((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: requestUrl,
            onload: response => {
                if (response.status !== 200) reject(getSeSearchErrorMessage(response.status, response.statusText, domain));
                const parsedResponse = new DOMParser().parseFromString(response.responseText, 'text/html');
                const resultCount = Number(getSeResultCount(parsedResponse));
                // https://stackoverflow.com/a/9461657
                const shortenedResultCount = resultCount > 999 ? (resultCount / 1000).toFixed(1) + 'k' : resultCount;
                resolve(shortenedResultCount.toString());
            },
            onerror: errorResponse => reject(getSeSearchErrorMessage(errorResponse.status, errorResponse.statusText, domain))
        });
    });
}