import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/airQualityDB";
const DATA_MODE = process.env.DATA_MODE || "simulated";
const OPEN_METEO_LATITUDE = process.env.OPEN_METEO_LATITUDE || "10.7905";
const OPEN_METEO_LONGITUDE = process.env.OPEN_METEO_LONGITUDE || "78.7047";
const LIVE_LOCATION = "Tiruchirappalli, Tamil Nadu";

app.use(cors());
app.use(express.json());

const sensorDataSchema = new mongoose.Schema({
  timestamp: { type: String, required: true },
  fullDate: { type: Date, required: true },
  aqi: { type: Number, default: null },
  pm25: { type: Number, default: null },
  pm10: { type: Number, default: null },
  temperature: { type: Number, default: null },
  humidity: { type: Number, default: null },
  co: { type: Number, default: null },
  no2: { type: Number, default: null },
  so2: { type: Number, default: null },
  o3: { type: Number, default: null },
  status: { type: String, required: true },
  source: { type: String, enum: ["simulated", "live_api", "sensor"], default: "simulated" },
  station: { type: String, default: null },
  location: { type: String, default: null },
});
const SensorData = mongoose.model("SensorData", sensorDataSchema);

const randomBetween = (min, max) => Math.random() * (max - min) + min;
const getStatus = (aqi) => {
  if (!Number.isFinite(aqi)) return "Unavailable";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
};

const getOptionalNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// --- FETCH 1 HOUR OF LIVE DATA (For auto-updates) ---
const fetchLiveReading = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const coordinates = `latitude=${OPEN_METEO_LATITUDE}&longitude=${OPEN_METEO_LONGITUDE}`;
    const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${coordinates}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=Asia%2FKolkata`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?${coordinates}&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FKolkata`;
    const [airResponse, weatherResponse] = await Promise.all([
      fetch(airQualityUrl, { signal: controller.signal }),
      fetch(weatherUrl, { signal: controller.signal }),
    ]);
    if (!airResponse.ok || !weatherResponse.ok) throw new Error("Open-Meteo request failed.");
    const [air, weather] = await Promise.all([airResponse.json(), weatherResponse.json()]);
    
    const rawTime = air.current?.time || weather.current?.time || new Date().toISOString();
    const fullDate = new Date(rawTime.endsWith("Z") || rawTime.includes("+") ? rawTime : rawTime + "+05:30");
    
    const aqiValue = getOptionalNumber(air.current?.us_aqi);
    const aqi = aqiValue === null ? null : Math.round(aqiValue);
    return {
      timestamp: fullDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }), fullDate, aqi,
      pm25: getOptionalNumber(air.current?.pm2_5), pm10: getOptionalNumber(air.current?.pm10),
      temperature: getOptionalNumber(weather.current?.temperature_2m), humidity: getOptionalNumber(weather.current?.relative_humidity_2m),
      co: getOptionalNumber(air.current?.carbon_monoxide), no2: getOptionalNumber(air.current?.nitrogen_dioxide),
      so2: getOptionalNumber(air.current?.sulphur_dioxide), o3: getOptionalNumber(air.current?.ozone),
      status: getStatus(aqi), source: "live_api", station: "Open-Meteo air-quality model", location: LIVE_LOCATION,
    };
  } finally { clearTimeout(timeout); }
};

