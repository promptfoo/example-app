import { readFileSync } from 'fs';
import { join } from 'path';

const getPromptPath = (level: 'insecure' | 'secure') => {
  // When compiled, files are in dist/, but txt files stay in src/
  // Use process.cwd() to get project root and navigate to src
  return join(process.cwd(), 'src', 'domains', 'general', `${level}.txt`);
};

export const prompts = {
  insecure: readFileSync(getPromptPath('insecure'), 'utf-8').trim(),
  secure: readFileSync(getPromptPath('secure'), 'utf-8').trim(),
};

