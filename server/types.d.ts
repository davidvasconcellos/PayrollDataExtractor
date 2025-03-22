import { User } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session: {
        userId?: number;
        destroy: (callback: (err: any) => void) => void;
        [key: string]: any;
      };
    }
  }
}

export {};