var express = require('express');
var router = express.Router();
const pool = require('../db');
const redis = require('redis');
// while running local
/* const client = redis.createClient({
  host: '127.0.0.1',
  port: 6379
}); */
// from a docker container, use name of redis container
const client = redis.createClient({
  host: 'redis-url-shortener',
  port: 6379
});
client.on('error', function (err) {
  console.log('Redis Error:', err); // errors here
  throw err;
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

/* Generate short link. */
router.post('/api/link', function(req, res, next) {
  var fullLink = req.body.url;
  console.log("Received a request with URL:" + fullLink);
  // check for empty URL
  if (fullLink == "")
    return res.status(400).json({ error: "Empty URL!" });

  // check in database
  pool.getConnection(function(err, connection){
    var selectSQL = 'SELECT * FROM Link WHERE url=?';
    connection.query(selectSQL, [fullLink], function (err, rows, fields) {
      if (err) {
        console.log(err);
        connection.release();
        return res.status(400).json({ error: "Error fetching from database, please try again!" });
      }
      if (Array.isArray(rows) && rows.length > 0) {
        console.log("Found in database:" + rows[0].code);
        connection.release();
        return buildResponse(res, rows[0].code);
      } else {
        // if not present in database, generate and insert in database
        // base64 encode and take first 7 chars. add some randomness to generate a random code
        var str = Math.random().toString(36) + fullLink;
        var code = Buffer.from(str).toString('base64').substring(0, 7);
        console.log("Not found in database, generated code:" + code);
        // Insert into DB
        var insertSQL = 'INSERT INTO Link VALUES(? , ?)';
        connection.query(insertSQL, [code, fullLink], function (err, rows, fields) {
          connection.release();
          // TODO - retry if the code already exists
          if (err) {
            console.log(err);
            return res.status(400).json({ error: "Error inserting into database, please try again!" });
          }

          console.log("Inserted in database, updating cache and returning:" + code);
          // update cache and return
          client.set(code, fullLink);
          return buildResponse(res, code);
        });
      }
    });
  });
});

/* Generate redirect to the full URL */
router.get('/:code', function(req, res, next) {
  var code = req.params.code;
  console.log("Received a request with code:" + code);
  // Fetch from cache
  client.get(code, function(err, response) {
    if (response) {
      console.log("Found in cache:" + response);
      return res.redirect(response);
    }
    // get from database
    pool.getConnection(function(err, connection){
      var selectSQL = 'SELECT * FROM Link WHERE code=?';
      connection.query(selectSQL, [code], function (err, rows, fields) {
        connection.release();
        if (err) {
          console.log(err);
          return res.status(400).json({ error: "Error occured, please try again!" });
        }

        if (Array.isArray(rows) && rows.length > 0) {
          console.log("Found in database, updating cache and returning:" + rows[0].url);
          // update cache and return
          client.set(code, rows[0].url);
          return res.redirect(rows[0].url);
        } else {
          return res.status(404).json({ error: "No URL found!" });
        }
      });
    });

  });
});

function buildResponse(res, link) {
  shortenedLink = "http://localhost:3000/" + link;
  console.log('The shortened URL is: ', shortenedLink);
  
  return res.status(200).json({
    shortenedURL: shortenedLink
  });
}

module.exports = router;
