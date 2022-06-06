import env from "dotenv";
import FigmaFetcher from "./figma.js";

const {
  parsed: { FIGMA_TOKEN },
} = env.config();

const fetcher = new FigmaFetcher({
  figma_token: FIGMA_TOKEN,
  file_key: "LN55Z8FlquGwiteZ91aPVY",
});

const groups = await fetcher.pages();
console.log(groups);
