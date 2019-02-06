const express = require("express");
const responseTime = require("response-time");
const axios = require("axios");
const redis = require("redis");

const app = express();

// create and connect redis client to local instance.
const client = redis.createClient();

// print redis errors to console
client.on("error", err => {
  console.log("Something went wrong ", err);
});

// use response-time as middleware
app.use(responseTime());

// create an api/search route
app.get("/api/search", (req, res) => {
  // extract the query from url and trim trailing spaces
  const query = req.query.query.trim();
  // build the wikipedia API url
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=parse&format=json&section=0&page=${query}`;

  // try fetching the result from redis first in case we have it cached
  return client.get(`search:${query}`, (err, result) => {
    // if that key exist in redis store
    if (result) {
      const resultJson = JSON.parse(result);
      return res.status(200).json(resultJson);
    } else {
      // key does not exist in redis store
      // fetch directly from wikipedia API
      return axios
        .get(searchUrl)
        .then(response => {
          const responseJson = response.data;
          // save the wikipedia API response in redis store with expiration time
          client.setex(
            `search:${query}`,
            3600,
            JSON.stringify({
              source: "Redis Cache",
              ...responseJson
            })
          );
          // send json response to client
          return res.status(200).json({
            source: "Wikipedia API",
            ...responseJson
          });
        })
        .catch(err => {
          return res.json(err);
        });
    }
  });
});

app.listen(3000, () => {
  console.log("Server listening on port: ", 3000);
});
