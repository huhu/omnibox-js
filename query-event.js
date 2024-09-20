export default class QueryEvent {
    constructor({
        name,
        onSearch,
        onFormat = undefined,
        onAppend = undefined,
        prefix = undefined,
        regex = undefined,
        defaultSearch = false,
        isDefaultSearch = undefined,
        searchPriority = 0,
        icon = undefined,
    }) {
        // The search function which should return a object array.
        this.onSearch = onSearch;
        // The format function which should return {content, description} object.
        this.onFormat = onFormat;
        this.onAppend = onAppend;

        this.name = name;
        this.icon = icon;
        this.prefix = prefix;
        this.regex = regex;
        // Whether enable the query as a default search.
        // Default search means user can perform search without any sigils.
        this.defaultSearch = defaultSearch;
        // The hook method to enable default search dynamically.
        // This hook method is preferred over defaultSearch property.
        this.isDefaultSearch = isDefaultSearch;
        // The default search priority. The smaller, the higher.
        this.searchPriority = searchPriority;

        // The search keyword the user inputted for searching.
        this.searchedInput = "";
    }

    async performSearch(input) {
        this.searchedInput = input;
        let result = await this.onSearch(input);
        return result.map(item => {
            // Create a new object to avoid modifying the original item.
            return {
                ...item,
                icon: this.icon,
                event: this,
            };
        });
    }

    // Format the result item.
    async format(item, index) {
        if (this.onFormat) {
            item = await this.onFormat(index, item, this.searchedInput);
        }
        return item;
    }
};