// --- FETCH 24 HOURS OF HISTORICAL LIVE DATA ---
const seedLiveHistoricalData = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const coordinates = `latitude=${OPEN_METEO_LATITUDE}&longitude=${OPEN_METEO_LONGITUDE}`;
    const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${coordinates}&hourly=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&past_days=1&forecast_days=1&timezone=Asia%2FKolkata`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?${coordinates}&hourly=temperature_2m,relative_humidity_2m&past_days=1&forecast_days=1&timezone=Asia%2FKolkata`;
    
    const [airResponse, weatherResponse] = await Promise.all([
      fetch(airQualityUrl, { signal: controller.signal }),
      fetch(weatherUrl, { signal: controller.signal }),
    ]);
    
    if (!airResponse.ok || !weatherResponse.ok) throw new Error("Open-Meteo historical request failed.");
    const [air, weather] = await Promise.all([airResponse.json(), weatherResponse.json()]);
    
    const timeArray = air.hourly.time;
    const nowMs = Date.now();
    
    let currentIndex = timeArray.findIndex(t => new Date(t.endsWith("Z") || t.includes("+") ? t : t + "+05:30").getTime() > nowMs) - 1;
    if (currentIndex < 0) currentIndex = timeArray.length - 1;

    const dataToInsert = [];
    for (let i = 23; i >= 0; i--) {
      const idx = currentIndex - i;
      if (idx < 0) continue;
      
      const rawTime = air.hourly.time[idx];
      const fullDate = new Date(rawTime.endsWith("Z") || rawTime.includes("+") ? rawTime : rawTime + "+05:30");
      const aqiValue = getOptionalNumber(air.hourly.us_aqi[idx]);
      const aqi = aqiValue === null ? null : Math.round(aqiValue);
      
      dataToInsert.push({
        timestamp: fullDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
        fullDate,
        aqi,
        pm25: getOptionalNumber(air.hourly.pm2_5[idx]),
        pm10: getOptionalNumber(air.hourly.pm10[idx]),
        co: getOptionalNumber(air.hourly.carbon_monoxide[idx]),
        no2: getOptionalNumber(air.hourly.nitrogen_dioxide[idx]),
        so2: getOptionalNumber(air.hourly.sulphur_dioxide[idx]),
        o3: getOptionalNumber(air.hourly.ozone[idx]),
        temperature: getOptionalNumber(weather.hourly.temperature_2m[idx]),
        humidity: getOptionalNumber(weather.hourly.relative_humidity_2m[idx]),
        status: getStatus(aqi),
        source: "live_api",
        station: "Open-Meteo air-quality model",
        location: LIVE_LOCATION,
      });
    }
    
    await SensorData.deleteMany({});
    await SensorData.insertMany(dataToInsert);
    console.log("✅ Seeded 24 hours of REAL historical data from Open-Meteo.");
  } finally {
    clearTimeout(timeout);
  }
};

const initializeData = async () => {
  const existingData = await SensorData.findOne();

  if (DATA_MODE === "live_api") {
    if (!existingData || existingData.source === "simulated" || existingData.co === null) {
      console.log("Switching to live API mode: Fetching past 24 hours of real data...");
      await seedLiveHistoricalData();
    } else {
      console.log("Live API data already exists. Fetching latest reading to update...");
      const reading = await fetchLiveReading();
      
      const existingReading = await SensorData.findOne({ timestamp: reading.timestamp });
      if (existingReading) {
        await SensorData.updateOne({ _id: existingReading._id }, reading);
      } else {
        await SensorData.create(reading);
      }
    }
  } else if (DATA_MODE === "simulated") {
    if (!existingData || existingData.source === "live_api") {
       await SensorData.deleteMany({});
    }
  }
};

app.get("/", (req, res) => res.send("Air Quality Management API is running."));
app.get("/api/data", async (req, res) => {
  try { res.json(await SensorData.find().sort({ fullDate: 1 })); }
  catch (error) { res.status(500).json({ message: "Failed to fetch sensor data", error: error.message }); }
});

app.post("/api/refresh", async (req, res) => {
  try {
    if (DATA_MODE === "live_api") {
      await seedLiveHistoricalData();
      return res.json(await SensorData.find().sort({ fullDate: 1 }));
    }
    return res.status(400).json({ message: "Refresh logic requires live_api mode" });
  } catch (error) { return res.status(502).json({ message: "Failed to refresh air-quality data", error: error.message }); }
});

const AUTO_UPDATE_INTERVAL = process.env.AUTO_UPDATE_INTERVAL || 3600000;
const startAutoUpdate = () => {
  setInterval(async () => {
    try {
      if (DATA_MODE === "live_api") {
        const reading = await fetchLiveReading();
        
        const existingReading = await SensorData.findOne({ timestamp: reading.timestamp });
        if (existingReading) {
          await SensorData.updateOne({ _id: existingReading._id }, reading);
          console.log(`✅ Auto-update: Refreshed existing data for (${reading.timestamp})`);
        } else {
          await SensorData.create(reading);
          console.log(`✅ Auto-update: New live reading fetched (${reading.timestamp})`);
        }

        const staleReadings = await SensorData.find().sort({ fullDate: -1 }).skip(24).select("_id");
        if (staleReadings.length) await SensorData.deleteMany({ _id: { $in: staleReadings.map(({ _id }) => _id) } });
      }
    } catch (error) {
      console.error(`❌ Auto-update failed: ${error.message}`);
    }
  }, AUTO_UPDATE_INTERVAL);
};

mongoose.connect(MONGO_URI).then(async () => {
  console.log("MongoDB connected");
  await initializeData();
  startAutoUpdate();
  const intervalMs = AUTO_UPDATE_INTERVAL;
  const intervalMin = (intervalMs / 60000).toFixed(1);
  console.log(`⏱️ Auto-update interval set to ${intervalMin} minutes`);
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}).catch((error) => { console.error("Server startup error:", error.message); process.exit(1); });
