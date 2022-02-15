const { Zone } = require('bns')
const DNSServer = require('bns/lib/server/dns')
const Hyperzone = require('./index')

const empty = new Zone()

class AuthServer extends DNSServer {
  constructor (options) {
    super(options)
    this.ra = false
    this.zone = empty
    this.zones = new Map()
    this.initOptions(options)
  }

  add (storage, key, opts) {
    const zone = new Hyperzone(storage, key, opts)
    zone.ready().then(async () => {
      const origin = await zone.origin()
      this.zones.set(origin, zone)
    })
    return zone
  }

  setOrigin (origin) {
    this.zone = this.zones.get(origin) || empty
    return this
  }

  async resolve (req, rinfo) {
    const [qs] = req.question
    const {name, type} = qs
    for (const key of this.zones.keys()) {
      const s = name.split(key)
      if (!s[s.length - 1]) {
        this.setOrigin(key)
      }
    }
    return this.zone.resolve(name, type)
  }
}

module.exports = AuthServer
