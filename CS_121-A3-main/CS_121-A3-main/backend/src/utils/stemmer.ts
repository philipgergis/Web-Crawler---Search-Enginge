export const porterStemmer = (word: string) => {
  const step1ab = (word: string) => {
    if (word.endsWith("sses")) {
      return word.slice(0, -2);
    } else if (word.endsWith("ies")) {
      return word.slice(0, -2);
    } else if (word.endsWith("ss")) {
      return word;
    } else if (word.endsWith("s")) {
      return word.slice(0, -1);
    }

    if (word.endsWith("eed")) {
      const stem = word.slice(0, -3);
      const m = new RegExp(/[^aeiou][aeiouy][^aeiouy]*$/).test(stem);
      if (m) {
        return stem + "ee";
      } else {
        return word;
      }
    } else if (word.endsWith("ing")) {
      const stem = word.slice(0, -3);
      const v = new RegExp(/[aeiouy]/).test(stem);
      if (v) {
        return stem;
      }
    } else if (word.endsWith("ed")) {
      const stem = word.slice(0, -2);
      const v = new RegExp(/[aeiouy]/).test(stem);
      if (v) {
        return stem;
      }
    }

    return word;
  };

  return step1ab(word);
};
