export function formatChrome(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    values[k] !== undefined ? String(values[k]) : `{${k}}`,
  )
}
