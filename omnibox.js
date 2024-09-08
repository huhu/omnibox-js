import Compat from "./compat.js";
import { Render } from "./render.js";
import QueryEvent from "./query-event.js";

const URL_PROTOCOLS = /^(https?|file|chrome-extension|moz-extension):\/\//i;
export const PAGE_TURNER = "-";

export function parseInput(input) {
    let parsePage = (arg) => {
        return [...arg].filter(c => c === PAGE_TURNER).length;
    };
    let args = input.trim().split(/\s+/i);
    let query = undefined,
        page = 1;
    if (args.length === 1 && args[0].startsWith(PAGE_TURNER)) {
        // Case: {page-turner}
        query = [];
        page = parsePage(args[0]);
    } else if (args.length === 1) {
        // Case: {keyword}
        query = [args[0]];
    } else if (args.length === 2 && args[1].startsWith(PAGE_TURNER)) {
        // Case: {keyword} {page-turner}
        query = [args[0]];
        page = parsePage(args[1]) + 1;
    } else if (args.length >= 2) {
        // Case: {keyword} ... {keyword} {page-turner}
        let lastArg = args[args.length - 1];

        if (lastArg?.startsWith(PAGE_TURNER)) {
            page = parsePage(lastArg) + 1;
            if (page > 1) {
                // If page > 1, means the last arg is a page tuner,
                // we should pop up the last arg.
                args.pop();
            }
        }
        // The rest keywords is the query.
        query = args;
    }
    return { query: query.join(" "), page };
}

export class HeadlessOmnibox {
    constructor({ onSearch, onFormat, onAppend, defaultSuggestion, maxSuggestionSize = 8 }) {
        // The render instance is not required for headless omnibox.
        this.render = null;
        this.browserType = Compat.browserType();
        this.maxSuggestionSize = maxSuggestionSize;
        this.defaultSuggestionDescription = this.escapeDescription(defaultSuggestion);
        this.defaultSuggestionContent = null;
        this.globalEvent = new QueryEvent({
            onSearch,
            onFormat,
            onAppend,
        });
        this.queryEvents = [];
        // Cache the last query and result to speed up the page down.
        this.cachedQuery = null;
        this.cachedResult = null;
        this.cachedAppendixes = [];
        // A set of query which should not be cached.
        this.noCacheQueries = new Set();
        // Whether running in browser extension mode. Default is false in headless mode.
        this.extensionMode = false;
    }

    escapeDescription(description) {
        if (this.extensionMode && this.browserType === 'firefox') {
            // Firefox doesn't support tags in search suggestion.
            return Compat.eliminateTags(description);
        } else {
            return description
        }
    }

    setDefaultSuggestion(description, content) {
        if (this.extensionMode) {
            chrome.omnibox.setDefaultSuggestion({ description });
        }

        if (content) {
            this.defaultSuggestionContent = content;
        }
    }

