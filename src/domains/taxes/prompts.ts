import { readFileSync } from 'fs';
import { join } from 'path';

const getPromptPath = (level: 'insecure' | 'secure') => {
  return join(process.cwd(), 'src', 'domains', 'taxes', `${level}.txt`);
};

export const prompts = {
  insecure: readFileSync(getPromptPath('insecure'), 'utf-8').trim(),
  secure: readFileSync(getPromptPath('secure'), 'utf-8').trim(),
};

