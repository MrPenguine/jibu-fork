import {
  EMBEDDING_MODELS,
  DEFAULT_EMBEDDING_MODEL,
  resolveEmbeddingModel,
} from './embedding.service';

describe('embedding model registry', () => {
  it('exposes the supported models with correct dimensions', () => {
    expect(EMBEDDING_MODELS['gemini-embedding-001']).toEqual({
      provider: 'gemini',
      dimension: 768,
      maxChunkChars: 8000,
    });
    expect(EMBEDDING_MODELS['text-embedding-3-small'].dimension).toBe(1536);
    expect(EMBEDDING_MODELS['text-embedding-3-large'].dimension).toBe(3072);
  });

  it('marks the OpenAI models with the openai provider', () => {
    expect(EMBEDDING_MODELS['text-embedding-3-small'].provider).toBe('openai');
    expect(EMBEDDING_MODELS['text-embedding-3-large'].provider).toBe('openai');
  });

  it('gives each model a positive maxChunkChars bound', () => {
    for (const spec of Object.values(EMBEDDING_MODELS)) {
      expect(spec.maxChunkChars).toBeGreaterThan(0);
    }
  });
});

describe('resolveEmbeddingModel', () => {
  it('returns the requested model when known', () => {
    const { model, spec } = resolveEmbeddingModel('text-embedding-3-large');
    expect(model).toBe('text-embedding-3-large');
    expect(spec.dimension).toBe(3072);
  });

  it('falls back to the default for unknown or empty models', () => {
    expect(resolveEmbeddingModel('nope').model).toBe(DEFAULT_EMBEDDING_MODEL);
    expect(resolveEmbeddingModel(undefined).model).toBe(DEFAULT_EMBEDDING_MODEL);
    expect(resolveEmbeddingModel(null).model).toBe(DEFAULT_EMBEDDING_MODEL);
  });

  it('always resolves to a spec present in the registry', () => {
    const { model, spec } = resolveEmbeddingModel('anything-else');
    expect(EMBEDDING_MODELS[model]).toEqual(spec);
  });
});