    /**
     * Search the result by input.
     * 
     * @param {string} input 
     * @returns 
     */
    async search(input) {
        let { query, page } = parseInput(input);
        let results;
        let appendixes = [];

        // Always perform search if query is a noCachedQuery, then check whether equals to cachedQuery
        if (this.noCacheQueries.has(query) || this.cachedQuery !== query) {
            let searchResult = await this.performSearch(query);
            results = searchResult.result;
            appendixes = searchResult.appendixes.map(({ content, description }) => {
                return {
                    content,
                    description: this.escapeDescription(description),
                }
            });

            this.cachedQuery = query;
            this.cachedResult = results;
            this.cachedAppendixes = appendixes;
        } else {
            results = this.cachedResult;
            appendixes = this.cachedAppendixes;
        }

        let totalPage = Math.ceil(results.length / this.maxSuggestionSize);
        const paginationTip = ` | Page [${page}/${totalPage}], append '${PAGE_TURNER}' to page down`;
        let uniqueUrls = new Set();
        // Slice the page data then format this data.
        results = results.slice(this.maxSuggestionSize * (page - 1), this.maxSuggestionSize * page);
        let pageSize = results.length;
        results = await Promise.all(results
            .map(async ({ event, ...item }, index) => {
                if (event) {
                    // onAppend result has no event.
                    item = await event.format(item, index);
                }
                if (uniqueUrls.has(item.content)) {
                    item.content += `?${uniqueUrls.size + 1}`;
                }
                if (index == 0) {
                    // Add pagination tip in the first item.
                    item.description += paginationTip;
                } else if (totalPage > 1 && pageSize > 2 && index === pageSize - 1) {
                    // Add pagination tip in the last item.
                    item.description += paginationTip;
                }
                // escape the description
                item.description = this.escapeDescription(item.description);
                uniqueUrls.add(item.content);
                return item;
            }));
        if (results.length > 0 && this.extensionMode) {
            let { content, description } = results.shift();
            // Store the default description temporary.
            defaultDescription = description;
            this.setDefaultSuggestion(description, content);
        }
        results.push(...appendixes);
        return { results, page, totalPage };
    }

    async performSearch(query) {
        let result;
        let appendixes = [];
        let matchedEvent = this.queryEvents
            .sort((a, b) => {
                // Descend sort query events by prefix length to prioritize
                // the longer prefix than the shorter one when performing matches
                if (a.prefix && b.prefix) {
                    return b.prefix.length - a.prefix.length;
                }
                return 0;
            }).find(event => {
                return (event.prefix && query.startsWith(event.prefix)) || (event.regex?.test(query));
            });

        if (matchedEvent) {
            if (this.render && this.hintEnabled && matchedEvent.name) {
                this.render.setHint(matchedEvent.name);
            }
            result = await matchedEvent.performSearch(query);
            if (matchedEvent.onAppend) {
                appendixes.push(...await matchedEvent.onAppend(query));
            }
        } else {
            if (this.render && this.hintEnabled) {
                this.render.removeHint();
            }
            result = await this.globalEvent.performSearch(query);
            let defaultSearchEvents = [];
            for (let event of this.queryEvents) {
                // The isDefaultSearch hook method is preferred over defaultSearch property.
                if (event.isDefaultSearch) {
                    if (await event.isDefaultSearch()) {
                        defaultSearchEvents.push(event);
                    }
                } else if (event.defaultSearch) {
                    defaultSearchEvents.push(event);
                }
            }
            defaultSearchEvents.sort((a, b) => a.searchPriority - b.searchPriority);

            let defaultSearchAppendixes = [];
            for (let event of defaultSearchEvents) {
                result.push(...await event.performSearch(query));
                if (event.onAppend) {
                    defaultSearchAppendixes.push(...await event.onAppend(query));
                }
            }

            if (this.globalEvent.onAppend) {
                appendixes.push(...await this.globalEvent.onAppend(query));
            }
            appendixes.push(...defaultSearchAppendixes);
        }
        return { result, appendixes };
    }

    addNoCacheQueries(...queries) {
        queries.forEach(query => this.noCacheQueries.add(query));
    }

    addQueryEvent(event) {
        this.queryEvents.push(event);
    }

    addPrefixQueryEvent(prefix, event) {
        this.addQueryEvent(new QueryEvent({
            prefix,
            ...event,
        }));
        this.noCacheQueries.add(prefix);
    }

    addRegexQueryEvent(regex, event) {
        this.addQueryEvent(new QueryEvent({
            regex,
            ...event,
        }));
    }
}

export default class Omnibox {
    constructor({ render, hint = false }) {
        this.render = render;
        this.extensionMode = !(render instanceof Render);
        if (this.extensionMode) {
            this.hintEnabled = false;
        } else {
            this.hintEnabled = hint;
        }
    }

