const Hyperzone = require('./hyperzone')
const AuthServer = require('./auth')
const Replicator = require('@hyperswarm/replicator')
const ram = require('random-access-memory')

// todo:
// - replicate over DHT: local changes will propagate to remote nameserver

main()
async function main () {
  // create remote hyperzone
  const remote = new Hyperzone(ram, { origin: 'example.', sparse: true, alwaysUpdate: true }) // note: need sparse to get records to replicate properly, why?
  await remote.ready()

  // create replica
  const auth = new AuthServer()
  auth.setOrigin(ram, remote.db.key, { sparse: true, alwaysUpdate: true })
  const local = auth.zone

  // replicate
  const s = local.db.replicate(true)
  s.pipe(remote.db.replicate(false)).pipe(s)

  // add TXT record to remote hyperzone
  await remote.put('example. 0 IN TXT "hello world"')

  auth.bind(5300, '127.0.0.1') // dig 127.0.0.1 -p 5300 example TXT
}