// ---------- GRAVITY FRONT — backend-free WebRTC room transport ----------
// Manual offer/answer signaling keeps this module usable from a static host such
// as GitHub Pages. Once the two codes have been exchanged, game messages travel
// directly over a reliable, ordered WebRTC data channel.

const SIGNAL_PREFIX = 'GFPVP1.';
const SIGNAL_KIND = 'gravity-front-pvp';
const SIGNAL_VERSION = 1;
const MAX_SIGNAL_CHARS = 100000;
const MAX_MESSAGE_CHARS = 65536;

// A browser host relays one ordered data channel per guest. Sixteen pilots is a
// deliberate ceiling: it is far beyond the former duel while keeping upstream
// bandwidth and decode work within a realistic desktop-browser budget.
export const MAX_PVP_PLAYERS = 16;

export function pvpSeatId(index){
  const seat = Math.trunc(Number(index));
  if (!Number.isFinite(seat) || seat < 0 || seat >= MAX_PVP_PLAYERS)
    throw new RangeError('PvP seat index is outside the room capacity.');
  return seat === 0 ? 'host' : `pilot-${seat + 1}`;
}

export function pvpSpawnPoint(index, total, mapId = 'clearcity'){
  const count = Math.max(2, Math.min(MAX_PVP_PLAYERS, Math.trunc(Number(total)) || 2));
  const seat = Math.max(0, Math.min(count - 1, Math.trunc(Number(index)) || 0));
  const centerZ = mapId === 'odessa' ? 350 : 450;
  const radius = mapId === 'odessa' ? 980 : 900;
  const angle = Math.PI + seat / count * Math.PI * 2;
  return {
    x: Math.sin(angle) * radius,
    z: centerZ + Math.cos(angle) * radius,
    yaw: angle + Math.PI,
  };
}

export const DEFAULT_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: 'stun:stun.l.google.com:19302' }),
  Object.freeze({ urls: 'stun:stun1.l.google.com:19302' }),
]);

function bytesToBase64Url(bytes){
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize){
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(encoded){
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw new Error('This PvP code is not valid base64url data.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeSignal(description){
  if (!description || !['offer', 'answer'].includes(description.type) || typeof description.sdp !== 'string'){
    throw new TypeError('A valid WebRTC offer or answer is required.');
  }
  const payload = {
    kind: SIGNAL_KIND,
    version: SIGNAL_VERSION,
    description: { type: description.type, sdp: description.sdp },
  };
  return SIGNAL_PREFIX + bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeSignal(code, expectedType = null){
  if (typeof code !== 'string' || !code.trim()) throw new Error('Paste a PvP connection code first.');
  const compact = code.trim().replace(/\s+/g, '');
  if (compact.length > MAX_SIGNAL_CHARS) throw new Error('This PvP code is too large to be valid.');
  const encoded = compact.startsWith(SIGNAL_PREFIX) ? compact.slice(SIGNAL_PREFIX.length) : compact;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));
  } catch (error){
    if (error instanceof SyntaxError) throw new Error('This PvP code is damaged or incomplete.');
    throw error;
  }
  if (
    payload?.kind !== SIGNAL_KIND ||
    payload?.version !== SIGNAL_VERSION ||
    !['offer', 'answer'].includes(payload?.description?.type) ||
    typeof payload?.description?.sdp !== 'string' ||
    !payload.description.sdp
  ){
    throw new Error('This is not a compatible Gravity Front PvP code.');
  }
  if (expectedType && payload.description.type !== expectedType){
    throw new Error(`Expected a ${expectedType} code, but received an ${payload.description.type} code.`);
  }
  return { type: payload.description.type, sdp: payload.description.sdp };
}

export class PvpLink extends EventTarget {
  constructor({
    iceServers = DEFAULT_ICE_SERVERS,
    iceGatheringTimeoutMs = 15000,
    channelLabel = 'gravity-front-pvp',
  } = {}){
    super();
    this.iceServers = iceServers;
    this.iceGatheringTimeoutMs = Math.max(1000, Number(iceGatheringTimeoutMs) || 15000);
    this.channelLabel = channelLabel;
    this.role = null;
    this.peer = null;
    this.channel = null;
    this.state = 'idle';
    this._closed = false;
  }

  get readyState(){
    return this.channel?.readyState || 'closed';
  }

  get connected(){
    return this.channel?.readyState === 'open';
  }

  get connectionState(){
    return this.peer?.connectionState || 'closed';
  }

