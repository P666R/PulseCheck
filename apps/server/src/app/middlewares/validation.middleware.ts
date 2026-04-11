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

      for (const target of targets) {
        if (schemas[target] && req[target]) {
          const validatedData = schemas[target].parse(req[target]);
          // Modify the object content instead of reassigning the property
          Object.assign(req[target], validatedData);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
