import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

console.log("Assignment 2 setup OK");
console.log(
  "OpenRouter key configured:",
  Boolean(process.env.OPENROUTER_API_KEY),
);
console.log("Tavily key configured:", Boolean(process.env.TAVILY_API_KEY));
console.log("LLM model configured:", Boolean(process.env.LLM_MODEL));