  async createHostOffer(){
    try {
      const peer = this._createPeer('host');
      this._attachChannel(peer.createDataChannel(this.channelLabel, { ordered: true }));
      this._setStatus('creating-offer', 'Creating the host invite…');
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!await this._waitForIceGathering(peer)){
        throw new Error('Network route discovery timed out. Reset the link and create a fresh invite.');
      }
      this._assertCurrentPeer(peer, 'The host invite was cancelled before it finished.');
      const code = encodeSignal(peer.localDescription);
      this._setStatus('offer-ready', 'Invite ready. Send it to the other player.');
      return code;
    } catch (error){
      this._emitError(error);
      throw error;
    }
  }

  async acceptHostOffer(offerCode){
    try {
      const offer = decodeSignal(offerCode, 'offer');
      const peer = this._createPeer('guest');
      this._setStatus('accepting-offer', 'Reading the host invite…');
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      if (!await this._waitForIceGathering(peer)){
        throw new Error('Network route discovery timed out. Reset the link and join the invite again.');
      }
      this._assertCurrentPeer(peer, 'Joining the invite was cancelled before it finished.');
      const code = encodeSignal(peer.localDescription);
      this._setStatus('answer-ready', 'Answer ready. Send it back to the host.');
      return code;
    } catch (error){
      this._emitError(error);
      throw error;
    }
  }

  async acceptGuestAnswer(answerCode){
    try {
      if (this.role !== 'host' || !this.peer){
        throw new Error('Create a host invite before applying the guest answer.');
      }
      if (this.peer.signalingState === 'closed'){
        throw new Error('This host invite has expired. Reset the link and create a fresh invite.');
      }
      if (this.peer.signalingState !== 'have-local-offer'){
        throw new Error('This answer does not match an active host invite. Reset the link and try again.');
      }
      const answer = decodeSignal(answerCode, 'answer');
      this._setStatus('accepting-answer', 'Applying the guest answer…');
      await this.peer.setRemoteDescription(answer);
      this._setStatus('connecting', 'Answer accepted. Establishing the direct link…');
    } catch (error){
      this._emitError(error);
      throw error;
    }
  }

  // JSON is the protocol boundary. Callers should send small serializable
  // messages and perform their own simulation/state rate limiting.
  send(message){
    if (!this.connected) throw new Error('The PvP data channel is not connected.');
    const json = JSON.stringify(message);
    if (json === undefined) throw new TypeError('PvP messages must be JSON-serializable.');
    if (json.length > MAX_MESSAGE_CHARS) throw new Error('The PvP message is too large.');
    this.channel.send(json);
  }

  close(){
    if (this._closed && !this.peer && !this.channel) return;
    this._closed = true;
    const channel = this.channel;
    const peer = this.peer;
    this.channel = null;
    this.peer = null;
    if (channel){
      channel.onopen = null;
      channel.onmessage = null;
      channel.onerror = null;
      channel.onclose = null;
      try { channel.close(); } catch {}
    }
    if (peer){
      peer.ondatachannel = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      peer.onicecandidateerror = null;
      try { peer.close(); } catch {}
    }
    this.role = null;
    this._setStatus('closed', 'PvP link closed.');
    this.dispatchEvent(new CustomEvent('close'));
  }

  _createPeer(role){
    this._resetPeer();
    this.role = role;
    this._closed = false;
    this.peer = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer = this.peer;

    peer.ondatachannel = event => {
      if (this.role !== 'guest') return;
      if (this.channel && this.channel !== event.channel) this.channel.close();
      this._attachChannel(event.channel);
    };
    peer.onconnectionstatechange = () => {
      if (this.peer !== peer) return;
      const state = peer.connectionState;
      if (state === 'connected'){
        this._setStatus('connected', 'Direct peer connection established.');
      } else if (state === 'connecting'){
        this._setStatus('connecting', 'Establishing the direct link…');
      } else if (state === 'disconnected'){
        this._setStatus('disconnected', 'Peer connection interrupted. Waiting to recover…');
      } else if (state === 'failed'){
        const error = new Error('Direct connection failed. This network may require a TURN relay.');
        this._setStatus('failed', error.message);
        this._emitError(error);
      } else if (state === 'closed' && !this._closed){
        this._setStatus('closed', 'Peer connection closed.');
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (this.peer !== peer || peer.connectionState !== 'new') return;
      const state = peer.iceConnectionState;
      if (state === 'checking') this._setStatus('connecting', 'Checking a route to the other player…');
    };
    peer.onicecandidateerror = event => {
      if (this.peer !== peer) return;
      this.dispatchEvent(new CustomEvent('warning', {
        detail: {
          message: event.errorText || 'An ICE server could not provide a connection candidate.',
          errorCode: event.errorCode,
          url: event.url,
        },
      }));
    };
    this._setStatus('peer-ready', role === 'host' ? 'Host peer ready.' : 'Guest peer ready.');
    return peer;
  }

  _attachChannel(channel){
    this.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      if (this.channel !== channel) return;
      this._setStatus('connected', 'PvP data channel open.');
      this.dispatchEvent(new CustomEvent('open', { detail: { role: this.role } }));
    };
    channel.onmessage = event => {
      if (this.channel !== channel) return;
      if (typeof event.data !== 'string'){
        this._emitError(new Error('Received an unsupported binary PvP message.'));
        return;
      }
      if (event.data.length > MAX_MESSAGE_CHARS){
        this._emitError(new Error('Received an oversized PvP message.'));
        return;
      }
      try {
        this.dispatchEvent(new CustomEvent('message', { detail: JSON.parse(event.data) }));
      } catch {
        this._emitError(new Error('Received a malformed PvP message.'));
      }
    };
    channel.onerror = event => {
      if (this.channel !== channel) return;
      this._emitError(event.error || new Error('PvP data channel error.'));
    };
    channel.onclose = () => {
      if (this.channel !== channel) return;
      this._setStatus('disconnected', 'The other player left the duel.');
      this.dispatchEvent(new CustomEvent('close'));
    };
  }

  async _waitForIceGathering(peer = this.peer){
    if (!peer) throw new Error('PvP peer is not initialized.');
    if (peer.iceGatheringState === 'complete') return true;
    this._setStatus('gathering-ice', 'Finding a route through the internet…');

    return new Promise(resolve => {
      let settled = false;
      const finish = complete => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.removeEventListener('icegatheringstatechange', onState);
        peer.removeEventListener('icecandidate', onCandidate);
        if (!complete) this.dispatchEvent(new CustomEvent('warning', {
          detail: { message: 'Network route discovery timed out. No incomplete code was generated.' },
        }));
        resolve(complete);
      };
      const onState = () => {
        if (peer.signalingState === 'closed') return finish(false);
        if (peer.iceGatheringState === 'complete') finish(true);
      };
      const onCandidate = event => {
        if (!event.candidate) finish(true);
      };
      const timer = setTimeout(() => finish(false), this.iceGatheringTimeoutMs);
      peer.addEventListener('icegatheringstatechange', onState);
      peer.addEventListener('icecandidate', onCandidate);
      onState();
    });
  }

  _assertCurrentPeer(peer, message){
    if (this.peer !== peer || this._closed || peer.signalingState === 'closed'){
      throw new Error(message);
    }
  }

  _resetPeer(){
    const channel = this.channel;
    const peer = this.peer;
    this.channel = null;
    this.peer = null;
    if (channel){
      channel.onopen = null;
      channel.onmessage = null;
      channel.onerror = null;
      channel.onclose = null;
      try { channel.close(); } catch {}
    }
    if (peer){
      peer.ondatachannel = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      peer.onicecandidateerror = null;
      try { peer.close(); } catch {}
    }
  }

  _setStatus(state, message){
    this.state = state;
    this.dispatchEvent(new CustomEvent('status', {
      detail: { state, message, role: this.role },
    }));
  }

  _emitError(error){
    const normalized = error instanceof Error ? error : new Error(String(error || 'Unknown PvP error'));
    this.dispatchEvent(new CustomEvent('error', { detail: normalized }));
  }
}

