const hypertrie = require('hypertrie')
const isOptions = require('is-options')
const base32 = require('bs32')
const { Zone, wire: { types } } = require('bns')
const digest = require('./digest')

// TODO:
// - add record operations that take care of signing records
// - is a trie really better than a B-tree? hyperbee is more developed.
// - make Replicable: Replicator.add(zone) rather than Replicator.add(zone.db)

class Hyperzone {
  constructor (name, storage, key, opts) {
    // super(...args)
    if (isOptions(key)) {
      opts = key
      key = null
    }
    if (key.length === 52) {
      key = base32.decode(key)
    }
    this.name = name
    this.db = hypertrie(storage, key, { ...opts, alwaysUpdate: true })
    this.isReady = false
    this.db.on('ready', () => {
      this.isReady = true
    })
  }
  ready () {
    return new Promise((resolve, reject) => {
      if (this.isReady) {
        resolve(true)
      } else {
        this.db.ready(resolve)
      }
    })
  }

  get key () {
    return base32.encode(this.db.key)
  }

  get digest () {
    if (!this.isReady) return null
    return digest(this.name, this.db.key)
  }

  resolve (name, type) {
    const zone = new Zone()
    zone.setOrigin(this.name)
    return new Promise((resolve, reject) => {
      this.db.createReadStream(type, { recursive: false })
        .on('error', reject)
        .on('data', data => {
          zone.fromString(data.value.toString())
        })
        .on('end', _ => {
          resolve(zone.resolve(name, typeof type === 'number' ? type : types[type]))
        })
    })
  }
}

module.exports = Hyperzone
