const dotenv = require("dotenv");
dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;

const studentName = "Mark Nguyen";
const studentId = "123456789";

const now = new Date();

const formattedUTC =
  now.getUTCFullYear() + "-" +
  String(now.getUTCMonth() + 1).padStart(2, "0") + "-" +
  String(now.getUTCDate()).padStart(2, "0") + " " +
  String(now.getUTCHours()).padStart(2, "0") + ":" +
  String(now.getUTCMinutes()).padStart(2, "0") + ":" +
  String(now.getUTCSeconds()).padStart(2, "0");

  if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY not found");
  process.exit(1);
}

console.log("API Key loaded successfully");

console.log(`git-cm: Developed by ${studentName} - ${studentId}`);
console.log(`Run Date (UTC): ${formattedUTC}`);
console.log("--------------------------------------------------------------");