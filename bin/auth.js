const HOME = require('os').homedir()

const Hyperzone = require('../hyperzone')
const AuthServer = require('../auth')
const Replicator = require('@hyperswarm/replicator')
const ram = require('random-access-memory')

const key = process.argv[2]
if (!key) throw new Error('Missing key')

const storage = process.argv[3] === '-ram' ? ram : `${HOME}/.hyperzones/r/${key}`

main()

async function main () {
  const auth = new AuthServer()
  auth.setOrigin(storage, key, { sparse: true, alwaysUpdate: true })

  const local = auth.zone
  auth.replicator = new Replicator()
  auth.replicator.add(local.db, { client: true, server: true })
  auth.replicator.on('connection', () => console.log('> connection'))

  let origin = await local.origin()
  origin || console.log('searching for origin...')
  await local.ready()
  origin || console.log('found origin!')
  console.log('---')
  console.log('origin:', await local.origin())
  console.log('public key:', local.pub)
  console.log('storage:', storage === ram ? 'in-memory' : storage)

  let port = 53
  try {
    auth.bind(port, '0.0.0.0')
  } catch (e) {
    port = 5300
    auth.bind(port, '127.0.0.1')
  }
  console.log('authoritative server listening on port', port)
}