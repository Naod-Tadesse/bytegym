import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * An administrative reset — deliberately no `currentPassword`. The caller
 * proves their right through `staff.resetPassword`, not through knowing the
 * locked-out person's password.
 *
 * There is no `confirmPassword` here: matching the two boxes is a typo guard
 * for the person typing, so the form checks it and the API never sees it.
 */
export class ResetStaffPasswordDto {
  @ApiProperty({ type: String, minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
