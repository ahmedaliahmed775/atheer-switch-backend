import crypto from 'crypto';

/**
 * Verify ECDSA P-256 signature for the payload `${atheerToken}|${timestamp}`.
 * @param {string} publicKey - PEM-encoded public key (hardware-backed, from OfflineToken).
 * @param {string} signature - Base64-encoded signature from SDK.
 * @param {string} atheerToken - Token value.
 * @param {string|number} timestamp - Timestamp used in the payload.
 * @returns {boolean} True if signature is valid, false otherwise.
 */
export function verifyBiometricSignature({ publicKey, signature, atheerToken, timestamp }) {
  if (!publicKey || !signature || !atheerToken || !timestamp) return false;
  try {
    const payload = `${atheerToken}|${timestamp}`;
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payload);
    verifier.end();
    // Signature is base64, publicKey is PEM
    return verifier.verify(publicKey, Buffer.from(signature, 'base64'));
  } catch (err) {
    return false;
  }
}
