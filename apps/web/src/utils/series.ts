export function normalizeSeries(name: string | null | undefined): string {
  if (!name || name === 'N/A') return '';
  return name.toLowerCase().replace(/^the\s+/, '').replace(/\s+#\d+(\.\d+)?$/, '').trim();
}

export function displaySeriesName(name: string | null | undefined): string {
  if (!name || name === 'N/A') return '';
  return name.replace(/\s+#\d+(\.\d+)?$/, '').trim();
}

export function getSeriesSequence(name: string | null | undefined): number {
  const match = name?.match(/\s+#(\d+(?:\.\d+)?)$/);
  return match ? parseFloat(match[1]) : Infinity;
}
