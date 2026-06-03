import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const promptsDir = path.dirname(fileURLToPath(import.meta.url));
const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const filePath = path.join(promptsDir, `${name}.md`);
  const content = readFileSync(filePath, 'utf-8');
  cache.set(name, content);
  return content;
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`renderPrompt: missing variable "${key}"`);
    }
    return vars[key];
  });
}

export function clearPromptCache(): void {
  cache.clear();
}
