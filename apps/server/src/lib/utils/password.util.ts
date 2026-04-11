import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
};

export const verifyPassword = async (
  password: string,
  storedHash: string | undefined | null,
): Promise<boolean> => {
  if (!storedHash?.includes(':')) return false;

  const [salt = '', hash = ''] = storedHash.split(':');
  const hashBuffer = Buffer.from(hash, 'hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;

  return timingSafeEqual(hashBuffer, buf);
};
