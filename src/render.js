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
            items.push(`<li class="">${description}</li>`);
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