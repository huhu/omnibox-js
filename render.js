import { parseInput, PAGE_TURNER } from "./omnibox.js";

const DISPOSITION_CURRENT_TAB = 'currentTab'; // enter (default)
const DISPOSITION_FOREGROUND_TAB = 'newForegroundTab'; // alt + enter
const DISPOSITION_BACKROUND_TAB = 'newBackgroundTab'; // meta + enter

export const OMNIBOX_HTML = `
<div class="omn-container">
    <textarea class="omn-input"
    autocapitalize="off" autocomplete="off" autocorrect="off" 
    maxlength="2048" role="combobox" rows="1" style="resize:none"
    spellcheck="false"></textarea>
    <div class="omn-clear">
    <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
    </div>
    <div class="omn-search-icon">
    <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>
    </div>
</div>`;

export class Render {
    constructor({ el, element, icon, placeholder, onFooter }) {
        if (!el && !element) {
            throw new Error("`el` or `element` is required");
        }

        if (!element) {
            element = document.querySelector(el);
            if (!element) {
                throw new Error(`not element found: ${el}`);
            }

            if (element.tagName !== "DIV") {
                throw new Error("The `el` can only be `div` tag");
            }

            if (element.children.length > 0) {
                throw new Error("The `el` element should have no child elements");
            }
            element.style.position = "relative";
            element.innerHTML = OMNIBOX_HTML;
        }
        this.container = document.querySelector(".omn-container");
        this.inputBox = element.querySelector("textarea");
        this.searchKeyword = "";
        if (placeholder) {
            this.inputBox.setAttribute("placeholder", placeholder);
        }
        this.icon = icon;
        this.onInputChanged = new OnInputChangedListener();
        this.onInputEntered = new OnInputEnteredListener();
        this.disposition = DISPOSITION_CURRENT_TAB;
        this.onFooter = onFooter;

        this.clearButton = document.querySelector(".omn-clear");
        if (this.clearButton) {
            this.clearButton.onclick = () => {
                this.inputBox.value = "";
                this.clearDropdown();
                this.removeHint();
                this.clearButton.style.display = "none";
            };
        }

        this.trigger = async (event) => {
            this.searchKeyword = event.target.value;
            await this.render();
        };
        this.inputBox.oninput = this.trigger;
        this.inputBox.onfocus = this.trigger;
        this.inputBox.addEventListener("keydown", (event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === "Enter") {
                // Prevent the default behavior of arrow up and arrow down keys
                event.preventDefault();
            }
        });
        document.addEventListener('click', (event) => {
            if (!event.composedPath().includes(element)) {
                // Click outside to clear dropdown
                this.resetSearchKeyword();
            }
        });
        document.addEventListener('keydown', async (event) => {
            switch (event.code) {
                case 'Enter': {
                    let selected = document.querySelector('.omn-selected');
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
                    let selected = document.querySelector('.omn-selected');
                    if (selected) {
                        let newSelected = null;
                        if (selected.previousElementSibling) {
                            newSelected = selected.previousElementSibling;
                        } else {
                            // Already selected the fist item, but a arrow-up key pressed,
                            // select the last item.
                            newSelected = document.querySelector('.omn-dropdown-item:last-child');
                        }

                        if (newSelected) {
                            selected.classList.remove('omn-selected');
                            newSelected.classList.add('omn-selected')
                            this.inputBox.value = newSelected.getAttribute('data-value');
                        }
                    }
                    break;
                }
                case 'ArrowDown': {
                    let selected = document.querySelector('.omn-selected');
                    if (selected) {
                        let newSelected = null;
                        if (selected.nextElementSibling) {
                            newSelected = selected.nextElementSibling;
                        } else {
                            // Already selected the last item, but a arrow-up key pressed,
                            // select the fist item.
                            newSelected = document.querySelector('.omn-dropdown-item:first-child');
                        }

                        if (newSelected) {
                            selected.classList.remove('omn-selected');
                            newSelected.classList.add('omn-selected')
                            this.inputBox.value = newSelected.getAttribute('data-value');
                        }
                    }
                    break;
                }
                case 'Escape': {
                    this.resetSearchKeyword();
                    break;
                }
            }
        });
    }

    async render() {
        if (this.searchKeyword) {
            let suggestFn = this.suggest.bind(this);
            for (const listener of this.onInputChanged.listeners) {
                await listener(this.searchKeyword, suggestFn);
            }
            if (this.clearButton) {
                this.clearButton.style.display = "block";
            }
        } else {
            this.removeHint();
            this.clearDropdown();
            if (this.clearButton) {
                this.clearButton.style.display = "none";
            }
        }
    }

    resetSearchKeyword() {
        // Reset the input box value to the search keyword
        this.inputBox.value = this.searchKeyword;
        this.clearDropdown();
    }

    clearDropdown() {
        this.container.classList.remove("omn-filled");

        let dropdown = document.querySelector('.omn-dropdown');
        if (dropdown) {
            dropdown.remove();
        }
    }

    setHint(hintText) {
        this.removeHint();
        let hintElement = document.createElement('div');
        hintElement.classList.add('omn-hint');
        hintElement.textContent = hintText;
        this.container.insertAdjacentHTML('afterbegin', `
        <div class="omn-hint">${hintText}<div class="omn-hint-gapline"></div></div>
        `);
    }

    removeHint() {
        let hint = document.querySelector('.omn-hint');
        if (hint) {
            hint.remove();
        }
    }

    async pageDown() {
        if (this.searchKeyword) {
            let { query, page } = parseInput(this.searchKeyword);
            if (!query) {
                page += 1;
            }
            this.searchKeyword = `${query} ${PAGE_TURNER.repeat(page)}`;
            await this.render();
        }
    }

    async pageUp() {
        if (this.searchKeyword) {
            let { query, page } = parseInput(this.searchKeyword);
            if (query) {
                page -= 1;
            }
            if (page > 0) {
                this.searchKeyword = `${query} ${PAGE_TURNER.repeat(Math.max(0, page - 1))}`;
            }
            await this.render();
        }
    }

    /**
     * 
     * @param {Array[{content, description}]} suggestions 
     * @param {curr, total} pagination 
     */
    suggest(suggestions, pagination) {
        this.clearDropdown();
        this.container.classList.add("omn-filled");

        let dropdown = document.createElement('div');
        dropdown.classList.add('omn-dropdown');

        let gapline = document.createElement("div");
        gapline.classList.add("omn-gapline");
        dropdown.appendChild(gapline);

        let items = document.createElement("div");
        for (let [index, { content, description }] of suggestions.entries()) {
            let li = document.createElement("div");
            li.classList.add("omn-dropdown-item");
            li.style.position = "relative";
            li.setAttribute("data-content", content);
            if (index === 0) {
                // Always select the first item by default.
                li.classList.add('omn-selected');
                // Set the inputbox value as data-value, similar to chrome.omnibox API
                li.setAttribute("data-value", this.inputBox.value);
            } else {
                li.setAttribute("data-value", content);
            }
            li.innerHTML = `<div class="omn-dropdown-indicator"></div>
                            <a href="${content}">
                            ${this.icon ? `<img src=\"${this.icon}\"/>` : ""}
                            ${parseOmniboxDescription(description)}
                            </a>`;
            items.appendChild(li);
        }
        dropdown.appendChild(items);
        if (pagination && this.onFooter) {
            let footer = this.onFooter(this, pagination);
            if (footer) {
                dropdown.appendChild(footer);
            }
        }
        this.container.insertAdjacentElement('afterend', dropdown);
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

function parseOmniboxDescription(input) {
    return input.replaceAll("<match>", "<span class='omn-match'>")
        .replaceAll("</match>", "</span>")
        .replaceAll("<dim>", "<span class='omn-dim'>")
        .replaceAll("</dim>", "</span>");
}