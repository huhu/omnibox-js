class Render {
    constructor({ inputElement }) {
        this.onInputChanged = new OnInputChangedListener();
        this.onInputEntered = new OnInputEnteredListener();

        this.inputBox = document.querySelector(inputElement);
        this.inputBox.oninput = (event) => {
            let input = event.target.value;
            this.onInputChanged.listeners.forEach(listener => {
                listener(input, this.suggest);
            });
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