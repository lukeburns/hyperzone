# Hyperzone

Cryptographically verifiable and replicable DNSSEC-enabled zone storage

## Usage

```js
const zone = new Hyperzone('example.')
await zone.ready()

await zone.DS() // place this DS record in your parent zone
const rskey = await zone.put(`@ 3600 IN TXT "hello world"`) // add and sign a TXT record
await zone.resolve('example.', 'TXT') // resolve records in your authoritative resolver
await zone.del(rskey) // delete record set
```