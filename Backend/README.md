# Backend data modes

By default, the dashboard uses simulated IoT readings. To display current modelled conditions for Tiruchirappalli instead:

1. Copy `.env.example` to `.env`.
2. Set `DATA_MODE=live_api` and configure the latitude and longitude.
3. Start the backend with `npm start` from this folder.

In live mode, the refresh button fetches current conditions from Open-Meteo and the dashboard retains the 24 most recent observations it has collected. These are CAMS-modelled atmospheric conditions, not readings from a physical station. If a specific government station source is required, provide its approved API/access credentials and the backend adapter can be switched.
