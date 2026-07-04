import { logger } from '@anchorly/shared/logger';
import { prisma } from '@anchorly/db';

logger.info({ app: 'api' }, '@anchorly/api: placeholder running — imports OK');

void prisma.$connect;
