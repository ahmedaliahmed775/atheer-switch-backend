import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock dependencies before importing the controller
jest.unstable_mockModule('../models/Transaction.js', () => ({
  default: {
    create: jest.fn().mockResolvedValue({ id: 'mock-tx-123', update: jest.fn() }),
    findOne: jest.fn(),
  },
}));

jest.unstable_mockModule('../services/routerService.js', () => ({
  default: {
    routeTransaction: jest.fn().mockResolvedValue({ success: true, providerRef: 'jawali-123' }),
  },
}));

// We mock crypto so we can control signature verification outcomes easily
jest.unstable_mockModule('../utils/cryptoUtils.js', () => ({
  reconstructLUK: jest.fn().mockReturnValue(Buffer.alloc(32, 1)),
  verifyHmacSignature: jest.fn().mockReturnValue(true),
}));

// Import controller dynamically AFTER mocks
const { chargePayment } = await import('../controllers/paymentController.js');

// Setup express app
const app = express();
app.use(express.json());
app.post('/process', chargePayment);

describe('Payment Controller API Integration', () => {
  const originalEnv = process.env;
  let mockVerifyHmacSignature;

  beforeAll(async () => {
    // Set required environment variables
    process.env.DEVICE_MASTER_SEED = '00112233445566778899aabbccddeeff';
    
    const cryptoModule = await import('../utils/cryptoUtils.js');
    mockVerifyHmacSignature = cryptoModule.verifyHmacSignature;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process a valid payment request and return 200', async () => {
    // Force signature to be valid
    mockVerifyHmacSignature.mockReturnValue(true);

    const validPayload = {
      deviceId: '711222333',
      counter: 45,
      timestamp: Date.now(), // Valid timestamp (not expired, not future)
      signature: 'validSignature123',
      amount: 1500,
      receiverAccount: '777888999',
      transactionType: 'P2M',
    };

    const res = await request(app)
      .post('/process')
      .send(validPayload);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBeDefined();
    expect(res.body.data.providerRef).toBe('jawali-123');
  });

  it('should reject payment if signature is invalid and return 401', async () => {
    // Force signature to fail checking
    mockVerifyHmacSignature.mockReturnValue(false);

    const payload = {
      deviceId: '711222333',
      counter: 46,
      timestamp: Date.now(),
      signature: 'invalidSignature123',
      amount: 1500,
      receiverAccount: '777888999',
      transactionType: 'P2M',
    };

    const res = await request(app)
      .post('/process')
      .send(payload);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/فشل التحقق من التوقيع الرقمي/);
  });

  it('should prevent replay attacks by rejecting expired requests and return 400', async () => {
    mockVerifyHmacSignature.mockReturnValue(true);

    const payload = {
      deviceId: '711222333',
      counter: 47,
      timestamp: Date.now() - 400000, // 400 seconds ago (older than 300s limit)
      signature: 'validSignature123',
      amount: 1500,
      receiverAccount: '777888999',
      transactionType: 'P2M',
    };

    const res = await request(app)
      .post('/process')
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/انتهت صلاحية الطلب/);
  });

  it('should reject request missing mandatory fields and return 400', async () => {
    const payload = {
      deviceId: '711222333',
      // Missing counter
      timestamp: Date.now(),
      signature: 'validSignature123',
      amount: 1500,
      receiverAccount: '777888999',
      // Missing transactionType
    };

    const res = await request(app)
      .post('/process')
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/الحقول الأساسية مطلوبة/);
  });
});
