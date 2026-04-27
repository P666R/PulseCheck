import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient, UserRole } from '../generated/prisma/client';

import 'dotenv/config';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const scryptAsync = promisify(scrypt);

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
};

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'sam@gmail.com' },
    update: {},
    create: {
      email: 'sam@gmail.com',
      name: 'sam doe',
      password: await hashPassword('!Password123@#'),
      address: '123 club st, tech city',
      role: UserRole.SYSTEM_ADMIN,
    },
  });

  const storeOwner1 = await prisma.user.upsert({
    where: { email: 'jam@gmail.com' },
    update: {},
    create: {
      email: 'jam@gmail.com',
      name: 'jam doe',
      password: await hashPassword('!Password123@#'),
      address: '234 club st, tech city',
      role: UserRole.STORE_OWNER,
      ownedStores: {
        create: {
          name: 'jam cloth store',
          email: 'jam-cloth-store@gmail.com',
          address: 'jam cloth store st, tech city',
        },
      },
    },
    include: { ownedStores: true },
  });

  const storeOwner2 = await prisma.user.upsert({
    where: { email: 'pam@gmail.com' },
    update: {},
    create: {
      email: 'pam@gmail.com',
      name: 'pam doe',
      password: await hashPassword('!Password123@#'),
      address: '345 club st, tech city',
      role: UserRole.STORE_OWNER,
      ownedStores: {
        create: {
          name: 'pam electronics store',
          email: 'pam-electronics-store@gmail.com',
          address: 'pam electronics store st, tech city',
        },
      },
    },
    include: { ownedStores: true },
  });

  const normalUser1 = await prisma.user.upsert({
    where: { email: 'kam@gmail.com' },
    update: {},
    create: {
      email: 'kam@gmail.com',
      name: 'kam doe',
      password: await hashPassword('!Password123@#'),
      address: '321 residential ave, suburbia',
      role: UserRole.NORMAL_USER,
    },
  });

  const normalUser2 = await prisma.user.upsert({
    where: { email: 'lam@gmail.com' },
    update: {},
    create: {
      email: 'lam@gmail.com',
      name: 'lam doe',
      password: await hashPassword('!Password123@#'),
      address: '432 residential ave, suburbia',
      role: UserRole.NORMAL_USER,
    },
  });

  console.log({ admin, storeOwner1, storeOwner2, normalUser1, normalUser2 });
}

try {
  await main();
  await prisma.$disconnect();
  await pool.end();
} catch (e) {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
}
