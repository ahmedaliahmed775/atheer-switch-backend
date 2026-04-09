import crypto from 'crypto';
import { reconstructLUK, verifyHmacSignature } from '../utils/cryptoUtils.js';

describe('Atheer Crypto Utils (HMAC-SHA256)', () => {
  const masterSeed = 'e571d798aeb24e4d5885c39efcdefdd5108fccaf7a3baec49a175df38dc6ba38'; // Example 32-byte hex string
  const deviceId = '711222333'; // Payer phone
  
  // Create deviceSeed as it is done in paymentController
  let deviceSeed;
  beforeAll(() => {
    const hmac = crypto.createHmac('sha256', Buffer.from(masterSeed, 'hex'));
    hmac.update(deviceId);
    deviceSeed = hmac.digest();
  });

  describe('reconstructLUK', () => {
    it('should correctly derive a 32-byte LUK given a deviceSeed and counter', () => {
      const counter = 1;
      const luk = reconstructLUK(deviceSeed, counter);
      
      expect(luk).toBeDefined();
      expect(Buffer.isBuffer(luk)).toBe(true);
      expect(luk.length).toBe(32);
    });

    it('should return null when input is invalid or missing', () => {
      expect(reconstructLUK(null, 1)).toBeNull();
      expect(reconstructLUK(deviceSeed, null)).toBeNull();
      expect(reconstructLUK()).toBeNull();
    });
  });

  describe('verifyHmacSignature', () => {
    it('should successfully verify a valid signature matching SDK logic', () => {
      const counter = 11;
      const timestamp = 1700000000000;
      const luk = reconstructLUK(deviceSeed, counter);

      // Simulate Android SDK Payload creation:
      // signature = Base64( HMAC-SHA256(LUK, "deviceId|counter|timestamp") )
      const payload = `${deviceId}|${counter}|${timestamp}`;
      const sdkHmac = crypto.createHmac('sha256', luk);
      sdkHmac.update(payload);
      const validSignatureBase64 = sdkHmac.digest('base64');

      // Verify the signature mechanism exactly as backend would
      const isValid = verifyHmacSignature({
        deviceId,
        counter,
        timestamp,
        signature: validSignatureBase64,
        luk
      });

      expect(isValid).toBe(true);
    });

    it('should fail verification if the counter is manipulated', () => {
      const counter = 11;
      const tamperedCounter = 12; // Attacker changed it
      const timestamp = 1700000000000;
      const luk = reconstructLUK(deviceSeed, counter);
      
      const payload = `${deviceId}|${counter}|${timestamp}`;
      const payloadHmac = crypto.createHmac('sha256', luk).update(payload).digest('base64');

      const isValid = verifyHmacSignature({
        deviceId,
        counter: tamperedCounter, // Validating with tampered counter
        timestamp,
        signature: payloadHmac,
        luk
      });

      expect(isValid).toBe(false);
    });

    it('should fail verification if the amount/payload could be considered modified indirectly', () => {
      // Because we sign specific fields, modifying timestamp or deviceId
      const counter = 11;
      const timestamp = 1700000000000;
      const luk = reconstructLUK(deviceSeed, counter);

      const payload = `${deviceId}|${counter}|${timestamp}`;
      const payloadHmac = crypto.createHmac('sha256', luk).update(payload).digest('base64');

      const isValid = verifyHmacSignature({
        deviceId,
        counter,
        timestamp: 1700000000001, // Timestamp altered slightly
        signature: payloadHmac,
        luk
      });

      expect(isValid).toBe(false);
    });

    it('should handle missing fields gracefully and return false without throwing an error', () => {
      const counter = 11;
      const timestamp = 1700000000000;
      const luk = reconstructLUK(deviceSeed, counter);

      expect(verifyHmacSignature({ deviceId, counter, timestamp, luk })).toBe(false); // Missing signature
      expect(verifyHmacSignature({ deviceId, counter, signature: 'xyz', luk })).toBe(false); // Missing timestamp
      expect(verifyHmacSignature({ deviceId: null, counter, timestamp, signature: 'xyz', luk })).toBe(false); // Missing deviceId
    });
  });
});
