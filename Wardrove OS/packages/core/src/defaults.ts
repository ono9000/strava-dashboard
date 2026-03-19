const WEAR_DEFAULTS: Record<string, number> = {
  'blouse':  1,
  'shirt':   1,
  't-shirt': 1,
  'polo':    2,
  'jeans':   3,
  'sweater': 4,
  'jacket':  8,
  'coat':    8,
}

/**
 * Returns the default number of wears before washing for a clothing category.
 * Falls back to 1 for unknown categories.
 */
export function getDefaultMaxWears(category: string): number {
  return WEAR_DEFAULTS[category.toLowerCase()] ?? 1
}
