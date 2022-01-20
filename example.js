const Hyperzone = require('.')
const Replicator = require('@hyperswarm/replicator')
const base32 = require('bs32')
const assert = require('assert')
const { wire, Zone } = require('bns')

// name of zone to create and replicate
let name = 'test.'

const zoneDir = `./s`
name = name[name.length - 1] == '.' ? name : name + '.' // FQDN
const zone = new Hyperzone(name, `${zoneDir}/${name}`)

// Insert Dummy TXT records
const batch = new Array(2)
for (var i = 0; i < batch.length; i++) {
  batch[i] = { key: `TXT/${i}`, value: `${name} 0 IN TXT "hello world ${i} <3 ${name}"` }
}
batch[2] = { key: `A/0`, value: `${name} 3600 IN A 66.42.108.201` }
zone.db.batch(batch, async () => {
  const res = await zone.resolve(name, wire.types.TXT)
  console.log(res)
})

main()

async function main () {
  // const z = new Zone()
  // await zone.ready()
  // zone.db.createReadStream('TXT', { recursive: false })
  //   // .on('error', reject)
  //   .on('data', data => {
  //     console.log(data.value.toString())
  //     z.fromString(data.value.toString())
  //   })
  //   .on('end', _ => {
  //     // console.log('name')
  //     console.log(z.resolve(name, wire.types.TXT))
  //   })
  // console.log(await zone.resolve(name, wire.types.TXT))
}
