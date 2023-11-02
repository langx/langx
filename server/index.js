const express = require("express");
const app = express();

const env = require("dotenv").config();

const sdk = require("node-appwrite");
let client = new sdk.Client()
  .setEndpoint(process.env.APP_ENDPOINT) // Your API Endpoint
  .setProject(process.env.APP_PROJECT) // Your project ID
  .setKey(process.env.API_KEY); // Your secret API key
// .setSelfSigned(); // Use only on dev mode with a self-signed SSL cert

let users = new sdk.Databases(client);

console.log(process.env.APP_ENDPOINT);

app.get("/", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.post("/createRoom", (req, res) => {
  res.json({ message: "Hello from /createRoom!" });
});

app.listen(3000, () => {
  console.log("Express server listening on port 3001");
});
