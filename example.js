const ram = require('random-access-memory')
const Hyperzone = require('./index')

main()
async function main() {
  const zone = new Hyperzone('example.', ram)
  await zone.ready()

  const rskey = await zone.put(`
    @ 3600 IN TXT "hello world 0"
    @ 3600 IN TXT "hello world 1"
  `)

  console.log((await zone.resolve('example.', 'TXT')).answer)
  await zone.del(rskey)
  console.log((await zone.resolve('example.', 'TXT')).answer)
}