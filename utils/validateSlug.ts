// No leading/trailing/consecutive hyphens; alphanumeric start and end
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/

export function isValidSlugFormat(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 50 && SLUG_REGEX.test(slug)
}
