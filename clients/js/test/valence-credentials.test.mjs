/**
 * valence-credentials.test.mjs -- where the /uitoken mint goes and which key a
 * pairing token is stored under, for a session origin {host, port, http}.
 *
 * Asserts: the origin's http port reaches the mint URL, port 80 when unknown,
 * a "host:port" string used as is; two hubs on one host with different WS
 * ports keep separate tokens; the default WS port keys by bare host; a real
 * session hands its origin to the token provider.
 *
 * Run:  node clients/js/test/valence-credentials.test.mjs   (exits 1 on any failure)
 */

import { mintUiToken, setHttpGet } from '../credentials.js';
import { getPairedToken, setPairedToken } from '../identity.js';
import { createSession } from '../session.js';

let failures = 0;
function assert(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}

const urls = [];
setHttpGet(async (u) => { urls.push(u); return null; });
await mintUiToken({ host: '127.0.0.1', port: 8701, http: 8702 }, 1);
await mintUiToken({ host: '10.0.0.5', port: 82 }, 1);
await mintUiToken('127.0.0.1:8590', 1);
assert('mint uses the origin http port', urls[0] === 'http://127.0.0.1:8702/uitoken', urls[0]);
assert('mint falls back to port 80', urls[1] === 'http://10.0.0.5/uitoken', urls[1]);
assert('host string used as is', urls[2] === 'http://127.0.0.1:8590/uitoken', urls[2]);

const a = new Uint8Array(16).fill(1), b = new Uint8Array(16).fill(2);
setPairedToken({ host: '127.0.0.1', port: 8701 }, a);
setPairedToken({ host: '127.0.0.1', port: 82 }, b);
const ga = getPairedToken({ host: '127.0.0.1', port: 8701, http: 8702 });
assert('token keyed by host:port', ga && ga[0] === 1);
assert('other WS port on the same host does not see it', getPairedToken({ host: '127.0.0.1', port: 8703 }) === null);
const gb = getPairedToken('127.0.0.1');
assert('default WS port keys by bare host', gb && gb[0] === 2);

let seen = null;
class DeadSocket { constructor() { setTimeout(() => this.onclose && this.onclose({ code: 1006 }), 0); } close() {} send() {} }
const s = createSession({
  host: '127.0.0.1', port: 8701, http: 8702, autoReconnect: false, WebSocketImpl: DeadSocket,
  token: (h, o) => { seen = o; return null; },
});
s.connect();
await new Promise((r) => setTimeout(r, 20));
s.close();
assert('provider receives the origin', seen && seen.host === '127.0.0.1' && seen.port === 8701 && seen.http === 8702, JSON.stringify(seen));
assert('session.origin matches', s.origin === seen);

console.log(failures ? failures + ' FAILED' : 'all passed');
process.exit(failures ? 1 : 0);
