import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
  cookies?: ZodType;
}

export const validateRequest =
  (schemas: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const targets: Array<keyof ValidationSchemas> = [
        'body',
        'params',
        'query',
        'cookies',
      ];

      // Safe initialization to prevent overwriting existing data across chained middlewares
      req.validatedData = req.validatedData || {};

      for (const target of targets) {
        if (schemas[target] && req[target]) {
          req.validatedData[target] = schemas[target].parse(
            req[target],
          ) as Record<string, unknown>;
        } else {
          // Guard and fallback safely to an empty object without erasing prior middleware keys
          req.validatedData[target] = req.validatedData[target] || {};
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
