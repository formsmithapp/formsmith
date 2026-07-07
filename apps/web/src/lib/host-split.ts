// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Optional host split, an env-gated generic feature. When the instance sets a
 * dedicated public-forms host (FORMSMITH_FORMS_HOST), the two audiences are
 * served from separate hosts: the app host carries the authed builder,
 * dashboard, and auth; the forms host serves ONLY public respondent pages
 * (`/f/*`). A request on the wrong host is 308-redirected to the canonical one,
 * in both directions. Unset = single-host, current behavior untouched.
 *
 * Pure and framework-free so it unit-tests cleanly; the proxy is a thin wrapper.
 *
 * API routes (`/api/*`) are host-agnostic: the API is same-container on both
 * hosts, so a respondent form submits same-origin and a dashboard call is
 * unaffected. Only page routes redirect.
 */

/** A public respondent page: the form page and its og:image. */
function isFormsPath(pathname: string): boolean {
  return pathname === '/f' || pathname.startsWith('/f/')
}

/**
 * The canonical host for this (host, path), or null to serve it as-is. Returns
 * a bare host (no scheme); the caller preserves protocol, port, and query.
 */
export function hostRedirect(input: {
  host: string
  pathname: string
  formsHost: string | undefined
  appHost: string
}): string | null {
  const { host, pathname, formsHost, appHost } = input
  // split disabled, or a misconfig where the two hosts collapse to one
  if (formsHost === undefined || formsHost === '' || formsHost === appHost) return null
  // APIs run same-container on either host; never redirect them
  if (pathname.startsWith('/api/')) return null

  if (host === formsHost) {
    // the forms host serves ONLY respondent pages; everything else is the app's
    return isFormsPath(pathname) ? null : appHost
  }
  if (host === appHost) {
    // respondent pages are canonical on the forms host
    return isFormsPath(pathname) ? formsHost : null
  }
  // any other host (a separate marketing site, localhost, previews) is left alone
  return null
}
