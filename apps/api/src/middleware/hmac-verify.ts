import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '@anchorly/shared/logger';

export function hmacVerify(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const deliveryId = req.headers['x-github-delivery'] as string | undefined;

  if (!signature) {
    res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
    return;
  }

  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    logger.fatal('GITHUB_APP_WEBHOOK_SECRET is not set');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const rawBody = req.body as Buffer;
  if (!rawBody || !(rawBody instanceof Buffer)) {
    res.status(400).json({ error: 'Missing raw body' });
    return;
  }

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

  try {
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);

    if (expectedBuf.length !== signatureBuf.length || !timingSafeEqual(expectedBuf, signatureBuf)) {
      logger.warn({ deliveryId }, 'HMAC signature mismatch');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  logger.info({ deliveryId }, 'HMAC signature verified');
  next();
}
