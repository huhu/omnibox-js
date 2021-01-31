class Render {
    constructor() {
        this.onInputChanged = new OnInputChangedListener();
    }

    start({element}) {
        let root = document.querySelector(element);
        let inputBox = document.createElement('input');
        inputBox.oninput = (event) => {
            let input = event.target.value;
            this.onInputChanged.listeners.forEach(listener => {
                listener(input, this.suggest);
            });
        };
        root.appendChild(inputBox);
    }

    suggest(suggestions) {
        for (let {content, description} of suggestions) {
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