const HOME = require('os').homedir()

const prettyHash = require('pretty-hash')
const Hyperzone = require('../index')
const AuthServer = require('../auth')
const Replicator = require('@hyperswarm/replicator')
const ram = require('random-access-memory')

const keys = process.argv.slice(2)
if (!keys.length) throw new Error('No keys specified')

main()

async function main () {
  const auth = new AuthServer()

  const replicator = new Replicator()
  replicator.on('connection', () => console.log('> connection'))

  keys.map(async (key, i) => {
    const storage = keys[i+1] === '-ram' ? ram : `${HOME}/.hyperzones/r/${key}`
    const zone = auth.add(storage, key, { sparse: true, alwaysUpdate: true })
    pkey = prettyHash(key)
    replicator.add(zone.db, { client: true, server: true })

    try {
      let origin = await zone.origin()
      origin || console.log(`[${pkey}] searching for origin...`)

      await zone.ready()
      origin = await zone.origin()

      console.log(`[${origin}] found origin!`)
      console.log('---')
      console.log(`[${origin}] public key:`, zone.pub)
      console.log(`[${origin}] storage:`, storage === ram ? 'in-memory' : storage)
      console.log('---')
      console.log('---')
    } catch (error) {
      console.error(error)
    }
  })
 
  let port = 53
  auth.bind(port, '66.42.108.201')
  console.log('authoritative server listening on port', port)
}
