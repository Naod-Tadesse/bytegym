import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { ErrorResponseDto } from './error-response.dto';

/** Keeps controllers readable — the `type` is the same on every one of these. */
export const ApiNotFoundError = (description: string) =>
  applyDecorators(ApiNotFoundResponse({ description, type: ErrorResponseDto }));

export const ApiConflictError = (description: string) =>
  applyDecorators(ApiConflictResponse({ description, type: ErrorResponseDto }));

/** Covers both shapes: ValidationPipe (string[]) and ParseUUIDPipe (string). */
export const ApiBadRequestError = (
  description = 'Body failed validation, or :id is not a valid UUID.',
) =>
  applyDecorators(
    ApiBadRequestResponse({ description, type: ErrorResponseDto }),
  );