// Star room: guests maintain one connection to the host; the host relays combat
// packets to the other guests. This avoids an N-by-N full mesh and works on the
// existing static public site without pretending it has a game server.
export class PvpRoom extends EventTarget {
  constructor(role, options = {}){
    super();
    if (!['host', 'guest'].includes(role)) throw new TypeError('PvP room role must be host or guest.');
    this.role = role;
    this.localId = role === 'host' ? pvpSeatId(0) : null;
    this.links = new Map();
    this.pending = null;
    this.guestLink = null;
    this.inBattle = false;
    this.options = options;
    this._closed = false;
  }

  get connected(){
    return this.role === 'host'
      ? [...this.links.values()].some(link => link.connected)
      : !!this.guestLink?.connected;
  }

  get playerCount(){ return 1 + (this.role === 'host' ? this.links.size : (this.connected ? 1 : 0)); }
  get readyState(){ return this.connected ? 'open' : 'closed'; }
  get connectionState(){ return this.connected ? 'connected' : 'closed'; }
  get canInvite(){ return this.role === 'host' && !this.pending && this.playerCount < MAX_PVP_PLAYERS; }

  _emit(type, detail){ this.dispatchEvent(new CustomEvent(type, { detail })); }
  _status(state, message){ this._emit('status', { state, message, role: this.role }); }

