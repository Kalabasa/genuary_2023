const adjectives = ["unstable", "infinite", "mortal", "visible", "ethereal", "paradoxical"];
const subjects = ["dream", "tragedy", "imagination", "emotion", "existence"];
const actions = ["fly", "hide", "live"];
const adverbs = ["truly", "temporarily", "instantly", "infinitely"];

let lastFetchTime = 0;
const wordCache = loadWordCache();
const usedWords = new Set();

const poem = [];
generatePoem().then(renderPoem);

function renderPoem() {
  const main = document.querySelector("main");

  const lines = poem.join(" ").split("\n")
    .map(line => line.trim())
    .filter(line => line)
    .map((line, index, array) => {
      let text = line;
      let style = "typewriter";

      if (index === array.length - 1) {
        text += ".";
        style = "fade";
      }

      return {
        text,
        style,
      };
    });

  let time = 0;

  for (const line of lines) {
    const lineDiv = document.createElement("div");
    lineDiv.classList.add("line");
    lineDiv.classList.add(line.style);
    for (const word of line.text.split(" ")) {
      const wordSpan = document.createElement("span");
      wordSpan.classList.add("word");
      for (const letter of word) {
        const letterSpan = document.createElement("span");
        letterSpan.classList.add("letter");
        letterSpan.textContent = letter;

        let delay;
        if (line.style === "typewriter") {
          time += 50;
          delay = time;
        } else { // fade
          delay = time + Math.random() * 300;
        }

        letterSpan.style.animationDelay = `${delay}ms`;

        wordSpan.appendChild(letterSpan);
      }
      lineDiv.appendChild(wordSpan);
      lineDiv.append(" ");
      time += 50;
    }
    main.appendChild(lineDiv);
    time += 400;
  }
}

async function generatePoem() {
  const mainAdjective = pick(adjectives);
  const mainSubject = pick(subjects);
  const mainAction = pick(actions);
  const mainAdverb = pick(adverbs);
  console.log({ mainAdjective, mainSubject, mainAction, mainAdverb });

  if (Math.random() < 0.3) {
    addWordToPoem(pick(await getSynonyms(pick(adjectives), "adjective", 0, 5)));
    addWordToPoem(pluralize(pick(await getSynonyms(pick(subjects), "noun", 0, 5))));
    poem.push("\n");
  }

  addWordToPoem(pick(await getSynonyms(mainAdjective, "adjective", 0, 5)));
  addWordToPoem(pluralize(pick(await getSynonyms(mainSubject, "noun", 0, 5))));
  poem.push("\n");

  if (Math.random() < 0.2) {
    addWordToPoem(pick(await getSynonyms(pick(adverbs), "adverb", 0, 5)));
    addWordToPoem(pick(await getSynonyms(pick(adjectives), "adjective", 0, 5)));
    poem.push("\n");
  } else {
    addWordToPoem(pick(await getSynonyms(mainAdjective, "adjective", 0, 5)));
    const antonyms = await getAntonyms(mainAdjective, "adjective", 0, 5);
    if (antonyms.length > 0 && Math.random() < 1 / (1 + Math.exp(-antonyms.length / 2))) {
      poem.push(pick(["as", "yet", "however", "but", "although", "even if", "albeit"]));
      addWordToPoem(pick(antonyms));
    } else {
      poem.push(pick(["yet", "but", "even if", "albeit", "except"]));
      poem.push(["not"]);
      addWordToPoem(pick(await getSynonyms(mainAdjective, "adjective", 0, 5)));
    }
    poem.push("\n");
  }

  addWordToPoem(pick(await getSynonyms(mainAction, "verb", 0, 5)));
  addWordToPoem(pick(await getSynonyms(mainAdverb, "adverb", 0, 5)));
  poem.push("\n");

  console.log(poem.join(" "));
}

function addWordToPoem(word) {
  poem.push(word);
  usedWords.add(word);
}

function pick(array) {
  const filtered = array.filter(w => usedWords.has(w));
  if (filtered.length > 0) array = filtered;
  return array[Math.floor(Math.random() * array.length)];
}

async function getAntonyms(word, partOfSpeech, minDepth = 1, maxDepth = 1) {
  const result = new Set();
  const ignoreSynonyms = new Set(usedWords);

  do {
    const synonyms = await getSynonyms(word, partOfSpeech, minDepth, maxDepth, ignoreSynonyms);
    if (synonyms.length === 0) break;

    for (const synonym of synonyms) {
      for await (const meaning of fetchMeanings(synonym, partOfSpeech)) {
        for (const antonym of meaning.antonyms) {
          if (!isWord(antonym)) continue;
          if (usedWords.has(antonym)) continue;
          result.add(antonym);
        }
      }

      ignoreSynonyms.add(synonym);
    }

    maxDepth++;
    minDepth = maxDepth;
  } while (result.size === 0);

  return [...result.values()];
}

async function getSynonyms(word, partOfSpeech, minDepth = 1, maxDepth = 1, ignore = new Set(usedWords)) {
  if (maxDepth < 1) return [];

  const result = [];

  if (minDepth <= 0 && !ignore.has(word)) {
    result.push(word);
  }
  ignore.add(word);

  for await (const meaning of fetchMeanings(word, partOfSpeech)) {
    for (const synonym of meaning.synonyms) {
      if (!isWord(synonym)) continue;
      if (ignore.has(synonym)) continue;

      if (minDepth <= 1 && maxDepth >= 1) {
        result.push(synonym);
        ignore.add(synonym);
      }

      if (maxDepth > 1) {
        result.push(...(await getSynonyms(synonym, partOfSpeech, minDepth - 1, maxDepth - 1, ignore)));
      }
    }
  }

  return result;
}

async function* fetchMeanings(word, partOfSpeech) {
  for (const item of await getWord(word)) {
    for (const meaning of item.meanings) {
      if (meaning.partOfSpeech === partOfSpeech) {
        yield meaning;
      }
    }
  }
}

async function getWord(word) {
  if (wordCache.has(word)) return wordCache.get(word);
  return await fetchWord(word);
}

async function fetchWord(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;

  return await waitUntil(lastFetchTime + 1000)
    .then(() => fetch(url, {
      mode: 'cors',
      cache: 'force-cache',
    }))
    .then(async res => {
      lastFetchTime = Date.now();

      let value = res.ok ? await res.json() : [];

      if (res.ok || res.status >= 400 && res.status <= 499) {
        wordCache.set(word, value);
        saveWordCache(wordCache);
      }

      return value;
    })
    .catch(() => []);
}

function loadWordCache() {
  const wordCache = new Map(window.preloadedWordCache ?? []);

  try {
    const stored = localStorage.getItem("wordCache");
    const storedData = JSON.parse(stored);
    for (const [k, v] of storedData) {
      wordCache.set(k, v);
    }
  } catch {
  }

  return wordCache;
}

function saveWordCache(wordCache) {
  localStorage.setItem("wordCache", JSON.stringify([...wordCache.entries()]));
}

function isWord(word) {
  return !word.includes(" ") && !word.includes(".");
}

async function waitUntil(untilTime) {
  const delay = untilTime - Date.now();
  if (delay <= 0) {
    return Promise.resolve();
  } else {
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}