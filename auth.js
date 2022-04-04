const Hyperzone = require('.');
const Replicator = require('@hyperswarm/replicator');
const DNSServer = require('bns/lib/server/dns');
const Zone = require('bns/lib/zone');
const base32 = require('bs32');

/**
 * AuthServer
 * @extends EventEmitter
 */

class AuthServer extends DNSServer {
  constructor (options) {
    super(options);
    this.zone = new Zone();
    this.ra = false;
    this.initOptions(options);

    this.replicator = new Replicator();
    this.replicator.on('connection', (socket, info) => {
      console.log('[hyperzone] connection @', base32.encode(info.publicKey));
    });
    this.replicator.on('error', err => console.error('[hyperzone] replication error :', err.message));
    this.replicator.on('delete', (info) => {
      console.log('[hyperzone] closed @', base32.encode(info.publicKey));
    });
    this.replicator.on('close', () => {
      console.log('[hyperzone] closed.');
    });
  }

  async setZone (storage, key, hyperzoneOpts, replicatorOpts) {
    hyperzoneOpts = hyperzoneOpts || { sparse: true, alwaysUpdate: true };
    replicatorOpts = replicatorOpts || { client: true, server: true, live: true };

    this.zone = new Hyperzone(storage, key, hyperzoneOpts);
    this.replicator.add(this.zone.db, replicatorOpts)
      .catch(err => {
        console.error('[hyperzone] replication error :', err);
      });
    await this.zone.ready();
    return this.zone;
  }

  async resolve (req, rinfo) {
    const [qs] = req.question;
    const { name, type } = qs;
    return await this.zone.resolve(name, type);
  }
}

module.exports = AuthServer;
