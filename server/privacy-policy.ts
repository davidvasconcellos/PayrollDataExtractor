
import { Request, Response, NextFunction } from 'express';

export const privacyHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};

export const dataRetentionPolicy = {
  maxRetentionDays: 30,
  autoDeleteEnabled: true
};

// Log data access for audit trail
export const auditLog = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const { method, path, ip } = req;
  
  console.log(`[AUDIT] ${timestamp} - ${method} ${path} - IP: ${ip}`);
  next();
};
