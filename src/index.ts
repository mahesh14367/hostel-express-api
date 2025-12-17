import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import route from "./routes/guestRoute.js";

const app = express();
// Load env values from src/.env (current file location)
dotenv.config({ path: "./src/.env" });

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  throw new Error("MONGO_URL is not set in environment variables");
}

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("database is connected successfully...");
    app.listen(PORT, () => {
      console.log(`server is running at localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.log(`there is an error in connecting to the database: ${err}`);
  });

app.use(express.json());

app.use("/", route);
