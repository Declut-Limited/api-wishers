import { randomInt } from 'crypto';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

// Random, URL-safe share slug; callers check uniqueness against their own collection.
export function generateSlug(length = 10): string {
  return Array.from(
    { length },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join('');
}
