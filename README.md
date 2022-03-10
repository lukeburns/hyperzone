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

## Client

To manage your hyperzone, install the hyperzone client CLI 
```
npm i -g hyperzone
``` 

Then you can run 
```
hyperzone example.com
``` 
to create and manage a zone for `example.com`.

## Server

If you'd like to resolve hyperzones locally, you can use the [hipr-hyperzone](https://github.com/lukeburns/hipr-hyperzone) middleware for [hipr](https://github.com/lukeburns/hipr).

If you don't have [hipr](https://github.com/lukeburns/hipr) installed, you can install the CLI with
```
npm i -g hipr
```
then you can install the `hipr-hyperzone` middleware
```
hipr install hipr-hyperzone
```
and spin up a server
```
hipr hipr-hyperzone 127.0.0.1:53 127.0.0.1:5349
```

This starts a recursive server on port 53 capable of resolving hyperzones using a local hsd authoritative nameserver running on port 5349. You may need to use `sudo` to listen on port 53.
