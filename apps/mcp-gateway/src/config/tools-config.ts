import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ToolSecurityConfig {
  riskLevel: 'low' | 'medium' | 'high';
  readOnly: boolean;
  requiresConfirmation: boolean;
}

export type ToolsConfigMap = Record<string, ToolSecurityConfig>;

let configCache: ToolsConfigMap | null = null;

export function loadToolsConfig(): ToolsConfigMap {
  if (configCache) {
    return configCache;
  }

  const configPath = path.join(__dirname, 'tools-config.json');
  try {
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    configCache = JSON.parse(fileContent) as ToolsConfigMap;
    return configCache;
  } catch (error) {
    console.error('Failed to load tools-config.json:', error);
    return {};
  }
}

export function getToolConfig(toolName: string): ToolSecurityConfig {
  const config = loadToolsConfig();
  return config[toolName] || {
    riskLevel: 'high',
    readOnly: true,
    requiresConfirmation: true
  };
}
