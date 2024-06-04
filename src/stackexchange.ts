export function getSeUrl(searchTerm: string): string {
    const base = 'https://stackexchange.com/search?q=';
    const isUrl = searchTerm.includes('.'); // domains include a dot

    return isUrl
        ? `${base}url%3A${searchTerm}`
        : `${base}${searchTerm}`;
}

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
export function getSeResultCount(pageHtml: Document): string {
    return pageHtml
        .querySelector('.results-header h2') // the results element
        ?.textContent // .innerText not implemented in JSDOM
        ?.trim() // textContent includes some spaces, trim them
        .replace(/,/g, '') // 5,384 => 5384
        .match(/\d+/)?.[0] || '0'; // get the count
}

export function getSeSearchResults(term: string): Promise<string> {
    const encodedTerm = encodeURIComponent(term);
    const requestUrl = getSeUrl(encodedTerm);

    return new Promise<string>((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: requestUrl,
            onload: ({ status, statusText, responseText }) => {
                if (status !== 200) {
                    const message = getSeSearchErrorMessage(status, statusText, term);

                    return reject(message);
                }

                const parsed = new DOMParser().parseFromString(responseText, 'text/html');
                const count = Number(getSeResultCount(parsed));
                const shortened = getShortenedResultCount(count);

                resolve(shortened);
            },
            onerror: ({ status, statusText }) => reject(
                getSeSearchErrorMessage(status, statusText, term)
            )
        });
    });
}
