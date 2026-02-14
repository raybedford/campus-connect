import { decodeBase64, encodeBase64 } from 'tweetnacl-util';

export function toBase64(data: Uint8Array): string {
  return encodeBase64(data);
}

export function fromBase64(b64: string): Uint8Array {
  return decodeBase64(b64);
}
