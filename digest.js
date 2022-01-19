const { sha256 } = require('bns/lib/internal/crypto')
const { pack } = require('./struct')
const b4a = require('b4a')

module.exports = digest

function digest (name, key, flags = 257, protocol = 3, algorithm = 15) {
  const dnskey = b4a.concat([
    b4a.from(pack('>HBB', flags, protocol, algorithm)),
    key
  ])

  const owner = b4a.concat(name.split('.').map(k => b4a.concat([
    b4a.from(pack('B', k.length)),
    b4a.from(k)
  ])))

  const msg = b4a.concat([owner, dnskey])
  return sha256.digest(msg)
}

// compute digest from ed25519 example in rfc8080
// https://datatracker.ietf.org/doc/html/rfc8080#section-6.1
// test_example_digest()
function test_example_digest () {
  const expected_digest = '3aa5ab37efce57f737fc1627013fee07bdf241bd10f3b1964ab55c78e79a304b'
  const name = 'example.com.'
  const key = Buffer.from(`l02Woi0iS8Aa25FQkUd9RMzZHJpBoRQwAQEX1SxZJA4=`, 'base64')
  const computed_digest = digest(name, key).toString('hex')
  if (expected_digest != computed_digest) {
    throw new Error('Digest failed')
  } else {
    console.log(computed_digest)
    console.log(expected_digest)
  }
}

