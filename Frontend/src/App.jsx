import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Wind,
  Database,
  RefreshCw,
  Gauge,
  CloudFog,
  Thermometer,
  Droplets,
  Info,
  AlertTriangle,
  Clock,
  Radio,
  Cpu,
  Server,
  LayoutDashboard,
  ArrowRight,
  Globe,
  FlaskConical,
} from "lucide-react";

// ============================================================
// Config & static content
// ============================================================

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// AQI status -> Tailwind classes. Colors follow the standard
// green/yellow/red air-quality convention on purpose.
const STATUS_STYLES = {
  Good: {
    card: "bg-green-500 text-white",
    badge: "bg-green-100 text-green-700",
  },
  Moderate: {
    card: "bg-yellow-500 text-gray-900",
    badge: "bg-yellow-100 text-yellow-700",
  },
  "Unhealthy for Sensitive Groups": {
    card: "bg-orange-500 text-white",
    badge: "bg-orange-100 text-orange-700",
  },
  Unhealthy: {
    card: "bg-red-500 text-white",
    badge: "bg-red-100 text-red-700",
  },
  "Very Unhealthy": {
    card: "bg-purple-600 text-white",
    badge: "bg-purple-100 text-purple-700",
  },
  Hazardous: {
    card: "bg-rose-900 text-white",
    badge: "bg-rose-100 text-rose-800",
  },
};
const DEFAULT_STATUS_STYLE = {
  card: "bg-gray-500 text-white",
  badge: "bg-gray-100 text-gray-600",
};


const SOURCE_META = {
  simulated: {
    icon: FlaskConical,
    label: "Simulated Data",
    short: "Simulated",
    badge: "bg-gray-100 text-gray-600",
  },
  live_api: {
    icon: Globe,
    label: "Live Conditions (Open-Meteo)",
    short: "Live API",
    badge: "bg-cyan-100 text-cyan-700",
  },
  sensor: {
    icon: Radio,
    label: "Live Sensor Data",
    short: "Sensor",
    badge: "bg-emerald-100 text-emerald-700",
  },
};
const DEFAULT_SOURCE_META = SOURCE_META.simulated;

// MERN + IoT data flow, used in the educational section
const ARCHITECTURE_STEPS = [
  {
    icon: Radio,
    title: "Sensors",
    desc: "PMS5003 & DHT22 collect raw PM, temperature & humidity readings — simulated for now, or pulled from an official air-quality API until the hardware is wired up.",
  },
  {
    icon: Cpu,
    title: "Edge Processing",
    desc: "ESP32 reads the sensors over UART/GPIO and packages readings into JSON payloads.",
  },
  {
    icon: Server,
    title: "Node/Express + MongoDB",
    desc: "The Express REST API validates each payload and persists it to MongoDB.",
  },
  {
    icon: LayoutDashboard,
    title: "React Dashboard",
    desc: "React fetches readings over Axios and renders live charts with Recharts.",
  },
];

// Specs for the (simulated) hardware this project stands in for
const HARDWARE_SPECS = [
  {
    component: "PMS5003",
    role: "Laser particulate matter sensor",
    measures: "PM1.0, PM2.5, PM10 (0–500 µg/m³)",
    interface: "UART (Serial)",
  },
  {
    component: "DHT22",
    role: "Digital temperature & humidity sensor",
    measures: "-40°C to 80°C, 0-100% RH",
    interface: "Single-wire digital",
  },
  {
    component: "ESP32",
    role: "Microcontroller / Wi-Fi module",
    measures: "Reads sensors, sends data over HTTP",
    interface: "Wi-Fi, GPIO, I2C, UART",
  },
];

// ============================================================
// Small reusable pieces
// ============================================================

