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

## [HIP-R](https://github.com/lukeburns/hipr) Hyperzone Resolver

A recursive resolver that intercepts and claims authority for domains with a hip5 record of the form
`pubkey._hyper.` or `pubkey.ns.direct.` --- my unstable, experimental fallback hyperzone resolver.

To get started, you must have a local hsd or hnsd node running, with the root nameserver exposed. For example, if you use Bob Wallet, you can enable DNS Servers in the settings, your root server will be `127.0.0.1:5349`. You will need this below.

```
git clone https://github.com/lukeburns/hyperzone
cd hyperzone && npm install
```

Now running
```
node bin/recurse 127.0.0.1 5349 127.0.0.1 8888
```
will start a recursive resolver running on `127.0.0.1:8888` that intercepts and serves hyperzones.

I will add more details here on replicating hyperzones that your resolver can locate soon...
