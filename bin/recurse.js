const HOME = require('os').homedir()

const base32 = require('bs32')
const { Zone, wire, dnssec } = require('bns')
const { SOARecord, Record, codes, types, typesByVal } = wire
const { RecursiveServer } = require('hipr');
const Replicator = require('@hyperswarm/replicator')
const Hyperzone = require('../')

const empty = new Zone()

const zones = new Map()
const storageDir = `${HOME}/.hyperzones/auth`
const hyperzoneOpts = { sparse: true, alwaysUpdate: true }
const replicatorOpts = { client: true, server: true }
const replicator = new Replicator()
replicator.on('connection', () => console.log('> connection'))

const add = (key, opts) => {
  const buf = base32.decode(key)
  key = key.toString('hex')
  let zone = zones.get(key)
  if (zone) {
    return zone
  }

  const promise = new Promise(async (resolve) => {
    const storage = `${storageDir}/${key}`
    zone = new Hyperzone(storage, key, opts)
    zones.set(key, zone)
    resolve(zone)
    replicator.add(zone.db, replicatorOpts)
    await zone.ready()
    const origin = await zone.origin()
    zones.set(origin, zone)
  })

  zones.set(key, promise)

  return promise
}

const server = new RecursiveServer({
  tcp: true,
  inet6: true,
  edns: true,
  dnssec: true
})

server.parseOptions({ dnssec: true })

server.resolver.setStub('149.248.21.56', 53, createDS())

server.use(':data.:protocol(_hyper|ns.direct).', async ({ protocol, data }, name, type) => {
  console.log(`${name} ${type}`)
  console.log(`  ${protocol} ${data}`)

  for (const [origin, zone] of zones.entries()) {
    const s = name.split(origin)
    if (!s[s.length - 1]) {
      return zone.resolve(name, type)
    }
  }

  data = data.split('.')
  const key = data[data.length - 1]
  if (key.length === 52) {
    const zone = await add(key)
    if (zone.origin) {
      const origin = await zone.origin()
      if (origin) {
        const res = zone.resolve(name, type)
        return res
      } else {
        const res = empty.resolve(name, type)
        res.code = codes.SERVFAIL // servfail if we don't have the data yet
        return res
      }
    } else {
      // just a promise
    }
  } else {
    return rc.res
  }
})

server.parseOptions({ dnssec: true })
server.bind(53, '66.42.108.201')

// ---


function createDS () {
  const ksk = Record.fromJSON({
    name: '.',
    ttl: 10800,
    class: 'IN',
    type: 'DNSKEY',
    data: {
      flags: 257,
      protocol: 3,
      algorithm: 13,
      publicKey: ''
        + 'T9cURJ2M/Mz9q6UsZNY+Ospyvj+Uv+tgrrWkLtPQwgU/Xu5Yk0l02Sn5ua2x'
        + 'AQfEYIzRO6v5iA+BejMeEwNP4Q=='
    }
  })
  return dnssec.createDS(ksk, dnssec.hashes.SHA256)
}

// ---

const DEFAULT_TTL = 21600;

const serial = () => {
  const date = new Date();
  const y = date.getUTCFullYear() * 1e6;
  const m = (date.getUTCMonth() + 1) * 1e4;
  const d = date.getUTCDate() * 1e2;
  const h = date.getUTCHours();
  return y + m + d + h;
}


function toSOA () {
    const rr = new Record();
    const rd = new SOARecord();

    rr.name = '.';
    rr.type = types.SOA;
    rr.ttl = 86400;
    rr.data = rd;
    rd.ns = '.';
    rd.mbox = '.';
    rd.serial = serial();
    rd.refresh = 1800;
    rd.retry = 900;
    rd.expire = 604800;
    rd.minttl = DEFAULT_TTL;

    return rr;
}

function sendSoa () {
  const res = new wire.Message()
  res.aa = true
  res.authority.push(toSOA())

  // this.ns.signRRSet(res.authority, wire.types.SOA) // get signing right

  return res
}

