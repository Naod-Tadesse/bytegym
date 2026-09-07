/**
 * Whether `pathname` is inside the nav item at `url`.
 *
 * Deliberately NOT `pathname.startsWith(url)`. That matches on characters
 * rather than path segments, so `/membership-plans` starts with `/members` —
 * the eight characters line up exactly — and both entries light up at once,
 * with the header breadcrumb naming the wrong one.
 *
 * Matching the segment boundary instead means a URL only counts as inside
 * another when the next character actually ends the segment. Any future pair
 * that shares a prefix (`/payments` and `/payment-methods`, say) is safe by
 * construction rather than by nobody having noticed yet.
 */
export function isNavActive(pathname: string, url: string): boolean {
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(`${url}/`);
}
