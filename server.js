'use strict';


require('dotenv').config();



//global constants
const PORT = process.env.PORT || 3000 ;
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

app.use('*', (request, response) => {
  response.send('Our server runs.');
})

//sql commands 
const SQL_CMDS = {};
SQL_CMDS.getLocation = 'SELECT * FROM locations WHERE search_query=$1'
SQL_CMDS.insertLocation = 'INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4)'
SQL_CMDS.getWeather = 'SELECT * FROM weathers WHERE location_id=$1'
SQL_CMDS.insertWeather = 'INSERT INTO weathers (forecast, time, location_id) VALUES ($1, $2, $3)'

//Constructor Functions
function LocationData(search_query, formatted_query, latitude, longitude){
  this.search_query = search_query;
  this.formatted_query = formatted_query;
  this.latitude = latitude;
  this.longitude = longitude;
}

function WeatherData(summary, time){
  this.forecast = summary;
  this.time = time;
}

//Other Functions
function searchLocationData(request, response) {

  //user input - ex: if they type in Seattle...search_quer = Seattle
  const search_query = request.query.data;
  client.query(SQL_CMDS.getLocation, [search_query]).then(result => {
    if(result.rows.length) {
      response.send(result.rows[0])
    } else {
      const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${search_query}&key=${process.env.GEOCODE_API_KEY}`;

      superagent.get(URL).then(result => {
        if(result.body.status === 'ZERO_RESULTS'){
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

    if(result.body.latitude === Number(request.query.data.latitude) && result.body.longitude === Number(request.query.data.longitude)){
      //dailyData = array of daily data objects
      let dailyData = result.body.daily.data;
      const dailyWeather = dailyData.map((dailyDataObj) => {
        let summary = dailyDataObj.summary;
        let time = new Date(dailyDataObj.time * 1000).toString().slice(0, 15) ;
  
        //For each entry within dailyData array
        //Create new weather object
        return new WeatherData(summary, time);
      });
      response.send(dailyWeather);
    }
  })
}

// TODO: insert meetups here //


// server start
app.listen(PORT, () => {
  console.log(`app is up on PORT ${PORT}`)
})
