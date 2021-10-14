export const seSearchPage = 'https://stackexchange.com/search?q=url%3A';

// https://stackoverflow.com/a/9461657
export function getShortenedResultCount(number: number): string {
    return number > 999
        ? (number / 1000).toFixed(1).replace('.0', '') + 'k' // use .replace() to avoid 2.0k, etc.
        : number.toString();
}

function getSeSearchErrorMessage(status: number, statusText: string, domain: string): string {
    return `Error ${status} while trying to fetch the SE search results for ${domain}: ${statusText}.`;
}

// returns the number of hits given the SE search result page HTML
function getSeResultCount(pageHtml: Document): string {
    return pageHtml
        .querySelector('.results-header h2') // the results element
        ?.textContent // .innerText for some reason doesn't work in testing
        ?.trim() // textContent includes some spaces, trim them
        .replace(/,/g, '') // 5,384 => 5384
        .match(/\d+/)?.[0] || '0'; // get the count
}

export function getSeSearchResultsForDomain(domain: string): Promise<string> {
    const requestUrl = seSearchPage + encodeURIComponent(domain);

    return new Promise<string>((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: requestUrl,
            onload: response => {
                if (response.status !== 200) {
                    const errorMessage = getSeSearchErrorMessage(response.status, response.statusText, domain);

                    return reject(errorMessage);
                }

                const parsedResponse = new DOMParser().parseFromString(response.responseText, 'text/html');
                const resultCount = Number(getSeResultCount(parsedResponse));
                const shortenedResultCount = getShortenedResultCount(resultCount);

                resolve(shortenedResultCount);
            },
            onerror: errorResponse => reject(getSeSearchErrorMessage(errorResponse.status, errorResponse.statusText, domain))
        });
    });
}
