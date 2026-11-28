/** Lower case and without accents, so "lucia" finds "Lucía" (the search of Alumnos and the student picker). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}