  _wire(link, peerId){
    link.addEventListener('status', event => this._emit('status', { ...event.detail, peerId }));
    link.addEventListener('warning', event => this._emit('warning', { ...event.detail, peerId }));
    link.addEventListener('error', event => this._emit('error', Object.assign(event.detail, { peerId })));
    link.addEventListener('open', () => {
      if (this.role === 'host'){
        if (this.pending?.link === link){
          this.pending = null;
          this.links.set(peerId, link);
        }
      }
      this._emit('open', { role: this.role, peerId });
      this._status('connected', `${this.playerCount}/${MAX_PVP_PLAYERS} pilots linked.`);
    });
    link.addEventListener('message', event => {
      const value = event.detail;
      if (!value || typeof value !== 'object') return;
      if (this.role === 'host'){
        const packet = { ...value, senderId: peerId };
        if (this.inBattle){
          for (const [otherId, other] of this.links){
            if (otherId === peerId || !other.connected) continue;
            try { other.send({ roomRelay: true, senderId: peerId, payload: value }); } catch {}
          }
        }
        this._emit('message', packet);
      } else if (value.roomRelay && value.payload && typeof value.payload === 'object'){
        this._emit('message', { ...value.payload, senderId: value.senderId });
      } else {
        this._emit('message', { ...value, senderId: pvpSeatId(0) });
      }
    });
    link.addEventListener('close', () => {
      if (this.role === 'host'){
        this.links.delete(peerId);
        if (this.pending?.link === link) this.pending = null;
        this._emit('peerclose', { peerId });
        if (!this.links.size) this._emit('close', { peerId });
      } else {
        this._emit('peerclose', { peerId: pvpSeatId(0) });
        this._emit('close', { peerId: pvpSeatId(0) });
      }
    });
  }

  async createHostOffer(){
    if (!this.canInvite) throw new Error(this.pending ? 'Finish the current invite first.' : 'The PvP room is full.');
    let peerId = null;
    for (let seat = 1; seat < MAX_PVP_PLAYERS; seat++){
      const candidate = pvpSeatId(seat);
      if (!this.links.has(candidate)){ peerId = candidate; break; }
    }
    if (!peerId) throw new Error('The PvP room is full.');
    const link = new PvpLink(this.options);
    this.pending = { peerId, link };
    this._wire(link, peerId);
    try { return await link.createHostOffer(); }
    catch (error){ if (this.pending?.link === link) this.pending = null; link.close(); throw error; }
  }

  async acceptGuestAnswer(code){
    if (this.role !== 'host' || !this.pending) throw new Error('Create a host invite before applying an answer.');
    return this.pending.link.acceptGuestAnswer(code);
  }

  async acceptHostOffer(code){
    if (this.role !== 'guest') throw new Error('Only a guest can join a host invite.');
    if (this.guestLink) throw new Error('Reset before joining another room.');
    const link = new PvpLink(this.options);
    this.guestLink = link;
    this._wire(link, pvpSeatId(0));
    return link.acceptHostOffer(code);
  }

  setLocalId(id){ this.localId = String(id || ''); }
  beginBattle(){ this.inBattle = true; }

  send(message){
    if (this.role === 'host'){
      let sent = 0;
      for (const link of this.links.values()) if (link.connected){
        link.send({ roomRelay: true, senderId: this.localId, payload: message });
        sent++;
      }
      if (!sent) throw new Error('No PvP guests are connected.');
      return;
    }
    if (!this.guestLink?.connected) throw new Error('The PvP host link is not connected.');
    this.guestLink.send(message);
  }

  sendTo(peerId, message){
    if (this.role !== 'host') return this.send(message);
    const link = this.links.get(peerId);
    if (!link?.connected) throw new Error(`Pilot ${peerId} is no longer connected.`);
    link.send(message);
  }

  close(){
    if (this._closed) return;
    this._closed = true;
    this.pending?.link?.close();
    this.pending = null;
    for (const link of this.links.values()) link.close();
    this.links.clear();
    this.guestLink?.close();
    this.guestLink = null;
  }
}
