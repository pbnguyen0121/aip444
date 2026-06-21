import { join } from "path";

function calculateTotal(prices) {
  let x = 0;

  for (const price of prices) {
    x += price;
  }

  return x.toString();
}

function main() {
  const apiKey = "sk-12345-abcde-secret-key";

  const user = {
    id: 1,
    name: "Alice",
  };

  fs.writeFileSync("log.txt", "User logged in");

  console.log("Current user:", user);
  console.log("Total:", calculateTotal([10.5, 20, 5.25]));
}

main();
