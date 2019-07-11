'use strict';

// First initialize ENV configs
require('dotenv').config();

// NPM Packages
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');

// Global Variables
const PORT = process.env.PORT;

const app = express(); // Instantiate Express app
app.use(cors()); // Cross Origin support

// Server Express static files from public directory
app.use(express.static('public'));

// GET - user location input, display on map
// ---------------------------------------------
app.get('/location', returnLocation);

// GET - daily weather details from location
// ---------------------------------------------
app.get('/weather', returnWeather);

// GET - daily Event details from location
// ---------------------------------------------
app.get('/events', returnEvents);

// 404 - catch all paths that are not defined
// ---------------------------------------------
app.use('*', (request, response) => {
  response.status(404).send('Sorry, page not found');
});

// Location Constructor
function Location(search_query, formatted_query, latitude, longitude) {
  this.search_query = search_query;
  this.formatted_query = formatted_query;
  this.latitude = latitude;
  this.longitude = longitude;
}

// Location - get Geo JSON, create object via constructor, return object
// -----------------------------------------------------------------------

function returnLocation(request, response) {
  const locationName = request.query.data;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`
  superagent
    .get(url)
    .then(result => {
      const lat = result.body.results[0].geometry.location.lat;
      const lng = result.body.results[0].geometry.location.lng;
      const formatted_query = result.body.results[0].formatted_address;
      const search_query = locationName;
    
      response.status(200).send(new Location(search_query, formatted_query, lat, lng));
    })
    .catch(err => {
      console.error(err);
      response.status(500).send('Sorry, something went wrong.')
    });

};

//Weather Constructor
function Weather(forecast, time) {
  this.forecast = forecast;
  this.time = time;
}

// Weather - get Darksky JSON, create object via constructor, return object
// -------------------------------------------------------------------------
function returnWeather (request, response) {
  const lat = request.query.data.latitude;
  const lng = request.query.data.longitude;
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${lat},${lng}`;
  superagent
    .get(url)
    .then(result => {
      console.log(result.body.daily.data);
      const weather = result.body.daily.data.map(obj => {
        let forecast = obj.summary;
        let time = new Date(obj.time * 1000).toDateString();
        return new Weather(forecast, time);
      })
      response.status(200).send(weather);

    })
    .catch(err => {
      console.error(err);
      response.status(500).send('Sorry, something went wrong.');
    })
}

//Event Constructor
function Event(link, name, event_date, summary) {
  this.link = link;
  this.name = name;
  this.event_date = event_date;
  this.summary = summary;
}

// Constructor - get EventBrite JSON, create object via constructor, return object
// -------------------------------------------------------------------------
function returnEvents (request, response) {
  const lat = request.query.data.latitude;
  const lng = request.query.data.longitude;
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${lat}&location.longitude=${lng}&token=${process.env.EVENTBRITE_API_KEY}`;
  superagent
    .get(url)
    .then(result => {
      console.log(result.body.events[0]);
      const events = result.body.events.map(obj => {
        const link = obj.url;
        const name = obj.name.text;
        const date = new Date(obj.start.local).toDateString();
        const summary = obj.description.text;
        return new Event(link, name, date, summary);
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

