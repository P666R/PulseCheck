import pg from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env['DATABASE_URL'];

const pool = new pg.Pool({ connectionString });

export const adapter = new PrismaPg(pool);
