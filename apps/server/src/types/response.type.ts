export type ApiSuccessResponse<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  message: string;
  accessToken?: string;
} & T;
