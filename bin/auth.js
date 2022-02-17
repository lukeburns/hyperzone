const HOME = require('os').homedir()

const prettyHash = require('pretty-hash')
const Hyperzone = require('../hyperzone')
const AuthServer = require('../auth')
const ram = require('random-access-memory')

const keys = process.argv.slice(2)

main()

async function main () {
  const auth = new AuthServer()

  const replicator = auth.replicator
  replicator.on('connection', () => console.log('> connection'))
  
  auth.on('origin', async (zone) => {
    const key = zone.db.key
    const pkey = prettyHash(key)

    let origin = await zone.origin()
    origin || console.log(`[${pkey}] searching for origin...`)
    await zone.ready()
    origin = await zone.origin()
    console.log(`[${pkey}] origin:`, origin)
  })

  let port = 53
  auth.bind(port, '66.42.108.201')
  console.log('authoritative server listening on port', port)
}
