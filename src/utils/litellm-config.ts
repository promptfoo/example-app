import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface LiteLLMConfig {
  model_list?: Array<{
    model_name: string;
    litellm_params?: {
      model: string;
    };
  }>;
}

let allowedModels: string[] | null = null;

/**
 * Load and parse the LiteLLM configuration file
 * Returns the list of allowed model names
 */
export function getAllowedModels(): string[] {
  if (allowedModels !== null) {
    return allowedModels;
  }

  try {
    const configPath = path.join(process.cwd(), 'litellm_config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as LiteLLMConfig;

    // Extract model names from model_list
    const models: string[] = [];
    if (config.model_list) {
      for (const modelConfig of config.model_list) {
        // Use model_name if available, otherwise fall back to litellm_params.model
        const modelName = modelConfig.model_name || modelConfig.litellm_params?.model;
        if (modelName) {
          models.push(modelName);
        }
      }
    }

    allowedModels = models;
    return models;
  } catch (error) {
    console.error('Error loading LiteLLM config:', error);
    // Return empty array if config can't be loaded (fail open for now)
    // In production, you might want to fail closed
    return [];
  }
}

/**
 * Check if a model is allowed
 */
export function isModelAllowed(model: string): boolean {
  const allowed = getAllowedModels();
  return allowed.length === 0 || allowed.includes(model);
}

