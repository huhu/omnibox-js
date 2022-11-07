class Render {
    constructor({ inputElement }) {
        this.onInputChanged = new OnInputChangedListener();
        this.onInputEntered = new OnInputEnteredListener();

        this.inputBox = document.querySelector(inputElement);
        let suggestFn = this.suggest.bind(this);
        this.inputBox.oninput = async (event) => {
            let input = event.target.value;
            if (input) {
                for (const listener of this.onInputChanged.listeners) {
                    await listener(input, suggestFn);
                }
            } else {
                let dropdown = document.querySelector('.omnibox-js-dropdown');
                if (dropdown) {
                    dropdown.remove();
                }
            }
        };
    }

    suggest(suggestions) {
        let items = [];
        for (let { content, description } of suggestions) {
            console.log(content, description);
            items.push(`<li class="">${parseOmniboxDescription(description)}</li>`);
        }
        this.inputBox.insertAdjacentHTML('afterend', `
            <ul class="omnibox-js-dropdown">${items.join('')}</ul>
        `);
    }
}

class OnInputChangedListener {
    constructor() {
        this.listeners = [];
    }

    addListener(listener) {
        if (listener) {
            this.listeners.push(listener);
        }
    }
}

class OnInputEnteredListener {
    constructor() {
        this.listeners = [];
    }

    addListener(listener) {
        if (listener) {
            this.listeners.push(listener);
        }
    }
}

// Remove invalid characters from text.
function sanitizeString(text, shouldTrim) {
    // NOTE: This logic mirrors |AutocompleteMatch::SanitizeString()|.
    // 0x2028 = line separator; 0x2029 = paragraph separator.
    let removeChars = /(\r|\n|\t|\u2028|\u2029)/gm;
    if (shouldTrim)
        text = text.trimLeft();
    return text.replace(removeChars, '');
}

function parseOmniboxDescription(input) {
    let domParser = new DOMParser();

    // The XML parser requires a single top-level element, but we want to
    // support things like 'hello, <match>world</match>!'. So we wrap the
    // provided text in generated root level element.
    let root = domParser.parseFromString(
        '<fragment>' + input + '</fragment>', 'text/xml');

    // DOMParser has a terrible error reporting facility. Errors come out nested
    // inside the returned document.
    let error = root.querySelector('parsererror div');
    if (error) {
        throw new Error(error.textContent);
    }

    // Otherwise, it's valid, so build up the description result.
    let description = '';

    // Recursively walk the tree.
    function walk(node) {
        for (let i = 0, child; child = node.childNodes[i]; i++) {
            // Append text nodes to our description.
            if (child.nodeType === Node.TEXT_NODE) {
                let shouldTrim = description.length === 0;
                description += sanitizeString(child.nodeValue, shouldTrim);
                continue;
            }

            // Process and descend into a subset of recognized tags.
            if (child.nodeType === Node.ELEMENT_NODE &&
                (child.nodeName === 'dim' || child.nodeName === 'match' ||
                    child.nodeName === 'url')) {
                description += `<span class="omnibox-js-${child.nodeName}">`;
                walk(child);
                description += "</span>";
                continue;
            }

            // Descend into all other nodes, even if they are unrecognized, for
            // forward compat.
            walk(child);
        }
    };
    walk(root);

    return description;
}