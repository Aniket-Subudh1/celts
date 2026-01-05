export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(array: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(31, h) + input.charCodeAt(i);
  }
  return h >>> 0;
}

export function shuffleQuestionsBySection<T extends { sectionId?: string | null }>(
  questions: T[],
  seedBase: string
): T[] {
  const sectionMap = new Map<string, T[]>();

  for (const q of questions) {
    const key = q.sectionId || "_default";
    if (!sectionMap.has(key)) sectionMap.set(key, []);
    sectionMap.get(key)!.push(q);
  }

  const finalList: T[] = [];

  for (const [sectionId, sectionQuestions] of sectionMap.entries()) {
    const seed = hashSeed(`${seedBase}-${sectionId}`);
    const shuffled = seededShuffle(sectionQuestions, seed);
    finalList.push(...shuffled);
  }

  return finalList;
}
