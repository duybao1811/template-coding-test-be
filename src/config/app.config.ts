import { registerAs } from '@nestjs/config';
import * as process from 'node:process';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.APP_BASE_URL,
  corsOrigin: process.env.CORS_ORIGIN,
}));
