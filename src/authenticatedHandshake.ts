import {
  deriveSharedSecret,
  exportPublicKey,
  generateIdentityKeyPair,
  generateIdentityKeys,
  getFingerprint,
  signPublicKey,
  verifyPublicKeySignature,
} from './crypto.ts';

export type VerificationStatus = 'verified' | 'unverified';
export type HandshakeState =
  | 'idle'
  | 'awaiting_peer'
  | 'established_unverified'
  | 'established_verified'
  | 'key_changed'
  | 'error';

export type HandshakePacket = {
  type: 'AUTH_HELLO_V1';
  fromUserId: string;
  identityPublicKeySpkiB64: string;
  identityFingerprintHex: string;
  ephemeralPublicKeySpkiB64: string;
  ephemeralSignatureB64: string;
  timestamp: number;
};

export type PeerRecord = {
  userId: string;
  identityPublicKeySpkiB64: string;
  fingerprintHex: string;
  verificationStatus: VerificationStatus;
};

export class InMemoryPeerStore {
  private peers = new Map<string, PeerRecord>();

  get(userId: string): PeerRecord | undefined {
    return this.peers.get(userId);
  }

  upsert(record: PeerRecord): void {
    this.peers.set(record.userId, record);
  }

  markVerified(userId: string): void {
    const existing = this.peers.get(userId);
    if (!existing) return;
    this.peers.set(userId, { ...existing, verificationStatus: 'verified' });
  }
}

async function importEcdsaIdentityPublicKey(spkiB64: string): Promise<CryptoKey> {
  const binary = atob(spkiB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    'spki',
    bytes,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify'],
  );
}

export class AuthenticatedHandshakeMachine {
  public state: HandshakeState = 'idle';
  public warning: string | null = null;

  private readonly myUserId: string;
  private readonly myIdentity: CryptoKeyPair;
  private readonly store: InMemoryPeerStore;
  private pendingEphemeral: CryptoKeyPair | null = null;

  private constructor(myUserId: string, myIdentity: CryptoKeyPair, store: InMemoryPeerStore) {
    this.myUserId = myUserId;
    this.myIdentity = myIdentity;
    this.store = store;
  }

  static async create(myUserId: string, store = new InMemoryPeerStore()): Promise<AuthenticatedHandshakeMachine> {
    const identity = await generateIdentityKeys();
    return new AuthenticatedHandshakeMachine(myUserId, identity, store);
  }

  async initiateHandshake(): Promise<HandshakePacket> {
    const ephemeral = await generateIdentityKeyPair();
    this.pendingEphemeral = ephemeral;

    const identityPublicKeySpkiB64 = await exportPublicKey(this.myIdentity.publicKey);
    const identityFingerprintHex = await getFingerprint(this.myIdentity.publicKey);
    const ephemeralPublicKeySpkiB64 = await exportPublicKey(ephemeral.publicKey);
    const ephemeralSignatureB64 = await signPublicKey(ephemeral.publicKey, this.myIdentity.privateKey);

    this.state = 'awaiting_peer';

    return {
      type: 'AUTH_HELLO_V1',
      fromUserId: this.myUserId,
      identityPublicKeySpkiB64,
      identityFingerprintHex,
      ephemeralPublicKeySpkiB64,
      ephemeralSignatureB64,
      timestamp: Date.now(),
    };
  }

  async receiveHandshake(packet: HandshakePacket): Promise<{ sessionKey: CryptoKey | null }> {
    const existing = this.store.get(packet.fromUserId);

    if (existing && existing.identityPublicKeySpkiB64 !== packet.identityPublicKeySpkiB64) {
      this.state = 'key_changed';
      this.warning = 'KEY CHANGED';
      return { sessionKey: null };
    }

    const peerIdentityKey = await importEcdsaIdentityPublicKey(packet.identityPublicKeySpkiB64);
    const signatureValid = await verifyPublicKeySignature(
      packet.ephemeralPublicKeySpkiB64,
      packet.ephemeralSignatureB64,
      peerIdentityKey,
    );

    if (!signatureValid) {
      this.state = 'error';
      this.warning = 'Invalid ephemeral key signature';
      return { sessionKey: null };
    }

    if (!existing) {
      this.store.upsert({
        userId: packet.fromUserId,
        identityPublicKeySpkiB64: packet.identityPublicKeySpkiB64,
        fingerprintHex: packet.identityFingerprintHex,
        verificationStatus: 'unverified',
      });
    }

    if (!this.pendingEphemeral) {
      this.pendingEphemeral = await generateIdentityKeyPair();
    }

    const peerEphemeral = await crypto.subtle.importKey(
      'spki',
      Uint8Array.from(atob(packet.ephemeralPublicKeySpkiB64), (c) => c.charCodeAt(0)),
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      [],
    );

    const sessionKey = await deriveSharedSecret(this.pendingEphemeral.privateKey, peerEphemeral);
    const peer = this.store.get(packet.fromUserId);

    this.state = peer?.verificationStatus === 'verified' ? 'established_verified' : 'established_unverified';
    this.warning = null;

    return { sessionKey };
  }

  markPeerVerified(userId: string): void {
    this.store.markVerified(userId);
    this.state = 'established_verified';
  }

  getPeer(userId: string): PeerRecord | undefined {
    return this.store.get(userId);
  }
}
