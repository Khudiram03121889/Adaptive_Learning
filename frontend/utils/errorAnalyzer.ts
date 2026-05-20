export type ErrorType = 
  | 'vowel_confusion'
  | 'phonetic_substitution'
  | 'missing_letters'
  | 'extra_letters'
  | 'order_mistakes'
  | 'completely_wrong'
  | 'none';

export function analyzeError(target: string, input: string): ErrorType {
  const t = target.toLowerCase().trim();
  const i = input.toLowerCase().trim();

  if (t === i) return 'none';

  if (i.length === 0) return 'completely_wrong';

  // Helper to check if string contains any of the letters
  const getVowels = (str: string) => str.match(/[aeiou]/g) || [];
  const getConsonants = (str: string) => str.match(/[^aeiou]/g) || [];

  // 1. Order mistakes: length is same, letters are same, just different order
  if (t.length === i.length && t.split('').sort().join('') === i.split('').sort().join('')) {
    return 'order_mistakes';
  }

  // 2. Vowel confusion: consonants are same, but vowels differ
  if (getConsonants(t).join('') === getConsonants(i).join('') && getVowels(t).join('') !== getVowels(i).join('')) {
    return 'vowel_confusion';
  }

  // 3. Phonetic substitution (naive simple check for common pairs)
  const phoneticPairs = [
    ['f', 'ph'], ['c', 'k'], ['s', 'c'], ['z', 's'], ['g', 'j'], ['t', 'd']
  ];
  let isPhonetic = false;
  for (const [a, b] of phoneticPairs) {
    if ((t.includes(a) && i.includes(b)) || (t.includes(b) && i.includes(a))) {
      // Very basic check, could be improved
      isPhonetic = true;
    }
  }
  if (isPhonetic && Math.abs(t.length - i.length) <= 1) {
    return 'phonetic_substitution';
  }

  // 4. Missing letters: input is shorter and is a subsequence (or just shorter)
  if (i.length < t.length) {
    return 'missing_letters';
  }

  // 5. Extra letters: input is longer
  if (i.length > t.length) {
    return 'extra_letters';
  }

  return 'completely_wrong';
}
