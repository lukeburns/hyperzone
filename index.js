const EventEmitter = require('events');
const hypertrie = require('hypertrie');
const dedent = require('dedent');
const isOptions = require('is-options');
const base32 = require('bs32');
const { algs } = require('bns/lib/constants');
const dnssec = require('bns/lib/dnssec');
const { Zone, wire, util } = require('bns');
const { types, typesByVal } = wire;

class Hyperzone extends EventEmitter {
  constructor (storage, key, opts = {}) {
    super();
    if (isOptions(storage) && (storage.storage || storage.origin)) {
      opts = storage;
      storage = opts.storage || (opts.origin ? util.fqdn(opts.origin) : null);
    } else if (isOptions(key)) {
      opts = key;
      key = null;
    }

    if (key && typeof key === 'string') {
      if (key.length === 52) {
        key = base32.decode(key);
      } else if (key.length < 52) {
        key = Buffer.from(key, 'base64');
      } else if (key.length === 64) {
        key = Buffer.from(key, 'hex');
      }
    }

    if (opts.origin) {
      this._origin = util.fqdn(opts.origin);
    } else if (typeof storage === 'string' && util.isFQDN(storage)) {
      this._origin = storage;
    }

    this.db = hypertrie(storage, key, opts);
    this.isReady = false;
    this.db.on('error', console.error);
    this.db.ready(this.initialize.bind(this));
  }

  ready () {
    return new Promise((resolve, reject) => {
      if (this.isReady) {
        resolve();
      } else {
        this.on('ready', resolve);
      }
    });
  }

  async initialize () {
    const origin = await this.origin();

    if (origin) {
      if (!this._origin) {
        this._origin = origin;
      } else {
        if (origin !== this._origin) {
          throw new Error('Origin mismatch');
        }
      }
    } else {
      if (this._origin && this.db.feed.writable) {
        await new Promise((resolve, reject) => {
          this.db.put('ORIGIN', this._origin, (error, entry) => {
            if (!error) {
              resolve(entry);
            } else {
              console.error(error);
            }
          });
        });
      } else {
        if (this.db.feed.writable) {
          throw new Error('Origin required');
        } else {
          await this.origin();
        }
      }
    }

    if (this._origin) {
      this.db.get('DNSKEY/0', this.handlednskey.bind(this));
    } else {
      const watcher = this.db.watch('ORIGIN', async () => {
        this._origin = await this.origin();
        this.db.get('DNSKEY/0', this.handlednskey.bind(this));
        watcher.destroy();
      });
    }
  }

  handlednskey (error, record) {
    if (error) {
      throw error;
    }

    record = record ? record.value.toString() : null;
    if (this.db.feed.writable && record === null) {
      const flags = 256; // todo: make KSK an option
      const priv = this.db.secretKey.slice(0, 32);
      const pub = this.db.key;
      const alg = algs.ED25519;

      const keyRecord = dnssec.createKey(this._origin, alg, pub, flags);
      const sig = dnssec.sign(keyRecord, this.priv, [keyRecord], null);
      const rrs = [keyRecord, sig];
      const text = this.toText(rrs);
      this.db.put('DNSKEY/0', text, (error) => {
        if (!error) {
          this.isReady = true;
          this.emit('ready');
        } else {
          throw error;
        }
      });
    } else {
      this.isReady = true;
      this.emit('ready');
    }
  }

  get pub () {
    return base32.encode(this.db.key);
  }

  get priv () {
    return this.db.secretKey.slice(0, 32);
  }

  origin () {
    return new Promise((resolve, reject) => {
      this.db.get('ORIGIN', (error, entry) => {
        if (!error && entry) {
          resolve(entry.value.toString());
        } else {
          resolve(null);
        }
      });
    });
  }

  key () {
    return new Promise(async (resolve, reject) => {
      this.db.get('DNSKEY/0', (error, record) => {
        record = record ? record.value.toString() : null;
        if (record) {
          resolve(this.fromText(record)[0]);
        } else {
          resolve(null);
        }
      });
    });
  }

