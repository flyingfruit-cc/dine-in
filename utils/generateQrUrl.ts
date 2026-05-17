export function generateQrUrl(slug: string, tableNumber: number): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.dine-in-cc.com'
  return `${base}/${slug}/${tableNumber}`
}