function StatCard({ icon: Icon, iconColor, value, label }) {
  const formattedValue = String(value).replace(/^null/, "—");
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
      <Icon className={`w-6 h-6 ${iconColor} mb-3`} />
      <p className="text-3xl font-bold text-gray-900 tabular-nums">{formattedValue}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function ChartCard({ icon: Icon, iconColor, title, children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 min-w-0 ${className}`}
    >
      <h2 className="text-sm sm:text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} /> {title}
      </h2>
      {children}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 13,
};
const displayValue = (value) =>
  value === null || value === undefined ? "—" : value;

// ============================================================
// Main App
// ============================================================

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/data`);
      setData(res.data);
      setConnected(true);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch sensor data:", err);
      setConnected(false);
      setError(
        "Could not reach the backend API. Make sure the Express server is running and MongoDB is connected."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestTimer = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(requestTimer);
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await axios.post(`${API_URL}/refresh`);
      setData(res.data);
      setConnected(true);
      setError(null);
    } catch (err) {
      console.error("Failed to refresh sensor data:", err);
      setConnected(false);
      setError(
        "Failed to regenerate data. Check that the backend server is running."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const recentReadings = [...data].slice(-8).reverse();
  const latestStyle = latest
    ? STATUS_STYLES[latest.status] || DEFAULT_STATUS_STYLE
    : DEFAULT_STATUS_STYLE;
  const sourceMeta = latest
    ? SOURCE_META[latest.source] || DEFAULT_SOURCE_META
    : DEFAULT_SOURCE_META;

  const refreshLabel =
    latest?.source === "live_api"
      ? "Fetch Latest Live Reading"
      : latest?.source === "sensor"
        ? "Refresh"
        : "Regenerate Database Data";
  const refreshingLabel =
    latest?.source === "live_api"
      ? "Fetching..."
      : latest?.source === "sensor"
        ? "Refreshing..."
        : "Regenerating...";

  // ---- Initial loading state ----
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-9 h-9 text-cyan-600 animate-spin motion-reduce:animate-none mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Connecting to Air Quality API...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* ---------------- Header ---------------- */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-600 flex items-center justify-center shadow-sm shrink-0">
              <Wind className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 leading-tight break-words">
                Air Quality Management Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                IoT-Based Environmental Monitoring System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 sm:px-4 py-2 shadow-sm w-fit max-w-full">
            <span className="relative flex h-2.5 w-2.5">
              {connected && (
                <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  connected ? "bg-green-500" : "bg-red-500"
                }`}
              />
            </span>
            <Database className="w-4 h-4 text-gray-500" />
            <span className="text-xs sm:text-sm font-medium text-gray-700">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </header>

        {/* ---------------- Error banner ---------------- */}
        {error && (
          <div className="mb-5 sm:mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 sm:p-4">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* ---------------- Action bar ---------------- */}
        <div className="flex flex-col gap-3 mb-5 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
            <p className="text-xs sm:text-sm text-gray-500 flex items-start sm:items-center gap-1.5 leading-5">
              <Clock className="w-4 h-4" />
              {latest ? `Last reading: ${latest.timestamp}` : "No data yet"}
            </p>
            {latest && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sourceMeta.badge}`}
                title="Where this reading actually came from"
              >
                <sourceMeta.icon className="w-3.5 h-3.5" />
                {sourceMeta.label}
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-medium px-3.5 sm:px-4 py-2.5 rounded-lg shadow-sm transition-colors w-full sm:w-fit focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            {refreshing ? refreshingLabel : refreshLabel}
          </button>
        </div>

        {/* ---------------- Summary cards ---------------- */}
        {latest && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4 mb-5 sm:mb-6">
            <div
              className={`rounded-2xl p-4 sm:p-5 shadow-sm col-span-2 sm:col-span-1 ${latestStyle.card}`}
            >
              <div className="flex items-center justify-between mb-3">
                <Gauge className="w-6 h-6 opacity-90" />
                <span className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  {latest.status}
                </span>
              </div>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums">{displayValue(latest.aqi)}</p>
              <p className="text-xs opacity-90 mt-1">Air Quality Index</p>
            </div>

            <StatCard icon={CloudFog} iconColor="text-orange-500" value={displayValue(latest.pm25)} label="PM2.5 (µg/m³)" />
            <StatCard icon={Wind} iconColor="text-violet-500" value={displayValue(latest.pm10)} label="PM10 (µg/m³)" />
            <StatCard icon={Thermometer} iconColor="text-red-500" value={`${latest.temperature}°C`} label="Temperature" />
            <StatCard icon={Droplets} iconColor="text-sky-500" value={`${latest.humidity}%`} label="Humidity" />
            <StatCard icon={Wind} iconColor="text-teal-500" value={displayValue(latest.co)} label="CO" />
            <StatCard icon={CloudFog} iconColor="text-amber-500" value={displayValue(latest.no2)} label="NO₂" />
            <StatCard icon={CloudFog} iconColor="text-yellow-600" value={displayValue(latest.so2)} label="SO₂" />
            <StatCard icon={Wind} iconColor="text-blue-500" value={displayValue(latest.o3)} label="O₃" />
          </div>
        )}

        {/* ---------------- Charts ---------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <ChartCard
            icon={Gauge}
            iconColor="text-cyan-600"
            title="AQI Trend (24 Hours)"
            className="lg:col-span-2"
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="aqi"
                  stroke="#0891b2"
                  strokeWidth={2.5}
                  dot={false}
                  name="AQI"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            icon={CloudFog}
            iconColor="text-orange-500"
            title="PM2.5 vs PM10 Concentration"
          >
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  interval={2}
                />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="pm25" fill="#f97316" name="PM2.5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pm10" fill="#8b5cf6" name="PM10" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            icon={Thermometer}
            iconColor="text-red-500"
            title="Temperature & Humidity"
          >
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  interval={2}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.15}
                  name="Temp (°C)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidity"
                  stroke="#0ea5e9"
                  fill="#0ea5e9"
                  fillOpacity={0.15}
                  name="Humidity (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ================= NEW GAS CONCENTRATIONS CHART ================= */}
          <ChartCard
            icon={Wind}
            iconColor="text-teal-500"
            title="Gas Concentrations (CO, NO₂, SO₂, O₃)"
            className="lg:col-span-2"
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  interval={1}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="co"
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                  dot={false}
                  name="CO"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="no2"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  name="NO₂"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="so2"
                  stroke="#ca8a04"
                  strokeWidth={2.5}
                  dot={false}
                  name="SO₂"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="o3"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  name="O₃"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ---------------- Data table ---------------- */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-sm sm:text-base font-semibold text-gray-800 mb-4">
            Recent Sensor Readings
          </h2>

          {/* Mobile reading cards */}
          <div className="sm:hidden space-y-3">
            {recentReadings.map((row) => {
              const rowStyle = STATUS_STYLES[row.status] || DEFAULT_STATUS_STYLE;
              const rowSourceMeta = SOURCE_META[row.source] || DEFAULT_SOURCE_META;
              return (
                <article key={row._id} className="border border-gray-100 rounded-xl p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-400">Time</p>
                      <p className="text-sm font-semibold text-gray-700 tabular-nums">{row.timestamp}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rowStyle.badge}`}>
                      {row.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">AQI</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.aqi)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">PM2.5</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.pm25)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">PM10</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.pm10)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">Temp</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.temperature)}°C</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">Humidity</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.humidity)}%</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">CO</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.co)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">NO₂</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.no2)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">SO₂</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.so2)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">O₃</span>
                      <span className="font-semibold text-gray-700">{displayValue(row.o3)}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 block">Source</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${rowSourceMeta.badge} px-2 py-0.5 rounded-full mt-0.5`}>
                        <rowSourceMeta.icon className="w-3 h-3" />
                        {rowSourceMeta.short}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
            {recentReadings.length === 0 && (
              <p className="py-6 text-center text-gray-400 text-sm">
                No readings yet — try Regenerate Database Data above.
              </p>
            )}
          </div>

          {/* Desktop/tablet table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm text-left">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">AQI</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">PM2.5</th>
                  <th className="py-2 pr-4">PM10</th>
                  <th className="py-2 pr-4">Temp (°C)</th>
                  <th className="py-2 pr-4">Humidity (%)</th>
                  <th className="py-2 pr-4">CO</th>
                  <th className="py-2 pr-4">NO₂</th>
                  <th className="py-2 pr-4">SO₂</th>
                  <th className="py-2 pr-4">O₃</th>
                  <th className="py-2 pr-4">Source</th>
                </tr>
              </thead>
              <tbody>
                {recentReadings.map((row) => {
                  const rowStyle = STATUS_STYLES[row.status] || DEFAULT_STATUS_STYLE;
                  const rowSourceMeta = SOURCE_META[row.source] || DEFAULT_SOURCE_META;
                  return (
                    <tr
                      key={row._id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                    >
                      <td className="py-2.5 pr-4 font-medium text-gray-700 tabular-nums">{row.timestamp}</td>
                      <td className="py-2.5 pr-4 text-gray-700 tabular-nums">{displayValue(row.aqi)}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rowStyle.badge}`}>{row.status}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums">{displayValue(row.pm25)}</td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums">{displayValue(row.pm10)}</td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums">{displayValue(row.temperature)}</td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums">{displayValue(row.humidity)}</td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums">{displayValue(row.co)}</td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums">{displayValue(row.no2)}</td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums">{displayValue(row.so2)}</td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums">{displayValue(row.o3)}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${rowSourceMeta.badge}`}>
                          <rowSourceMeta.icon className="w-3 h-3" />
                          {rowSourceMeta.short}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {recentReadings.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-6 text-center text-gray-400">
                      No readings yet — try Regenerate Database Data above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------- Footer ---------------- */}
        <footer className="text-center text-xs text-gray-400 pb-4">
          Made with <span className="text-red-500">♥</span> by{" AJAY KRISHNAN R"}
        </footer>
      </div>
    </div>
  );
}

export default App;