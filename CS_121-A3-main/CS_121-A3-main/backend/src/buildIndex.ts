import fs from "fs";
import path from "path";
import { IInvertedIndex, IPosting, IRecord } from "./utils/interfaces";
import { convert } from "html-to-text";
import { porterStemmer } from "./utils/stemmer";
import * as cheerio from "cheerio";
import { RLock } from "./utils/RLock";
const __dirname = path.resolve();

let sitesIndex = 0;
let totalSites = 55_393;
let totalMemoryUsage = 0;

const maxBuckets = 100;

const bucketLocks = Array(maxBuckets);
const indexDir = "subIndexes";
// ensure that the subIndexes directory exists
if (!fs.existsSync(indexDir)) {
  fs.mkdirSync(indexDir);
}
const saveSubIndexByBucket = async (
  bucket: number,
  subIndex: IInvertedIndex
) => {
  const subIndexFile = path.join(__dirname, `./${indexDir}/${bucket}.json`);
  const subIndexJSON = JSON.stringify(subIndex);
  await fs.promises.writeFile(subIndexFile, subIndexJSON);
};

export const finalizeTfIdf = async () => {
  for (let i = 0; i < maxBuckets; i++) {
    const subIndex = await fetchSubIndexByBucket(i);
    for (const token in subIndex) {
      const idf = Math.log(totalSites / subIndex[token].postings.length);
      for (let j = 0; j < subIndex[token].postings.length; j++) {
        subIndex[token].postings[j].tfIdf *= idf;
        if (subIndex[token].postings[j].importance == 1) {
          subIndex[token].postings[j].tfIdf *= 1.5;
        }
      }
    }
    await saveSubIndexByBucket(i, subIndex);
  }

  console.log("Finalized tf-idf");
};
const initiateBuckets = async () => {
  for (let i = 0; i < maxBuckets; i++) {
    const bucketPath = path.join(__dirname, `./${indexDir}/${i}.json`);
    await fs.promises.writeFile(bucketPath, "");
    bucketLocks[i] = new RLock();
  }
};

export const hashify = (word: string) => {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash += word.charCodeAt(i);
  }
  return hash % maxBuckets;
};

const saveSubIndex = async (token: string, subIndex: IInvertedIndex) => {
  const bucket = hashify(token);
  const subIndexFile = path.join(__dirname, `./subIndexes/${bucket}.json`);
  const subIndexJSON = JSON.stringify(subIndex);
  await fs.promises.writeFile(subIndexFile, subIndexJSON);
};

const fetchSubIndexByToken = async (token: string) => {
  const bucket = hashify(token);
  const subIndex = await fs.promises.readFile(
    path.join(__dirname, `./subIndexes/${bucket}.json`)
  );
  return JSON.parse(
    subIndex.toString().length > 0 ? subIndex.toString() : "{}"
  );
};

const fetchSubIndexByBucket = async (bucket: number) => {
  const subIndex = await fs.promises.readFile(
    path.join(__dirname, `./subIndexes/${bucket}.json`)
  );
  return JSON.parse(
    subIndex.toString().length > 0 ? subIndex.toString() : "{}"
  );
};

const progressBar = (current: number, total: number) => {
  const percentage = Math.floor((current / total) * 100);
  const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

  // compute running average of memory usage using current and previous memory usage as well as current counter
  totalMemoryUsage += memoryUsage;
  const bar = Array(Math.floor(percentage / 2))
    .fill("█")
    .join("");
  const dots = Array(50 - Math.floor(percentage / 2))
    .fill(".")
    .join("");
  process.stdout.write(
    `\r[${bar}${dots}] ${percentage}% ${current}/${total} - Current ${memoryUsage.toFixed(
      2
    )} MB | Average ${(totalMemoryUsage / current).toFixed(2)} MB`
  );
};

export const readDir = async (dir: string): Promise<string[]> => {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);

      return dirent.isDirectory() ? readDir(res) : res;
    })
  );
  return Array.prototype.concat(...files);
};

