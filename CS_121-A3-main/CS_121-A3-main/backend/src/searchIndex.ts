import fs from "fs";
import path from "path";
import { hashify, tokenize } from "./buildIndex";
import { porterStemmer } from "./utils/stemmer";
import * as cheerio from "cheerio";

// Define the directory name
const __dirname = path.resolve();

// Create a response for no results
export const emptyResponse = (offset, limit) => ({
  results: [],
  total: 0,
  time: 0,
  offset,
  limit,
});

// Function to search the index
export const searchIndex = async (query: string, offset = 0, limit = 5) => {
  // Mark the start time
  const startTime = Date.now();

  // Tokenize and stem the query
  const tokenizedQuery = tokenize(query).map((token) => porterStemmer(token));

  // Return empty response if no tokens
  if (tokenizedQuery.length === 0) {
    return emptyResponse(offset, limit);
  }

  // Maps to hold the results and the document id intersection
  const resultsMap = new Map();
  let docIdIntersection = new Set();

  // List to hold the index maps of each token
  const indexMaps = [];

  // Loop over each token in the query
  for (let token of tokenizedQuery) {
    // Hashify the token
    const bucket = hashify(token);

    // Get the corresponding index
    const index = JSON.parse(
      await fs.promises.readFile(
        path.join(__dirname, `./subIndexes/${bucket}.json`),
        "utf-8"
      )
    );

    // Get the postings of the token
    const postings = index[token]?.postings;

    // If no postings, move on to the next token
    if (!postings) continue;

    // Set to hold the document ids and a Map to hold the postings
    const docIdSet = new Set();
    const postingMap = new Map();

    // Loop over each posting
    for (let posting of postings) {
      // Add the document id to the Set and the posting to the Map
      docIdSet.add(posting.docId);
      postingMap.set(posting.docId, posting.tfIdf);
    }

    // Add the posting map to the list
    indexMaps.push(postingMap);

    // Perform intersection of the document ids
    docIdIntersection =
      docIdIntersection.size === 0
        ? docIdSet
        : new Set(
            [...docIdIntersection].filter((docId) => docIdSet.has(docId))
          );
  }

  // If no intersection, return empty response
  if (docIdIntersection.size === 0) {
    return emptyResponse(offset, limit);
  }

  // Loop over each document id in the intersection
  for (let docId of docIdIntersection) {
    let sumTfIdf = 0;

    // Loop over each index map and sum the tf-idf scores
    for (let indexMap of indexMaps) {
      sumTfIdf += indexMap.get(docId) || 0;
    }

    // Add the document id and the tf-idf score to the results map
    resultsMap.set({ docId, tfIdf: sumTfIdf }, sumTfIdf);
  }

  // Sort the results by tf-idf score
  const sortedResults = Array.from(resultsMap.entries())
    .sort((a, b) => {
      const diff = b[0].tfIdf - a[0].tfIdf; // Difference in tf-idf scores

      if (diff > 0) return 1;
      if (diff < 0) return -1;

      // Only check for docId if tfIdf scores are equal
      return a[0].docId < b[0].docId ? -1 : 1;
    })
    .map((entry) => entry[0]);
  console.log(sortedResults.slice(offset, (offset + 1) * limit));

  // Mark the end time
  let timeToSubtract = 0;
  const formattedResults = [];

  // Prepare the results for display
  const final = await Promise.all(
    sortedResults.slice(offset, (offset + 1) * limit).map(async ({ docId }) => {
      // Read the document file
      const file = await fs.promises.readFile(
        path.join(__dirname, docId),
        "utf-8"
      );

      // Parse the document as JSON
      const json = JSON.parse(file);

      // Get the URL
      const url = json.url;

      const localStart = Date.now();
      // Load the content into Cheerio
      const $ = cheerio.load(json.content);

      // Remove unwanted elements
      $("script, style").remove();

      // Get the title and the plain text
      const title = $("title").text();
      const plainText = $.root().text().replace(/\s+/g, " ");

      // Create a preview
      const preview = plainText.split(" ").slice(0, 50).join(" ");
      const localEnd = Date.now();
      timeToSubtract += localEnd - localStart;
      // Add the result to the list of results
      return {
        url,
        title,

        preview: preview.length > 200 ? preview.slice(0, 200) + "..." : preview,
      };
    })
  );
  const endTime = Date.now();
  // Return the results, the total count, the time taken, the offset and the limit
  return {
    results: final,
    total: sortedResults.length,
    time: endTime - startTime,
    searchTime: endTime - startTime - timeToSubtract,
    offset,
    limit,
  };
};
