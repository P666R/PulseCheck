import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

import { HEALTH_STATUS } from '#src/config/constants.js';
import { envConfig } from '#src/config/env.config.js';
import { getApplicationHealth } from '#src/index.js';

export class HealthRoute {
  public readonly router: Router = Router();

  constructor() {
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', (_req, res) => {
      if (!getApplicationHealth) {
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
          status: 'unhealthy',
          message: 'Application not fully initialized',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { components, ...appHealth } = getApplicationHealth();

      const memory = process.memoryUsage();
      const isHealthy =
        appHealth.status === HEALTH_STATUS.HEALTHY ||
        appHealth.status === HEALTH_STATUS.DEGRADED;

      const statusCode = isHealthy
        ? StatusCodes.OK
        : StatusCodes.SERVICE_UNAVAILABLE;

      res.status(statusCode).json({
        status: appHealth.status,
        version: envConfig.APP_VERSION,
        uptimeMs: Math.trunc(process.uptime() * 1000),
        system: {
          platform: process.platform,
          arch: process.arch,
          memory: {
            used: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
            total: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
            usagePercent: Math.round(
              (memory.heapUsed / memory.heapTotal) * 100,
            ),
          },
        },
        timestamp: new Date().toISOString(),
        components: [{ ...appHealth }, ...(components || [])],
      });
    });
  }
}
