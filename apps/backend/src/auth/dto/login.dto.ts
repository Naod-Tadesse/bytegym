import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

import { normalisePhone, PHONE_MESSAGE, PHONE_REGEX } from '../phone';

export class LoginDto {
  /**
   * Staff log in with their phone number — bytegym has no email anywhere.
   * Normalised before validation, so a pasted +251912345678 still works.
   */
  @ApiProperty({
    type: String,
    example: '0912345678',
    pattern: PHONE_REGEX.source,
    // The pattern alone reads stricter than reality — normalisePhone runs first.
    description:
      'Ethiopian mobile in local form. `+251912345678` and `251912345678` are ' +
      'also accepted; both are normalised to `0912345678` before validation.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalisePhone(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiProperty({ type: String, minLength: 6, example: 'Admin@123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
