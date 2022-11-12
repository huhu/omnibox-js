const DISPOSITION_CURRENT_TAB = 'currentTab'; // enter (default)
const DISPOSITION_FOREGROUND_TAB = 'newForegroundTab'; // alt + enter
const DISPOSITION_BACKROUND_TAB = 'newBackgroundTab'; // meta + enter

class Render {
    constructor({ inputElement }) {
        this.onInputChanged = new OnInputChangedListener();
        this.onInputEntered = new OnInputEnteredListener();
        this.disposition = DISPOSITION_CURRENT_TAB;
        this.inputBox = document.querySelector(inputElement);

        let suggestFn = this.suggest.bind(this);
        this.inputBox.oninput = async (event) => {
            this.clearDropdown();

            let input = event.target.value;
            if (input) {
                for (const listener of this.onInputChanged.listeners) {
                    await listener(input, suggestFn);
                }
            }
        };

        document.addEventListener('keyup', async (event) => {
            console.log('keyup:', event);
            switch (event.code) {
                case 'Enter': {
                    let selected = document.querySelector('.omn-dropdown-item.omn-selected');
                    if (selected) {
                        if (event.metaKey) {
                            this.disposition = DISPOSITION_BACKROUND_TAB;
                        } else if (event.altKey) {
                            this.disposition = DISPOSITION_FOREGROUND_TAB;
                        } else {
                            this.disposition = DISPOSITION_CURRENT_TAB;
                        }

                        let content = selected.getAttribute('data-content');
                        for (const listener of this.onInputEntered.listeners) {
                            await listener(content, this.disposition);
                        }
                    }
                    break;
                }
                case 'ArrowUp': {
                    let selected = document.querySelector('.omn-dropdown-item.omn-selected');
                    if (selected) {
                        if (selected.previousElementSibling) {
                            selected.previousElementSibling.classList.add('omn-selected');
                        } else {
                            // Already selected the fist item, but a arrow-up key pressed,
                            // select the last item.
                            let lastChild = document.querySelector('.omn-dropdown-item:last-child');
                            if (lastChild) {
                                lastChild.classList.add('omn-selected');
                            }
                        }

                        selected.classList.remove('omn-selected');
                    }
                    break;
                }
                case 'ArrowDown': {
                    let selected = document.querySelector('.omn-dropdown-item.omn-selected');
                    if (selected) {
                        if (selected.nextElementSibling) {
                            selected.nextElementSibling.classList.add('omn-selected');
                        } else {
                            // Already selected the last item, but a arrow-up key pressed,
                            // select the fist item.
                            let firstChild = document.querySelector('.omn-dropdown-item:first-child');
                            if (firstChild) {
                                firstChild.classList.add('omn-selected');
                            }
                        }
                        selected.classList.remove('omn-selected');
                    }
                    break;
                }
                case 'Escape': {
                    this.clearDropdown();
                    break;
                }
            }
        });
    }

    clearDropdown() {
        let dropdown = document.querySelector('.omn-dropdown');
        if (dropdown) {
            dropdown.remove();
        }
    }

    suggest(suggestions) {
        let ul = document.createElement('ul');
        ul.classList.add('omn-dropdown');
        for (let [index, { content, description }] of suggestions.entries()) {
            let li = document.createElement('li');
            li.setAttribute('data-content', content);
            li.classList.add('omn-dropdown-item');
            if (index === 0) {
                // Always select the first item by default.
                li.classList.add('omn-selected');
            }
            li.onclick = async () => {
                for (const listener of this.onInputEntered.listeners) {
                    await listener(content, this.disposition);
                }
            };
            li.innerHTML = parseOmniboxDescription(description);
            ul.appendChild(li);
        }
        this.inputBox.insertAdjacentElement('afterend', ul);
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
                description += `<span class="omn-${child.nodeName}">`;
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