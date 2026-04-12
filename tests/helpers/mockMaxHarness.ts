import { decodeMessage, encodeMessage, isEncryptedMessage, type EncryptedEnvelope } from '../../src/messageProtocol.ts';

export type SecurityState = 'plaintext' | 'secure-unverified' | 'secure-verified' | 'blocked';

export type MockMessage = {
  from: string;
  raw: string;
};

export class MockChatDom {
  public composer = '';
  public outbox: MockMessage[] = [];
  public inbox: MockMessage[] = [];
  public selectorsHealthy: boolean;

  constructor(selectorsHealthy = true) {
    this.selectorsHealthy = selectorsHealthy;
  }

  canFindComposer(): boolean {
    return this.selectorsHealthy;
  }

  canFindSendButton(): boolean {
    return this.selectorsHealthy;
  }
}

export class MockUserClient {
  public state: SecurityState = 'plaintext';
  public warnings: string[] = [];
  public encryptedMode = false;
  public pinnedFingerprint?: string;
  public readonly userId: string;
  public readonly fingerprint: string;
  public readonly dom: MockChatDom;

  constructor(userId: string, fingerprint: string, dom: MockChatDom) {
    this.userId = userId;
    this.fingerprint = fingerprint;
    this.dom = dom;
  }

  initiateHandshake(peer: MockUserClient): void {
    if (this.pinnedFingerprint && this.pinnedFingerprint !== peer.fingerprint) {
      this.state = 'blocked';
      this.warnings.push('Peer key mismatch');
      return;
    }

    this.state = 'secure-unverified';
    this.pinnedFingerprint = peer.fingerprint;
  }

  respondHandshake(peer: MockUserClient): void {
    if (this.pinnedFingerprint && this.pinnedFingerprint !== peer.fingerprint) {
      this.state = 'blocked';
      this.warnings.push('Peer key mismatch');
      return;
    }

    this.state = 'secure-unverified';
    this.pinnedFingerprint = peer.fingerprint;
  }

  verifyPeer(): void {
    if (this.state === 'secure-unverified') this.state = 'secure-verified';
  }

  compose(text: string, encrypted: boolean): void {
    this.dom.composer = text;
    this.encryptedMode = encrypted;
  }

  sendTo(peer: MockUserClient): void {
    if (!this.dom.canFindComposer() || !this.dom.canFindSendButton()) {
      this.warnings.push('DOM selectors unavailable, fallback to plaintext');
      peer.dom.inbox.push({ from: this.userId, raw: this.dom.composer });
      return;
    }

    const shouldEncrypt = this.encryptedMode && this.state !== 'blocked';
    if (!shouldEncrypt) {
      peer.dom.inbox.push({ from: this.userId, raw: this.dom.composer });
      return;
    }

    const envelope: EncryptedEnvelope = {
      version: 1,
      type: 'encrypted',
      sender: this.userId,
      timestamp: Date.now(),
      nonce: `${this.userId}-${Date.now()}`,
      ciphertext: btoa(this.dom.composer),
    };

    peer.dom.inbox.push({ from: this.userId, raw: encodeMessage(envelope) });
  }

  readLatest(): { decrypted: string; encrypted: boolean } | null {
    const latest = this.dom.inbox.at(-1);
    if (!latest) return null;

    if (!isEncryptedMessage(latest.raw)) {
      return { decrypted: latest.raw, encrypted: false };
    }

    const decoded = decodeMessage(latest.raw);
    if (decoded.kind !== 'encrypted') {
      this.warnings.push('Malformed encrypted message');
      return null;
    }

    try {
      return { decrypted: atob(decoded.envelope.ciphertext), encrypted: true };
    } catch {
      this.warnings.push('Decrypt failed');
      return null;
    }
  }
}
