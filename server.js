'use strict';

require('dotenv').config();

//global constants
const PORT = process.env.PORT || 3000;
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

//postgres client
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', error => console.error(error))

//server definition
const app = express();
app.use(cors());

//server is doing this
app.get('/location', searchLocationData);

app.get('/weather', searchWeatherData);

app.get('/movies', searchMovieData);

// Setting up all apps for a request response format (request, response)
app.use('*', (request, response) => {
  response.send('Our server runs.');
})

//sql commands
const SQL_CMDS = {};
SQL_CMDS.getLocation = 'SELECT * FROM locations WHERE search_query=$1'
// SQL_CMDS.getLocation = 'SELECT * FROM $1 WHERE search_query=$2'
SQL_CMDS.insertLocation = 'INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4)'
SQL_CMDS.getWeather = 'SELECT * FROM weathers WHERE location_id=$1'
SQL_CMDS.insertWeather = 'INSERT INTO weathers (forecast, time, location_id) VALUES ($1, $2, $3)'

//Constructor Functions
function LocationData(search_query, formatted_query, latitude, longitude) {
  this.search_query = search_query;
  this.formatted_query = formatted_query;
  this.latitude = latitude;
  this.longitude = longitude;
}

function WeatherData(summary, time) {
  this.forecast = summary;
  this.time = time;
}

function MovieData(info) {
  this.title = info.title;
  this.overview = info.overiew;
  this.average_votes = info.average_votes;
  this.total_votes = info.total_votes;
  // this.image_url = `https://image.tmdb.org/t/p/original${data.poster_path}`;
  this.popularity = info.popularity;
  this.released_on = info.released_on;
}

//Other Functions
function checkDatabase(search_query, response) {
//  return client.query(SQL_CMDS.getLocation, ['locations', search_query]).then(result => {
  return client.query(SQL_CMDS.getLocation, [search_query]).then(result => {
    if (result.rows.length) {
      console.log('DATABASE EXISTS');
      response.send(result.rows[0])
    } else {
      return 'NOT IN DATABASE';
    }
  });
}

function searchLocationData(request, response) {

  const search_query = request.query.data;
  checkDatabase(search_query, response).then(result => {
    if (result === 'NOT IN DATABASE') {

      const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${search_query}&key=${process.env.GEOCODE_API_KEY}`;

      superagent.get(URL).then(result => {
        console.log("asking google");
        if (result.body.status === 'ZERO_RESULTS') {
          response.status(500).send('Sorry, something went wrong');
          return;
        }
        const searchedResult = result.body.results[0];
        const formatted_query = searchedResult.formatted_address;

        const latitude = searchedResult.geometry.location.lat;
        const longitude = searchedResult.geometry.location.lng;
        const responseDataObject = new LocationData(search_query, formatted_query, latitude, longitude);

        client.query(SQL_CMDS.insertLocation, [responseDataObject.search_query, responseDataObject.formatted_query, responseDataObject.latitude, responseDataObject.longitude]);

        //Create new object containing user input data
        //responseDataObject = {Seattle, Lynnwood, WA, USA, somenumber, somenumber}

        response.send(responseDataObject);
      })
    }
  });
}

function searchWeatherData(request, response) {

  const URL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
  superagent.get(URL).then(result => {

    if (result.body.latitude === Number(request.query.data.latitude) && result.body.longitude === Number(request.query.data.longitude)) {
      //dailyData = array of daily data objects
      let dailyData = result.body.daily.data;
      const dailyWeather = dailyData.map(dailyDataObj => {
        let summary = dailyDataObj.summary;
        let time = new Date(dailyDataObj.time * 1000).toString().slice(0, 15);

        //For each entry within dailyData array
        //Create new weather object
        return new WeatherData(summary, time);
      });
      response.send(dailyWeather);
    }
  })
}

function searchMovieData(request, response){
  let city = request.formatted_query.split(',')[0];
  const URL = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${city}`;
  superagent.get(URL).then(result => {
    let movieInfo = result.body.data;
    const movieDisplay = movieInfo.map(movieOutput =>{
      let title = movieOutput.title;
      let overview = movieOutput.overview;
      let average_votes = movieOutput.average_votes;
      let total_votes = movieOutput.total_votes;
      // Insert image URL here
      let popularity = movieOutput.popularity;
      let released_on = movieOutput.released_on;
      return new MovieData(title, overview, average_votes, total_votes, popularity, released_on);
    });
    response.send(movieDisplay);
  })
 }

// server start
app.listen(PORT, () => {
  console.log(`app is up on PORT ${PORT}`)
})