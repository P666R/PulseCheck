import type { ReqId } from 'pino-http';

import { STATUS } from '#src/config/constants.js';

export interface ApiSuccessResponse {
  status: STATUS;
  message: string;
  data?: object;
  accessToken?: string;
  requestId: ReqId;
  correlationId?: string;
  timestamp: Date;
}
