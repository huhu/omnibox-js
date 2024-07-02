# omnibox-js

Turn your `div` label into [chrome omnibox](https://developer.chrome.com/docs/extensions/reference/api/omnibox).

## Overview

A list of projects based on this library:

- [https://query.rs](https://query.rs)
- [Rust Search Extension](https://github.com/huhu/rust-search-extension)
- [Go Search Extension](https://github.com/huhu/go-search-extension)
- [C/C++ Search Extension](https://github.com/huhu/cpp-search-extension)
- [Kubernetes Search Extension](https://github.com/huhu/k8s-search-extension)
- [Js Search Extension](https://github.com/huhu/js-search-extension)
- [AWS Search Extension](https://github.com/pitkley/aws-search-extension)
- [R Search Extension](https://github.com/ShixiangWang/r-search-extension)

## API

### Omnibox

**constructor({ render, defaultSuggestion, maxSuggestionSize = 8, hint = false })**

```js
let omnibox = new Omnibox({
  render: new Render(),
  // The default suggestion title.
  defaultSuggestion: "A handy search extension.",
  // Max suggestion size for per page.
  maxSuggestionSize: 8,
});
```

**bootstrap(config)**

Bootstrap the omnibox.

- **config**: The configuration object to bootstrap the Omnibox.

```js
{
    // The default global search function
    onSearch: function(query){},
    onFormat: function(index, item){},
    onAppend: function(query){},
    onEmptyNavigate: function(content, disposition) {},
    beforeNavigate: function(content) {},
    afterNavigated: function(query, result) {},
}
```

- **config.onSearch**: A hook function to perform the default search.
- **config.onFormat**: A hook function to format the search result.
- **config.onAppend**: A hook function append the custom item to the result list.
- **config.beforeNavigate**: A hook function to before URL navigate. You have the last chance to modify the url before it navigated.
- **config.afterNavigate**: A hook function to after URL navigated. You have the chance to record the history here.
- **config.onEmptyNavigate**: If the content is a Non-URL which would navigate failed, then fallback to this hook function.

The `onSearch`, `beforeNavigate`, `afterNavigated`, and `onEmptyNavigate` in `Omnibox::boostrap(config)` can be `async` function.

**addPrefixQueryEvent(prefix, event)**

Add prefix query event.

**addRegexQueryEvent(regex, event)**

Add regex query event.

### QueryEvent

```js
{
    name,
    onSearch,
    onFormat = undefined,
    onAppend = undefined,
    prefix = undefined,
    regex = undefined,
    // Whether enable the query as a default search.
    // Default search means user can perform search without any sigils.
    defaultSearch = false,
    // The hook method to enable default search dynamically.
    // This hook method is preferred over defaultSearch property.
    isDefaultSearch = undefined,
    // The default search priority. The smaller, the higher.
    searchPriority = 0
}
```

The `onSearch` can be `async` function.

## Render

**constructor({ el, icon, placeholder })**

## Example

```
$ npx serve
   ┌───────────────────────────────────────────┐
   │                                           │
   │   Serving!                                │
   │                                           │
   │   - Local:    http://localhost:3000       │
   │   - Network:  http://192.168.1.122:3000   │
   │                                           │
   │   Copied local address to clipboard!      │
   │                                           │
   └───────────────────────────────────────────┘

$ open http://localhost:3000/examples/
```

## License

Licensed under Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
