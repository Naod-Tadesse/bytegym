import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

/**
 * Reads back what `@Permissions()` put on a route.
 *
 * Worth asserting because the string in the decorator is the same string
 * stored in `permissions.name` — nothing maps or namespaces them, so a typo is
 * a permission that silently never matches and a route nobody can reach. These
 * tests are the only thing that would catch `branch.delete` appearing on a
 * route when no such permission exists.
 */
export const permissionsOn = (
  controller: new (...args: never[]) => object,
  method: string,
): string[] | undefined =>
  Reflect.getMetadata(
    PERMISSIONS_KEY,
    (controller.prototype as Record<string, object>)[method],
  );

/** Whether a route is marked `@Public()` — no token required. */
export const isPublic = (
  controller: new (...args: never[]) => object,
  method: string,
): boolean =>
  Reflect.getMetadata(
    IS_PUBLIC_KEY,
    (controller.prototype as Record<string, object>)[method],
  ) === true;
