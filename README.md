# Hyperzone

## Usage

```js
const zone = new Hyperzone('example.')
await zone.ready()

await zone.DS() // place this DS record in your parent zone
await zone.put(`@ 3600 IN TXT "hello world"`) // add and sign a TXT record
await zone.resolve('example.', 'TXT') // resolve records in your authoritative resolver
```

## API

```js
await zone.ready()
```

```js
await zone.resolve(name, type)
```

```js
rskey = await zone.put(recordSetString)
```

```js
await zone.del(rskey)
```
