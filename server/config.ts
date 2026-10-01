import { existsSync } from 'node:fs';

/** Load `.env` if present (Node 20.12+ built-in, no extra dependency). */
if (existsSync('.env')) process.loadEnvFile('.env');

export interface ServerConfig {
  port: number;
  allowedOrigins: string[];
  logEvents: boolean;
  anthropicApiKey?: string;
  llmModel: string;
  llmTimeoutMs: number;
  rateLimitPerMinute: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 8080),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:8080')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    logEvents: env.LOG_EVENTS !== 'false',
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    llmModel: env.LLM_MODEL?.trim() || 'claude-opus-5-5',
    llmTimeoutMs: Number(env.LLM_TIMEOUT_MS ?? 8000),
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE ?? 60),
  };
}