  DS () {
    return new Promise(async (resolve, reject) => {
      const keyRecord = await this.key();
      if (keyRecord) {
        resolve(dnssec.createDS(keyRecord, null));
      } else {
        resolve(null);
      }
    });
  }

  put (text, lifespan = null) {
    if (this.db.feed.writable) {
      let rrs = this.fromText(dedent(text.trim()));
      if (rrs.length) {
        return new Promise(async (resolve, reject) => {
          const key = await this.key();
          const srrs = dnssec.sign(key, this.priv, rrs, lifespan);
          rrs = [srrs, ...rrs];

          let batchKey;
          const index = this.db.feed.length - 1;
          const batch = rrs.map((rr, i) => {
            const value = this.toText(rr).trim();
            const rrsigType = rr.type === types.RRSIG ? typesByVal[rr.data.typeCovered] : '';
            const type = rrsigType || typesByVal[rr.type];

            batchKey = `${type}/${index}`;
            const key = `${batchKey}/${i}`;
            return {
              type: 'put',
              key,
              value
            };
          });

          this.db.batch(batch, error => {
            if (!error) {
              resolve(batchKey);
            } else {
              reject(error);
            }
          });
        });
      } else {
        throw new Error('Parsed no records');
      }
    } else {
      throw new Error('Hyperzone not writable');
    }
  }

  del (key) {
    if (this.db.feed.writable) {
      const batch = [];
      return new Promise((resolve, reject) => {
        this.db.createReadStream(key)
          .on('error', reject)
          .on('data', ({ key }) => {
            key.indexOf('ORIGIN') < 0 && key.indexOf('DNSKEY') < 0 && batch.push({
              type: 'del',
              key
            });
          })
          .on('end', async () => {
            this.db.batch(batch, (error, results) => {
              if (!error) {
                resolve(batch);
              } else {
                reject(error);
              }
            });
          });
      });
    } else {
      throw new Error('Hyperzone not writable');
    }
  }

  get (key) {
    const results = [];
    return new Promise((resolve, reject) => {
      this.db.createReadStream(key)
        .on('error', reject)
        .on('data', data => {
          results.push(data);
        })
        .on('end', _ => {
          resolve(results);
        });
    });
  }

  resolve (name, type, origin) {
    if (typeof type === 'number') {
      type = typesByVal[type];
    }

    const zone = new Zone();
    zone.setOrigin(origin || this._origin);

    zone.fromString('localhost. A 127.0.0.1');
    zone.fromString('*.localhost. A 127.0.0.1');
    zone.fromString('*.*.localhost. A 127.0.0.1');

    const push = data => {
      try {
        if (data.value) {
          const value = data.value.toString();
          zone.fromString(value);
        }
      } catch (err) {}
    };

    return new Promise((resolve, reject) => {
      let n = 0;

      const handle = (err, rr) => {
        rr.map(push);
        if (!--n) {
          try {
            const res = zone.resolve(name, types[type]);

            // why isn't bns Zone resolving CNAMEs for A queries?
            if (types[type] === types.A && res && res.answer && res.answer.length === 0) {
              const r = zone.resolve(name, types.CNAME);
              res.answer.push(...r.answer);
              if (res.answer.length) {
                res.code = codes.NOERROR;
              }
            }
            resolve(res);
          } catch (error) {
            reject(error);
          }
        }
      };

      n = 3;
      this.db.list(type, handle);
      this.db.list('DS', handle);
      this.db.list('NS', handle);

      if (type === 'A') {
        n += 1;
        this.db.list('CNAME', handle);
      }
      if (type === 'CNAME') {
        n += 1;
        this.db.list('A', handle);
      }
    });
  }

  fromText (text, origin) {
    return Hyperzone.fromText(text, origin || this._origin);
  }

  toText (rrs) {
    return Hyperzone.toText(rrs);
  }

  static fromText (text, origin) {
    return wire.fromZone(text, origin);
  }

  static toText (rrs) {
    if (!Array.isArray(rrs)) {
      rrs = [rrs];
    }
    return wire.toZone(rrs);
  }
}

module.exports = Hyperzone;