    /**
     * Copy all properties from the headless instance
     * 
     * @param {HeadlessOmnibox} headless 
     */
    extendFromHeadless(headless) {
        const desiredProps = Object.fromEntries(
            Object.entries(headless).filter(([key]) => !['render', 'extensionMode', 'hintEnabled'].includes(key))
        );
        // Copy all properties from the headless instance
        Object.assign(this, desiredProps);
        // Copy methods from the headless instance
        Object.getOwnPropertyNames(Object.getPrototypeOf(headless)).forEach(method => {
            if (method !== 'constructor' && typeof headless[method] === 'function') {
                this[method] = headless[method].bind(this);
            }
        });

    }

    static extension() {
        return new Omnibox({
            render: chrome.omnibox,
        });
    }

    static webpage({ element, el, icon, placeholder, onFooter, hint = true }) {
        return new Omnibox({
            render: new Render({ element, el, icon, placeholder, onFooter }),
            hint,
        });
    }

    bootstrap({
        onEmptyNavigate,
        beforeNavigate,
        afterNavigated
    } = {}) {
        if (this.extensionMode) {
            this.setDefaultSuggestion(this.defaultSuggestionDescription);
        }
        let results;
        let currentInput;
        let defaultDescription;

        this.render.onInputChanged.addListener(async (input, suggestFn) => {
            // Set the default suggestion content to input instead null,
            // this could prevent content null bug in onInputEntered().
            this.defaultSuggestionContent = input;
            if (!input) {
                this.setDefaultSuggestion(this.defaultSuggestionDescription);
                return;
            }

            currentInput = input;
            let searchResult = await this.search(input);
            results = searchResult.results;
            suggestFn(results, { curr: searchResult.page, total: searchResult.totalPage });
        });

        this.render.onInputEntered.addListener(async (content, disposition) => {
            let result;
            // Give beforeNavigate a default function
            beforeNavigate = beforeNavigate || (async (_, s) => s);

            // A flag indicates whether the url navigate success
            let navigated = false;
            // The first item (aka default suggestion) is special in Chrome extension API,
            // here the content is the user input.
            if (content === currentInput) {
                content = await beforeNavigate(this.cachedQuery, this.defaultSuggestionContent);
                result = {
                    content,
                    description: defaultDescription,
                };
                if (URL_PROTOCOLS.test(content)) {
                    Omnibox.navigateToUrl(content, disposition);
                    navigated = true;
                }
            } else {
                // Store raw content before navigate to find the correct result
                let rawContent = content;
                result = results.find(item => item.content === rawContent);
                content = await beforeNavigate(this.cachedQuery, content);
                if (URL_PROTOCOLS.test(content)) {
                    Omnibox.navigateToUrl(content, disposition);
                    navigated = true;

                    // Ensure the result.content is the latest,
                    // since the content returned by beforeNavigate() could be different from the raw one.
                    if (result) {
                        result.content = content;
                    }
                }
            }

            if (navigated && afterNavigated) {
                await afterNavigated(this.cachedQuery, result);
            } else if (onEmptyNavigate) {
                await onEmptyNavigate(content, disposition);
            }

            if (this.extensionMode) {
                this.setDefaultSuggestion(this.defaultSuggestionDescription);
            } else {
                this.render.resetSearchKeyword();
            }
        });
    }

    /**
     * Open the url according to the disposition rule.
     *
     * Disposition rules:
     * - currentTab: enter (default)
     * - newForegroundTab: alt + enter
     * - newBackgroundTab: meta + enter
     */
    static navigateToUrl(url, disposition) {
        url = url.replace(/\?\d+$/ig, "");
        if (disposition === "currentTab") {
            if (Compat.isRunningInWebExtension()) {
                chrome.tabs.query({ active: true }, tab => {
                    chrome.tabs.update(tab.id, { url });
                });
            } else {
                location.href = url;
            }
        } else {
            // newForegroundTab, newBackgroundTab
            if (Compat.isRunningInWebExtension()) {
                chrome.tabs.create({ url });
            } else {
                window.open(url);
            }
        }
    }
}