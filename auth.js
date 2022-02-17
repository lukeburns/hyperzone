const HOME = require('os').homedir()

const base32 = require('bs32')
const { wire: { codes, types }, Zone } = require('bns')
const DNSServer = require('bns/lib/server/dns')
const Replicator = require('@hyperswarm/replicator')
const Hyperzone = require('./hyperzone')
const { merge, root, recursive } = require('./lookup')

const empty = new Zone()

class AuthServer extends DNSServer {
  constructor (options = {}) {
    super(options)
    this.ra = false
    this.zone = { resolve: recursive }
    this.zones = new Map()
    this.storageDir = options.storageDir || `${HOME}/.hyperzones/auth`
    this.hyperzoneOpts = options.hyperzoneOpts || { sparse: true, alwaysUpdate: true }
    this.replicatorOpts = options.replicatorOpts || { client: true, server: true }
    this.replicator = new Replicator()
    this.initOptions(options)
  }

  add (key, opts) {
    const buf = base32.decode(key)
    key = key.toString('hex')
    let zone = this.zones.get(key)
    if (zone) {
      return zone
    }

    const storage = `${this.storageDir}/${key}`
    zone = new Hyperzone(storage, key, opts)
    this.zones.set(key, zone)
    this.replicator.add(zone.db, this.replicatorOpts) 
    zone.ready().then(async () => {
      const origin = await zone.origin()
      this.zones.delete(key)
      this.zones.set(origin, zone)
      this.emit('origin', zone)
    })
    return zone
  }

  setOrigin (origin) {
    this.zone = this.zones.get(origin) || { resolve: recursive }
    return this
  }

  async resolve (req, rinfo) {
    this.zone =  { resolve: recursive }

    const [qs] = req.question
    const {name, type} = qs
    let haveZone = false
    for (const origin of this.zones.keys()) {
      const s = name.split(origin)
      if (!s[s.length - 1]) {
        haveZone = true
        this.setOrigin(origin)
      }
    }

    if (!haveZone) {
      const res = await root(name, types.NS)
      const records = merge(res, types.NS)
      for (const record of records) {
        const data = record.data.ns
        const s = data.split('._hyper.')
        console.log(s)
        let key = ''
        if (!s[s.length - 1]) {
          key = s[s.length - 2]
        } else {
          const r = data.split('.ns.direct.')
          console.log(r)
          if (!r[r.length - 1]) {
            key = r[r.length - 2]
          }
        }
        if (key.length === 52) {
          const zone = this.add(key)
          const origin = await zone.origin()
          if (origin) {
            this.setOrigin(origin)
          } else {
            const res = empty.resolve(name, type)
            res.code = codes.SERVFAIL
            return res
          }
        }
      }
    }

    return this.zone.resolve(name, type)
  }
}

module.exports = AuthServer
