import { z } from 'zod';
import { logger } from '@anchorly/shared/logger';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
});

export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    logger.fatal(
      { issues: result.error.issues },
      `Missing or invalid environment variables: ${missing}`,
    );
    process.exit(1);
  }

  logger.info('All environment variables validated successfully');
}

export type Env = z.infer<typeof envSchema>;
