import { env } from '../config/env.js';

const VAULT_URL = env.VAULT_ADDR || 'http://vault:8200';
const VAULT_TOKEN = env.VAULT_TOKEN || 'root';

export class VaultService {
  /**
   * Write a secret to Vault KV V2
   */
  static async writeSecret(path: string, data: Record<string, any>) {
    try {
      const response = await fetch(`${VAULT_URL}/v1/secret/data/${path}`, {
        method: 'POST',
        headers: {
          'X-Vault-Token': VAULT_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vault write error: ${response.status} ${errText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('VaultService.writeSecret error:', error);
      throw error;
    }
  }

  /**
   * Read a secret from Vault KV V2
   */
  static async readSecret(path: string): Promise<Record<string, any> | null> {
    try {
      const response = await fetch(`${VAULT_URL}/v1/secret/data/${path}`, {
        method: 'GET',
        headers: {
          'X-Vault-Token': VAULT_TOKEN
        }
      });

      if (response.status === 404) {
        return null; // Secret not found
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vault read error: ${response.status} ${errText}`);
      }

      const json = await response.json();
      return json.data?.data || null;
    } catch (error) {
      console.error('VaultService.readSecret error:', error);
      throw error;
    }
  }
}