export const tokenize = (content: string): string[] => {
  content = content.replace(/\s+/g, " ");
  content = content.toLowerCase();

  const regexMatches = content.matchAll(/[a-zA-Z'’-]+/g);

  const arrayedTokens: string[] = Array.from(regexMatches).map(
    (match) => match[0]
  );
  return arrayedTokens;
};

const handleLargeJsonFileLoadWithStream = async (
  filename: string
): Promise<IRecord> => {
  const readStream = fs.createReadStream(filename, { encoding: "utf8" });

  let jsonData = "";

  for await (const chunk of readStream) {
    jsonData += chunk;
  }
  try {
    return JSON.parse(jsonData);
  } catch (e) {
    console.log(filename);
    console.log(jsonData);
    throw e;
  }
};

const buildInvertedIndexForWebsite = async (filename: string) => {
  let record: IRecord = await handleLargeJsonFileLoadWithStream(filename);

  const relativePath = path.relative(__dirname, filename);

  const plainText = record.content.replace(/<[^>]*>?/gm, "");
  const $ = cheerio.load(record.content);
  record = null;
  const headings = $("h1, h2, h3, h4, h5, h6").text();
  const tokens = tokenize(plainText);

  for (let i = 0; i < tokens.length; i++) {
    const token = porterStemmer(tokens[i]);

    const bucket = hashify(token);
    try {
      await bucketLocks[bucket].acquire();
      const subIndex = await fetchSubIndexByToken(token);
      let importance = 0;
      if (headings.includes(token)) {
        importance = 1;
      } else {
        importance = 0;
      }

      const posting: IPosting = {
        docId: relativePath,
        tfIdf: tokens.filter((t) => t === token).length,
      };
      if (!subIndex[token]) {
        subIndex[token] = {
          importance,
          postings: [posting],
        };
      } else {
        if (
          subIndex[token].postings
            .map(({ docId }) => docId)
            .includes(relativePath)
        )
          return;
        subIndex[token].postings.push(posting);
      }
      await saveSubIndex(token, subIndex);
    } catch (error) {
      console.error(`Error processing ${filename}`);
      console.error(error);
    } finally {
      bucketLocks[bucket].release();
    }
  }
};

const buildInvertedIndexForChunk = async (chunk: string[]) => {
  for (let i = 0; i < chunk.length; i++) {
    await buildInvertedIndexForWebsite(chunk[i]);
    sitesIndex++;
    progressBar(sitesIndex, totalSites);
  }
};

export const buildIndex = async () => {
  const startTime = Date.now();
  await initiateBuckets();
  // get all files, not directories, in the data directory and its subdirectories
  const files = await fs.promises.readdir(path.join(__dirname, "data"), {
    withFileTypes: true,
  });
  const filePaths = await Promise.all(
    files.map((file) => {
      const res = path.resolve(__dirname, "data", file.name);
      return file.isDirectory() ? readDir(res) : res;
    })
  );
  // get the first 10 files
  const allFiles = Array.prototype.concat(...filePaths);

  const threads = 10;
  const chunkSize = Math.ceil(allFiles.length / threads);
  totalSites = allFiles.length;

  const chunks = [];

  for (let i = 0; i < allFiles.length; i += chunkSize) {
    chunks.push(allFiles.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      await buildInvertedIndexForChunk(chunk);
    })
  );

  //   for (let i = 0; i < allFiles.length; i++) {
  //     await buildInvertedIndexForWebsite(allFiles[i]);
  //   }

  console.log("Calculating tf-idf scores...");
  await finalizeTfIdf();

  const endTime = Date.now();
  console.log(`Finished in ${(endTime - startTime) / 1000} seconds.`);

  console.log("Saved inverted index.");
  let tokenCount = 0;

  for (let i = 0; i < maxBuckets; i++) {
    const subIndex = await fetchSubIndexByBucket(i);
    tokenCount += Object.keys(subIndex).length;
  }
  console.log(`Number of tokens: ${tokenCount}`);
  console.log(`Number of sites: ${totalSites}`);
  console.log(
    `Average number of tokens per site: ${
      Object.keys(tokenCount).length / totalSites
    }`
  );
};
