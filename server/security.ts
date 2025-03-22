
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { expressCspHeader } from 'express-csp-header';

// Rate limiting to prevent brute force attacks
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: false // We'll define our own CSP
});

// Content Security Policy
export const csp = expressCspHeader({
  directives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"]
  }
});

// PDF validation middleware
export const validatePDF = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ message: "No PDF file provided" });
  }

  // Check file signature (PDF magic number)
  const signature = req.file.buffer.toString('hex', 0, 4);
  if (signature !== '25504446') { // %PDF in hex
    return res.status(400).json({ message: "Invalid PDF file" });
  }

  // Check file size (10MB limit)
  if (req.file.size > 10 * 1024 * 1024) {
    return res.status(400).json({ message: "File too large" });
  }

  next();
};

// Clean PDF data after processing
export const cleanupPDFData = (req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (req.file?.buffer) {
      req.file.buffer = Buffer.alloc(0);
    }
  });
  next();
};
