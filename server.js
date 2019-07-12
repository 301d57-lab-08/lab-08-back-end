'use strict';

// Initialize ENV configs
require('dotenv').config();

// NPM Packages
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

// Global Variables
const PORT = process.env.PORT;

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

const app = express(); // Instantiate Express app
app.use(cors()); // Cross Origin support

// Server Express static files from public directory
app.use(express.static('public'));

// Routes
// ---------------------------------------------
app.get('/location', getLocation); // user location input, display on map
app.get('/weather', getWeather); //daily weather details from location
app.get('/events', getEvents); // daily Event details from location

// 404 - catch all paths that are not defined
// ---------------------------------------------
app.use('*', (request, response) => {
  response.status(404).send('Sorry, page not found');
});






const SQL_INSERTS = {
  locations: `INSERT INTO locations(
    latitude,
    longitude,
    search_query,
    formatted_query
    
  ) VALUES($1, $2, $3, $4) RETURNING *`,

  weathers: `INSERT INTO weathers (
    forecast,
    time,
    location_id
  ) VALUES ($1, $2, $3) RETURNING *`
};




// Object Constructors
// *********************************

// Location Constructor
function Location(locationName, result) {
  this.search_query = locationName;
  this.formatted_query = result.body.results[0].formatted_address;
  this.latitude = result.body.results[0].geometry.location.lat;
  this.longitude = result.body.results[0].geometry.location.lng;
}

//Weather Constructor
function Weather(result) {
  this.time = new Date(result.time * 1000).toDateString();
  this.forecast = result.summary;
}




function getLocation(request, response) {
  const locationName = request.query.data;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`;

  // Check to see if the query is already in the db
  return client.query(`SELECT * FROM locations WHERE search_query = $1`, [locationName])
    .then(sqlResult => {

      // If NOT in the db
      if (sqlResult.rowCount === 0) {
        console.log('New data from Google API');

        return superagent
          .get(url)
          .then(result => {
            const location = new Location(locationName, result);

            return client.query(`INSERT INTO locations (
              search_query,
              formatted_query,
              latitude,
              longitude
            ) VALUES ($1, $2, $3, $4) RETURNING *`,
            [location.search_query, location.formatted_query, location.latitude, location.longitude])
              .then(result => {
                response.status(200).send(result.rows[0]);
              })
              .catch(err => {
                console.error(err);
              });
          })
          .catch(err => {
            console.error(err);
            response.status(500).send('Sorry, something went wrong.')
          });
      } else {
        console.log('Sending data from DB');
        response.send(sqlResult.rows[0]);
      }
    })
}






function getWeather(request, response) {
  const locationId = parseInt(request.query.data.id);
  const lat = request.query.data.latitude;
  const lng = request.query.data.longitude;
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${lat},${lng}`;

  return client.query(`SELECT * FROM weathers WHERE location_id = $1`, [locationId])
    .then(sqlResult => {
      // If doesn't exist insert into DB after API request
      if (sqlResult.rowCount === 0) {
        return superagent
          .get(url)
          .then(result => {

            let promises = result.body.daily.data.map(obj => {
              const day = new Weather(obj);

              return client.query(`INSERT INTO weathers (
                forecast,
                time,
                location_id
              ) VALUES ($1, $2, $3) RETURNING *`,
              [day.forecast, day.time, locationId])
                .then(result => {
                  return result.rows[0];
                });
            });

            return promises;
          })
          .then(results => {
            return Promise.all(results)
              .then(result => {
                response.status(200).send(result);
              });
          })
          .catch(err => {
            console.error(err);
            response.status(500).send('Sorry, something went wrong.');
          });
      }
      else {
        response.status(200).send(sqlResult.rows);
      }
    })
}

//Event Constructor
function Event(result) {
  this.link = result.url;
  this.name = result.name.text;
  this.event_date = new Date(result.start.local).toDateString();
  this.summary = result.description.text;
}

// Constructor - get EventBrite JSON, create object via constructor, return object
// -------------------------------------------------------------------------
function getEvents(request, response) {
  const lat = request.query.data.latitude;
  const lng = request.query.data.longitude;
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${lat}&location.longitude=${lng}&token=${process.env.EVENTBRITE_API_KEY}`;

  superagent
    .get(url)
    .then(result => {
      const events = result.body.events.map(obj => {
        return new Event(obj);
      })

      response.status(200).send(events);
    })
    .catch(err => {
      console.error(err);
      response.status(500).send('Sorry, something went wrong.');
    })
}











// Start the server!!!
// --------------------
app.listen(PORT, () => {
  console.log(`Listening on PORT:${PORT}`);
});

