#!/usr/bin/env node

const Hyperzone = require('..')
const Replicator = require('@hyperswarm/replicator')
const base32 = require('bs32')
const assert = require('assert')

// Currently, this only adds some dummy records.
// TODO:
// - add/remove records with cli

// name of zone to create and replicate
let name = process.argv[2]
assert(typeof name === 'string')

const zoneDir = `./s`
name = name[name.length - 1] == '.' ? name : name + '.' // FQDN
const zone = new Hyperzone(name, `${zoneDir}/${name}`)

// Insert Dummy TXT records
const batch = new Array(2)
for (var i = 0; i < batch.length; i++) {
  batch[i] = { key: `TXT/${i}`, value: `@ 0 IN TXT "hello world ${i} <3 ${zone.name}"` }
}
batch[2] = { key: `A/0`, value: `@ 3600 IN A 66.42.108.201` }
zone.db.batch(batch, async () => {
  const res = await zone.resolve(name, 'TXT')
})

const replicator = new Replicator()
main()

async function main () {
  await zone.ready()
  const keyPair = {
    publicKey: zone.db.key,
    secretKey: zone.db.secretKey
  }
  console.log('digest', zone.digest.toString('hex'))
  const encoded = base32.encode(zone.db.key)
  console.log('public key (base32)', encoded)
  console.log('public key (hex)', base32.decode(encoded).toString('hex'))

  replicator.add(zone.db, { server: true, client: false })
}
