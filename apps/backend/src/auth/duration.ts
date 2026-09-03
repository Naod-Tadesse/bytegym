const UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/**
 * Turns `15m` / `7d` into seconds.
 *
 * `@nestjs/jwt` types `expiresIn` as `ms.StringValue | number`, and
 * `ms.StringValue` only reaches us through a transitive `@types/ms`. Passing a
 * number sidesteps that entirely and validates the env value while we are here.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match) {
    throw new Error(
      `Invalid duration "${value}". Expected a number followed by s, m, h or d — e.g. 15m or 7d.`,
    );
  }

  return Number(match[1]) * UNITS[match[2]];
}
