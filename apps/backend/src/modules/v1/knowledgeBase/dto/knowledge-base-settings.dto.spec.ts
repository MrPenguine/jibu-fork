import { EMBEDDING_MODELS, EMBEDDING_PROVIDERS } from './knowledge-base-settings.dto';
import { REFRESH_RATES } from './link-url-source.dto';

describe('knowledge base settings DTO constants', () => {
  it('lists the supported embedding models', () => {
    expect(EMBEDDING_MODELS).toEqual([
      'gemini-embedding-001',
      'text-embedding-3-small',
      'text-embedding-3-large',
      'nomic-embed-text-v2-moe',
      'qwen3-embedding',
      'qwen3-embedding:0.6b',
    ]);
  });

  it('allows gemini, openai and ollama providers', () => {
    expect([...EMBEDDING_PROVIDERS].sort()).toEqual(['gemini', 'ollama', 'openai']);
  });
});

describe('link URL source DTO constants', () => {
  it('exposes the four refresh cadences', () => {
    expect(REFRESH_RATES).toEqual(['never', 'daily', 'weekly', 'monthly']);
  });
});
