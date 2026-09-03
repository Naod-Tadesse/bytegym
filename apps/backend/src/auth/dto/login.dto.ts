import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

import { normalisePhone, PHONE_MESSAGE, PHONE_REGEX } from '../phone';

export class LoginDto {
  /**
   * Staff log in with their phone number — bytegym has no email anywhere.
   * Normalised before validation, so a pasted +251912345678 still works.
   */
  @Transform(({ value }) =>
    typeof value === 'string' ? normalisePhone(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
