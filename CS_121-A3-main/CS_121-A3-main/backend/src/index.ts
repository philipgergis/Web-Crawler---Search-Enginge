import express from "express";
import { emptyResponse, searchIndex } from "./searchIndex";
import cors from "cors";
import { Configuration, OpenAIApi } from "openai";
import env from "dotenv";
import { empty } from "cheerio/lib/api/manipulation";
import { finalizeTfIdf } from "./buildIndex";
env.config();

const app = express();
const port = 3000;

app.use(cors());
// const v = async () => {
//   await finalizeTfIdf();
// };
// v();

const validateParams = (
  {
    query,
    offset,
    limit,
  }: {
    query: string;
    offset: string;
    limit: string;
  },
  req,
  res
) => {
  if (!offset || !limit) {
    res.status(400).send({
      message: "Please provide valid query, offset, and limit parameters.",
    });
    return;
  }

  if (isNaN(Number(offset)) || isNaN(Number(limit))) {
    res.status(400).send({
      message: "Offset and limit should be numbers.",
    });
    return;
  }
};

app.get("/search", async (req, res) => {
  // get parameters from the query string
  const { query, offset = 0, limit = 50 } = req.query;

  validateParams(
    {
      query: query as string,
      offset: offset as string,
      limit: limit as string,
    },
    req,
    res
  );
  try {
    const results = await searchIndex(
      query as string,
      Number(offset),
      Number(limit)
    );

    res.status(200).send(results);
  } catch (error) {
    console.error(error);
    res.send(emptyResponse(offset, limit));
  }
});
app.get("/openai", async (req, res) => {
  if (process.env.OPENAI_API_KEY === undefined) {
    res.send({
      summary: "Please provide OPENAI_API_KEY in .env file",
    });
  }
  const { query } = req.query;
  console.log(`Generating summary for ${query}`);
  if (!query) {
    res.status(400).send({
      message: "Please provide valid query",
    });
  }

  const results = await searchIndex(query as string, 0, 10);

  if (results.results.length === 0) {
    return;
  }

  const text = results.results;
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: `Summarize the following search results:\n${JSON.stringify(
          text
        )}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  const summary = response.data.choices[0].message.content;
  res.status(200).send({ summary });
  return;

  try {
  } catch (error) {
    console.error(error);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  // You can uncomment the below line if you want to build the index at the start of the server
  // buildIndex();
});
