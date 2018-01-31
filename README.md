# RainCache-Mongo
*Bringing MongoDB support to @DasWolke's [RainCache](https://github.com/DasWolke/RainCache) since 2018*

## Purpose
Currently, RainCache, though designed to be extensible with other "storage engines", only supports storing data in [Redis](https://redis.io). This package sets out to provide [MongoDB](https://mongodb.com) support by creating an easy-to-use `MongoStorageEngine`.

## How to use

Install by running this:

```shell
$ npm install raincache-mongo --save
```

Then initialize RainCache like so:

```javascript
const RainCache = require("raincache");
const {MongoClient} = require("mongodb");

const {MongoStorageEngine} = require("raincache-mongo");

db.connect().then((client) => {
    let connector = new RainCache.Connectors.AmqpConnector();
    let db = client.db("dbName");
    
    let cache = new RainCache({
        storage: {
            default: new MongoStorageEngine({
                db: db
            })
        }
    }, connector, connector);
});
```

By default, `MongoStorageEngine` will store RainCache data in the `raincache` and `raincachelists` collections.

## Building and Testing

***NOTE:** This section is only for those who want to contribute or tinker with raincache-mongo.*

`raincache-mongo` is written in [TypeScript](https://www.typescriptlang.org), a superset of JavaScript. As such, it must be compiled down to regular JavaScript whenever changes are made.

Compiling/building `raincache-mongo` can be done in one command:
```shell
$ npm run build
```

To perform unit testing on `raincache-mongo` (after you've run `npm run build`), use:
```shell
$ npm test
```

Building and testing can be combined into a single command, like so:
```shell
$ npm run build:test
```
