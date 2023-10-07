import path from "path";
import { readDir } from "./buildIndex";
import fs from "fs";
import * as cheerio from "cheerio";

// Define constants for the damping factor and number of iterations for the PageRank algorithm.
const __dirname = path.resolve();
const DAMPING_FACTOR = 0.85;
const ITERATIONS = 100;

// Define a structure to hold link data, which includes the URL of the page and an array of outlinks.
interface LinkData {
  url: string;
  outlinks: string[];
}

// Initialize a PageRank store that maps from URLs to their current PageRank and associated link data.
const urlToOutgoingCount = new Map<string, number>();
const urlToIncomingLinks = new Map<string, Set<string>>();

export const getFiles = async (): Promise<string[]> => {
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
  return allFiles;
};
const cleanUrl = (url: string) => {
  // remove the scheme and defragment the url and query params
  let cleanedUrl = url
    .replace(/(^\w+:|^)\/\//, "")
    .replace(/#.*$/, "")
    .replace(/\/$/, "")
    .replace(/\?.*$/, "");
  // remove any trailing slashes
  if (cleanedUrl.endsWith("/")) {
    cleanedUrl = cleanedUrl.slice(0, -1);
  }

  return cleanedUrl;
};
const savePageRankAsJson = async () => {
  const pageRankObj = Array.from(urlToOutgoingCount.entries()).map(
    ([url, outgoingCount]) => {
      const incomingLinks = urlToIncomingLinks.get(cleanUrl(url));
      const rank = 1 / urlToOutgoingCount.size;
      return {
        url: cleanUrl(url),
        outgoingCount,
        incomingLinks,
        rank,
      };
    }
  );

  // Sort the array by PageRank.
  pageRankObj.sort((a, b) => b.rank - a.rank);
  // Write the array to a JSON file.
  await fs.promises.writeFile(
    path.join(__dirname, "pageRank.json"),
    JSON.stringify(pageRankObj, null, 2)
  );
};

// Read link data from a document and store it in the PageRank store.
const buildLinkDataForDocument = async (filePath: string) => {
  // Read the file content.
  const fileContents = await fs.promises.readFile(filePath);
  const fileString = JSON.parse(fileContents.toString());

  // Extract the URL and content from the file.
  const { url: ogUrl, content } = fileString;
  const cleanedUrl = cleanUrl(ogUrl);

  // Find all outlinks in the content.
  const $ = cheerio.load(content);
  const outlinks: string[] = [];
  $("a").each((_, element) => {
    try {
      const href = $(element).attr("href");
      if (href) {
        const pageUrl = new URL(ogUrl); // the url the a tags exist on
        let absoluteUrl = new URL(href, pageUrl).href;

        if (absoluteUrl !== pageUrl.href) {
          outlinks.push(cleanUrl(absoluteUrl));
        }
      }
    } catch (error) {
      console.log("Some error encountered while parsing the url");
    }
  });

  // Add the page's data to the PageRank store.
  urlToOutgoingCount.set(cleanedUrl, outlinks.length);
  for (const outlink of outlinks) {
    if (!urlToIncomingLinks.has(outlink)) {
      urlToIncomingLinks.set(outlink, new Set());
    }
    urlToIncomingLinks.get(outlink)?.add(cleanedUrl);
  }
};

// Calculate PageRank for all pages in the store.
const calculatePageRank = () => {
  // Initialize all PageRank values to 1.
  const pageRank = new Map<string, number>();
  for (const url of urlToOutgoingCount.keys()) {
    pageRank.set(url, 1);
  }

  // Perform the PageRank algorithm.
  for (let i = 0; i < ITERATIONS; i++) {
    // Initialize the new PageRank values to 0.
    const newPageRank = new Map<string, number>();
    for (const url of urlToOutgoingCount.keys()) {
      newPageRank.set(url, 0);
    }

    // Calculate the new PageRank values.
    for (const [url, incomingLinks] of urlToIncomingLinks.entries()) {
      for (let incomingLink of incomingLinks) {
        const incomingCount = urlToOutgoingCount.get(incomingLink);
        if (incomingCount) {
          newPageRank.set(
            url,
            newPageRank.get(url)! + pageRank.get(incomingLink)! / incomingCount
          );
        }
      }
    }

    // Apply the damping factor.
    for (const url of urlToOutgoingCount.keys()) {
      newPageRank.set(
        url,
        1 - DAMPING_FACTOR + DAMPING_FACTOR * newPageRank.get(url)!
      );
    }

    // Update the PageRank values.
    for (const [url, rank] of newPageRank.entries()) {
      pageRank.set(url, rank);
    }
  }

  // Store the PageRank values in the PageRank store.
  //   for (const [url, rank] of pageRank.entries()) {
  //     pageRankStore.set(url, {
  //       rank,
  //       data: urlToOutgoingCount.get(url)?.data,
  //     });
  //   }
};

const main = async () => {
  try {
    // Read files and build link data for each document.
    const files = await getFiles();
    for (const file of files) {
      await buildLinkDataForDocument(file);
    }
    // Calculate PageRank for each document.
    calculatePageRank();
    await savePageRankAsJson();
    console.log("Page Ranked");
  } catch (error) {
    console.error(error);
  }
};
