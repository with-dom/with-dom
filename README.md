# With-DOM // Simple, Functional Frontend

With-DOM aims to be a Javascript alternative to [day8/re-frame](https://github.com/day8/re-frame) when Clojurescript is not an option.

## Installation

First, you have to install With-DOM:

```bash
npm install @with-dom/with-dom
```

Currently, With-DOM is meant to be used with Preact 10.x (as a peer dependency),
so make sure you have it also installed:

```bash
npm install preact@10.x
```

> [!NOTE]  
> It is planned to be able to remove this peer dependency to preact and to be able to choose a different library (or no library at all).

## Get Started

A "feature" is typically composed of X pieces when using With-DOM.

For example, to create a Product detail view, you would:

- Already have a *root Subscriber* for all of the products:

```javascript
const productsSub = registerSubscriber((appState) => {
    return appState.get("products");
});
```

- You would then create a *Subscriber* for a specific product:

```javascript
const productSub = registerSubscriber([productsSub], ([products], productId) => {
    return products?.find(p => p.id === productId);
});
```

- To get the list of all the products, you would have created an Fx and two FxHandlers:

```javascript
const httpFetch = registerFx(({
    url,
    method,
    body,
    onSuccess = () => {},
}) => {
    fetch(url, {
        method: method,
        body: body,
    }).then(response => response.json().then(onSuccess);
});

const fetchProductsSuccess = registerFxHandler((appState, response) => {
    return {
        [updateAppState]: produce(appState, (appState) => {
            appState.set("products", response)
        }),
    };
});

const fetchProducts = registerFxHandler((appState) => {
    return {
        [httpFetch]: {
            url: "https://example.com/api/products",
            method: "GET",
            onSuccess: (response) => dispatch(fetchProductsSuccess, response)
        },
    };
});
```

- And finally, your component would look like this:

```javascript
function ProductDetail() {
    useEffect(() => {
        dispatch(fetchProducts);
    }, []);

    const product = subscribe(productSub, productIdFromTheUrl);

    return (
        <>
            { product ? (
                <h1>Product: { product.name }</h1>
                <p>Description: { product.description }</p>
            ) : (
                <div>[insert a loading spinner]</div>
            )}
        </>
    );
}
```

The complete app example can be found <TODO>.

## API documentation

TODO
