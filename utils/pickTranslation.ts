interface TranslatableContent {
  name: string
  description?: string | null
  translations?: Record<string, { name: string; description?: string }>
}

export function pickTranslation(
  content: TranslatableContent,
  lang: string,
): { name: string; description: string | null } {
  const t = content.translations?.[lang]
  const name = t?.name?.trim() ? t.name : content.name
  const description = t?.description?.trim()
    ? t.description
    : (content.description ?? null)
  return { name, description }
}
