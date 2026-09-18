import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Loads a local .env file if present, for development and manual ingest runs.
 * In production the systemd unit supplies the environment instead.
 *
 * process.loadEnvFile is Node 20.12+; older runtimes silently skip this.
 */
export function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  if (typeof process.loadEnvFile !== 'function') return;
  process.loadEnvFile(envPath);
}
