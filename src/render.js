class Render {
    constructor({inputElement}) {
        this.onInputChanged = new OnInputChangedListener();
        this.onInputEntered = new OnInputEnteredListener();

        this.inputBox = document.querySelector(inputElement);
        this.inputBox.oninput = async (event) => {
            let input = event.target.value;
            for (const listener of this.onInputChanged.listeners) {
                await listener(input, this.suggest);
            }
        };
    }

    suggest(suggestions) {
        for (let { content, description } of suggestions) {
            console.log(content, description);
        }
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