import { registerAs } from '@nestjs/config';
import { DEFAULT_CHATGPT_MODEL } from '../constants';

export default registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || DEFAULT_CHATGPT_MODEL,
}));
