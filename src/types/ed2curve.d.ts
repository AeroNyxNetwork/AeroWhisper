declare module 'ed2curve' {
  export function convertPublicKey(edPublicKey: Uint8Array): Uint8Array | null;
  export function convertSecretKey(edSecretKey: Uint8Array): Uint8Array | null;
}
