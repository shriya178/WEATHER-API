Weather API

A responsive Weather App built using HTML, CSS, and JavaScript with the Open-Meteo API.

About the Project

This project displays weather information for different locations. Users can search for cities, view current weather details, check conditions, and see a 7-day forecast.

Features

Search for different cities

City suggestions while searching

Current weather information

Local time display

High and low temperature

7-day weather forecast

Humidity information

Wind speed and direction

Pressure

UV index

Chance of rain

Visibility

Sunrise and sunset

Celsius and Fahrenheit support

Save places using the star button

Saved places stored in localStorage

Get weather using the user's current location

Light and dark theme

Refresh weather data

Automatic weather refresh every 10 minutes

Technologies Used

HTML5

CSS3

JavaScript

Open-Meteo API

Local Storage API

Browser Geolocation API

How It Works

The user searches for a city.

The Open-Meteo Geocoding API finds the city and provides its latitude and longitude.

These coordinates are sent to the Open-Meteo Weather API.

The API returns current, hourly, and daily weather data.

JavaScript processes the response and displays the information on the webpage.

API Used

Open-Meteo

Weather data:
https://api.open-meteo.com/v1/forecast

Geocoding:
https://geocoding-api.open-meteo.com/v1/search

Project Structure

Weather-API/
│
├── index.html
├── style.css
├── script.js
└── README.md

File names can be changed according to the actual files used in the project.

How to Run the Project

Download or clone the project.

Open the project folder in VS Code.

Open index.html in a browser, or run it using Live Server.

Search for a city and view its weather information.

Video Explanation

Video Explanation

[Watch the Video Explanation](https://drive.google.com/file/d/1oA3ypTNcDX5K3BkUt5Wet3EIK0dkwMbH/view?usp=sharing)

Learning Outcome

Learning Outcome

Through this project, I understood how an API works with a website and how API data can be fetched, processed, and displayed using JavaScript.

I also practiced using local storage, browser geolocation, event handling, dynamic DOM updates, and responsive web design.

Author

Shriya Patel
