import { getFiles } from "./pageRank";
import fs from "fs";
import * as cheerio from "cheerio";
import { hashify, tokenize } from "./buildIndex";
import { porterStemmer } from "./utils/stemmer";
const generateFingerprint = (tokenFrequency: { [key: string]: number }) => {};

const computeSimiliarityHash = (s: string) => {
  const fileContent = fs.readFileSync(s);
  const fileContentString = fileContent.toString();
  const { url, content } = JSON.parse(fileContentString);
  const $ = cheerio.load(content);
  const plainText = $(":not(script)").text();
  const tokenizedTokens = tokenize(plainText).map((t) => porterStemmer(t));
  const tokenFrequency = tokenizedTokens.reduce((acc, token) => {
    if (!acc[token]) {
      acc[token] = 1;
    } else {
      acc[token] += 1;
    }
    return acc;
  }, {});
  console.log(tokenFrequency);
};

const main = async () => {
  const allFiles = await getFiles();
  computeSimiliarityHash(allFiles[0]);
};

main();
