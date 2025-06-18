/**
 * Helper functions for model selection and normalization
 */

/**
 * Normalizes the provider name from the model configuration
 * @param providerName The raw provider name from the model configuration
 * @param xaiApiKey XAI API key if available
 * @param googleApiKey Google API key if available
 * @param mistralApiKey Mistral API key if available
 * @returns Normalized provider name ('xai', 'google', or 'mistral')
 */
export function normalizeProviderName(
  providerName: string,
  xaiApiKey?: string,
  googleApiKey?: string,
  mistralApiKey?: string
): string {
  // Default provider based on available API keys
  if (!providerName) {
    if (xaiApiKey) return 'xai';
    if (googleApiKey) return 'google';
    if (mistralApiKey) return 'mistral';
    return 'xai'; // Default fallback
  }

  // Normalize provider names
  const provider = providerName.toLowerCase();
  
  if (provider === 'x-ai' || provider === 'xai' || provider.includes('grok')) {
    return 'xai';
  }
  
  if (provider === 'google' || provider.includes('gemini')) {
    return 'google';
  }
  
  if (provider === 'mistral' || provider.includes('mistral')) {
    return 'mistral';
  }
  
  // Default to XAI if we can't determine the provider
  return 'xai';
}

/**
 * Normalizes the model name based on the provider
 * @param modelName The raw model name from the configuration
 * @param provider The normalized provider name
 * @returns Normalized model name for the given provider
 */
export function normalizeModelName(modelName: string, provider: string): string {
  if (!modelName) {
    // Default models for each provider
    switch (provider) {
      case 'xai':
        return 'grok-3-latest';
      case 'google':
        return 'gemini-1.5-pro';
      case 'mistral':
        return 'mistral-large-latest';
      default:
        return 'grok-3-latest';
    }
  }

  // Remove provider prefixes (e.g., 'x-ai/grok-3-latest' -> 'grok-3-latest')
  const cleanModelName = modelName.replace(/^.*?\//, '');
  
  // Validate model name based on provider
  switch (provider) {
    case 'xai':
      return cleanModelName.includes('grok') ? cleanModelName : 'grok-3-latest';
    case 'google':
      return cleanModelName.includes('gemini') ? cleanModelName : 'gemini-1.5-pro';
    case 'mistral':
      return cleanModelName.includes('mistral') ? cleanModelName : 'mistral-large-latest';
    default:
      return cleanModelName;
  }
}

/**
 * Gets the full model identifier including provider prefix if needed
 * @param modelName The normalized model name
 * @param provider The normalized provider name
 * @returns Full model identifier for logging and tracking
 */
export function getFullModelIdentifier(modelName: string, provider: string): string {
  switch (provider) {
    case 'xai':
      return `x-ai/${modelName}`;
    case 'google':
      return `google/${modelName}`;
    case 'mistral':
      return `mistral/${modelName}`;
    default:
      return modelName;
  }
}
