const EventEmitter = require('events')
const hypertrie = require('hypertrie')
const dedent = require('dedent')
const isOptions = require('is-options')
const base32 = require('bs32')
const { algs } = require('bns/lib/constants')
const dnssec = require('bns/lib/dnssec')
const { Zone, wire } = require('bns')
const { types, typesByVal } = wire

class Hyperzone extends EventEmitter {
  constructor (origin, storage, key, opts = {}) {
    super()
    if (isOptions(key)) {
      opts = key
      key = null
    }
    if (key && key.length === 52) {
      key = base32.decode(key)
    }
    this.origin = origin
    this.db = hypertrie(storage || origin, key, { ...opts })
    this.isReady = false
    this.db.ready(() => {
      this.db.get('DNSKEY/0', this.initialize.bind(this))
    })
  }

  ready () {
    return new Promise((resolve, reject) => {
      if (this.isReady) {
        resolve()
      } else {
        this.on('ready', resolve)
      }
    })
  }

  initialize (error, record) {
    if (error) {
      throw error
    }

    record = record ? record.value.toString() : null
    if (this.db.feed.writable && record === null) {
      const flags = 256 // todo: make KSK an option
      const priv = this.db.secretKey.slice(0, 32)
      const pub = this.db.key
      const alg = algs.ED25519

      const keyRecord = dnssec.createKey(this.origin, alg, pub, flags)
      const text = this.toText(keyRecord)
      this.db.put('DNSKEY/0', text, (error) => {
        if (!error) {
          this.isReady = true
          this.emit('ready')
        } else {
          throw error
        }
      })
    } else {
      this.isReady = true
      this.emit('ready')
    }
  }

  get pub () {
    return base32.encode(this.db.key)
  }

  get priv () {
    return this.db.secretKey.slice(0, 32)
  }

  key () {
     return new Promise(async (resolve, reject) => {
      this.db.get('DNSKEY/0', (error, record) => {
        record = record ? record.value.toString() : null
        if (record) {
          resolve(this.fromText(record)[0])
        } else {
          resolve(null)
        }
      })
    })
  }

  DS () {
    return new Promise(async (resolve, reject) => {
      const keyRecord = await this.key()
      if (keyRecord) {
        resolve(dnssec.createDS(keyRecord, null))
      } else {
        resolve(null)
      }
    })
  }

  // todo: index by unique id for the record set
  // is a signature invalidated if i remove only one covered record?
  put (text, lifespan=null) {
    if (this.db.feed.writable) {
      let rrs = this.fromText(dedent(text.trim()))
      if (rrs.length) {
        return new Promise(async (resolve, reject) => {
          const key = await this.key()
          const srrs = dnssec.sign(key, this.priv, rrs, lifespan)
          rrs = [srrs, ...rrs]
          
          let batchKey
          const index = this.db.feed.length-1
          const batch = rrs.map((rr, i) => {
            const value = this.toText(rr)
            const rrsigType = rr.type === types.RRSIG ? typesByVal[rr.data.typeCovered] : ''
            const type = rrsigType ? rrsigType : typesByVal[rr.type]

            batchKey = `${type}/${index}`
            const key = `${batchKey}/${i}`
            return {
              type: 'put',
              key,
              value
            }
          })

          // resolve(await Promise.all(batch.map(({ key, value }) => {
          //   return new Promise((resolve, reject) => {
          //     // console.log(key, value)
          //     this.db.put(key, value, resolve)
          //   })
          // })))

          this.db.batch(batch, error => {
            if (!error) {
              resolve(batchKey)
            } else {
              reject(error)
            }
          })
        })
      } else {
        throw new Error('Parsed no records')
      }
    } else {
      throw new Error('Hyperzone not writable')
    }
  }

  del (key) {
    if (this.db.feed.writable) {
      const batch = []
      return new Promise((resolve, reject) => {
        this.db.createReadStream(key)
          .on('error', reject)
          .on('data', ({ key }) => {
            batch.push({
              type: 'del',
              key
            })
          })
          .on('end', async () => {
            this.db.batch(batch, (error, results) => {
              if (!error) {
                resolve(batch)
              } else {
                reject(error)
              }
            })
          })
      })
    } else {
      throw new Error('Hyperzone not writable')
    }
  }

  get (key) {
    const results = []
    return new Promise((resolve, reject) => {
      this.db.createReadStream(key)
        .on('error', reject)
        .on('data', data => {
          results.push(data)
        })
        .on('end', _ => {
          resolve(results)
        })
    })
  }

  resolve (name, type, origin) {
    if (typeof type === 'number') {
      type = typesByVal[type]
    }
    const zone = new Zone()
    zone.setOrigin(origin || this.origin)
    return new Promise((resolve, reject) => {
      this.db.createReadStream(type)
        .on('error', reject)
        .on('data', data => {
          data.value && zone.fromString(data.value.toString())
        })
        .on('end', _ => {
          resolve(zone.resolve(name, types[type]))
        })
    })
  }

  fromText (text, origin) {
    return Hyperzone.fromText(text, origin || this.origin)
  }

  toText (rrs) {
    return Hyperzone.toText(rrs)
  }

  static fromText (text, origin) {
    return wire.fromZone(text, origin)
  }

  static toText (rrs) {
    if (!Array.isArray(rrs)) {
      rrs = [rrs]
    }
    return wire.toZone(rrs)
  }
}

module.exports = Hyperzone
