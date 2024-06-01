# FIRE Additional Functionality
Watch, blacklist, and see domain statistics directly from the FIRE popup!

This userscript aims at making the watch/blacklist process easier for experienced users.

## Note
The script determines whether a domain is watched or blacklisted by testing it against all of the entries on the SmokeDetector's watchlists/blacklists. Since the script is written in JavaScript (therefore using the ECMAScript flavour) and SD utilises the [regex](https://pypi.org/project/regex) library (an implementation quite close to PCRE), there may be instances where a domain marked as not watched or blacklisted by the script actually matches a regular expression that exists in SD watchlist/blacklist, but is not compatible with the ECMAScript flavour.

## Screenshots

![eq1](https://github.com/userscripters/fire-extra-functionality/assets/38133098/bbfb79f7-9c92-4e53-85a3-5e811fed7aff)


![eq2](https://github.com/userscripters/fire-extra-functionality/assets/38133098/26b7dd5c-1ed0-42ba-a745-ee256361b07a)


![eq3](https://github.com/userscripters/fire-extra-functionality/assets/38133098/b0a2638f-cd00-4bd1-942b-823a93b1d571)
