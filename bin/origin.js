const HOME = require('os').homedir()

const Hyperzone = require('../hyperzone')
const Replicator = require('@hyperswarm/replicator')
const ram = require('random-access-memory')
const { util } = require('bns')

const origin = util.fqdn(((process.argv[2] !== '-ram' && process.argv[2]) ? process.argv[2] : null) || 'example')
const storage = (process.argv[2] === '-ram' || process.argv[3] === '-ram') ? ram : `${HOME}/.hyperzones/w/${origin}`

main()

async function main() {
  const replicator = new Replicator()
  const zone = new Hyperzone(storage, { origin })
  await zone.ready()
  console.log('origin:', await zone.origin())
  console.log('public key:', zone.pub)
  console.log('DS record:', await zone.DS())
  console.log('storage:', storage === ram ? 'in-memory' : storage)
  replicator.add(zone.db.feed, { server: true, client: true })
  replicator.on('> connection', () => console.log('%'))

  console.log('---\n')
  zone.db.createReadStream()
    .on('data', ({ key, value: record }) => {
      key === 'ORIGIN' || console.log(record.toString())
    })
    .on('end', () => {
      console.log('---')
      console.log('> put/del:\n')
      process.stdin.on('data', async data => {
        data = data.toString()
        if (data.slice(0,3) === 'del') {
          try {
            const recordSetKey = data.slice(3).trim().toUpperCase()
            const batchDel = await zone.del(recordSetKey)
            const delRecords = batchDel.map(({ key }) => key)
            console.log('> del', recordSetKey, JSON.stringify(delRecords, undefined, 2))
          } catch (error) {
            console.error('> del ERROR:', error.type)
          }
          console.log()
        } else if (data.slice(0,3) === 'get') {
          try {
            const key = data.slice(3).trim().toUpperCase()
            const batchGet = await zone.get(key)
            const getRecords = batchGet.map(({ key, value }) => ({ key, record: value.toString() }))
            console.log('> get', key, JSON.stringify(getRecords, undefined, 2))
          } catch (error) {
            console.error('> get ERROR:', error.type)
          }
          console.log()
        } else {
          const record = data.slice(0,3) === 'put' ? data.slice(3).trim() : data
          try {
            const recordSetKey = await zone.put(record.trim())
            const batchPut = await zone.get(recordSetKey)
            const putRecords = batchPut.map(({ key, value }) => ({ key, record: value.toString() }))
            console.log('> put', recordSetKey, JSON.stringify(putRecords, undefined, 2))
          } catch (error) {
            console.error('> put ERROR:', error.type)
          }
          console.log()
        }
      })
    })
}
