import { cleanEnv, makeValidator, port, str, url } from 'envalid';

const scryptHash = makeValidator((v) => {
  if (/^[0-9a-fA-F]{32}:[0-9a-fA-F]{128}$/.test(v)) return v;
  throw new Error("Expected '32char_salt:128char_hash'");
});

const sha512 = makeValidator((v) => {
  if (/^[0-9a-fA-F]{128}$/.test(v)) return v;
  throw new Error('Expected a 128-character hex string (SHA512)');
});

export const envConfig = cleanEnv(process.env, {
  APP_VERSION: str({ default: '1.0.0', desc: 'major.minor.patch' }),

  NODE_ENV: str({
    choices: ['development', 'test', 'production'],
    default: 'development',
  }),

  CORS_ALLOWED_ORIGINS: str({ default: '' }),

  PORT: port({ default: 5000 }),

  DATABASE_URL: url({ desc: 'Postgres connection string' }),

  LOG_LEVEL: str({
    choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
    default: 'debug',
  }),

  DUMMY_HASHED_PASSWORD: scryptHash(),
  JWT_ALGO: str({ default: 'HS256' }),
  JWT_EXPIRES_IN: str({ default: '1d' }),
  JWT_ACCESS_SECRET_KEY: sha512(),
  JWT_REFRESH_SECRET_KEY: sha512(),
});

export type EnvConfig = typeof envConfig;
