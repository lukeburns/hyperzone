const DNSServer = require('bns/lib/server/dns')
const Hyperzone = require('./hyperzone')

// todo: 
// - dynamically setOrigin
// - replicate over DHT

class AuthServer extends DNSServer {
  constructor (options) {
    super(options)
    this.ra = false
    this.initOptions(options)
  }

  setOrigin (storage, key, opts) {
    this.zone = new Hyperzone(storage, key, opts)
    return this
  }

  async resolve (req, rinfo) {
    const [qs] = req.question
    const {name, type} = qs
    return this.zone.resolve(name, type)
  }
}

module.exports = AuthServer