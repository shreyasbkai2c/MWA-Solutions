import { useState, useEffect, useRef } from "react";
import {
  Truck, Users, Package, Zap, CheckCircle, AlertTriangle,
  ChevronRight, MapPin, BarChart2, Settings, ThumbsUp, ThumbsDown,
  Brain, Sparkles, Clock, Leaf, Navigation, Database, Cpu,
  TrendingUp, Box, AlertCircle, ChevronDown, Play, ArrowRight,
  Activity, Server, GitBranch, Layers
} from "lucide-react";
import {
  LineChart, AreaChart, XAxis, YAxis, Tooltip, Legend,
  Line, Area, ResponsiveContainer, CartesianGrid,
  ReferenceLine, ReferenceArea
} from "recharts";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const ORDERS = [
  { id: "#101", location: "Lünen Depot", x: 18, y: 22, lat: 51.62, lng: 7.52 },
  { id: "#102", location: "Dortmund-Nord", x: 42, y: 18, lat: 51.54, lng: 7.46 },
  { id: "#103", location: "Brechten Hub", x: 65, y: 28, lat: 51.57, lng: 7.50 },
  { id: "#104", location: "Ewing Station", x: 30, y: 45, lat: 51.51, lng: 7.44 },
  { id: "#105", location: "Waldorf Logistics", x: 75, y: 50, lat: 51.55, lng: 7.55 },
  { id: "#106", location: "Kevinhausen Stop", x: 50, y: 65, lat: 51.49, lng: 7.48 },
  { id: "#107", location: "Remondis Gate", x: 20, y: 72, lat: 51.47, lng: 7.43 },
  { id: "#108", location: "Westfalenpark Drop", x: 68, y: 75, lat: 51.48, lng: 7.53 },
  { id: "#109", location: "Brechten Depot", x: 85, y: 35, lat: 51.58, lng: 7.57 },
  { id: "#110", location: "Lünen-Süd Terminal", x: 12, y: 55, lat: 51.60, lng: 7.49 },
];

const EARLY_TOUR = [
  { id: "#101", location: "Lünen Depot", arrival: "06:15", duration: 25, overflow: false },
  { id: "#102", location: "Dortmund-Nord", arrival: "07:05", duration: 20, overflow: false },
  { id: "#103", location: "Brechten Hub", arrival: "07:52", duration: 30, overflow: false },
  { id: "#104", location: "Ewing Station", arrival: "08:45", duration: 15, overflow: false },
  { id: "#105", location: "Waldorf Logistics", arrival: "09:20", duration: 35, overflow: false },
  { id: "#106", location: "Kevinhausen Stop", arrival: "10:30", duration: 20, overflow: false },
  { id: "#107", location: "Remondis Gate", arrival: "11:15", duration: 25, overflow: false },
  { id: "#108", location: "Westfalenpark Drop", arrival: "12:10", duration: 20, overflow: false },
  { id: "#109", location: "Brechten Depot", arrival: "14:14", duration: 30, overflow: true },
];

const LATE_TOUR = [
  { id: "#102", location: "Dortmund-Nord", arrival: "14:10", duration: 20, overflow: false },
  { id: "#105", location: "Waldorf Logistics", arrival: "15:00", duration: 35, overflow: false },
  { id: "#106", location: "Kevinhausen Stop", arrival: "16:15", duration: 20, overflow: false },
  { id: "#103", location: "Brechten Hub", arrival: "17:00", duration: 30, overflow: false },
  { id: "#108", location: "Westfalenpark Drop", arrival: "18:05", duration: 20, overflow: false },
  { id: "#101", location: "Lünen Depot", arrival: "19:00", duration: 25, overflow: false },
  { id: "#107", location: "Remondis Gate", arrival: "20:10", duration: 25, overflow: false },
  { id: "#110", location: "Lünen-Süd Terminal", arrival: "21:48", duration: 20, overflow: true },
];

// Per-order service durations (minutes)
const ORDER_SERVICE_DURATIONS = {
  "#101": 25, "#102": 20, "#103": 30, "#104": 15,
  "#105": 35, "#106": 20, "#107": 25, "#108": 20,
  "#109": 30, "#110": 18,
};

// Build a tour dynamically from selected order IDs using nearest-neighbour TSP.
// When > 5 orders are selected, the effective shift window is compressed to
// simulate real-world capacity constraints (time-window conflicts at client sites,
// loading/unloading queues), guaranteeing visible overflow on the last stop(s).
function buildTourFromSelection(selectedIds, shiftProfile) {
  if (selectedIds.length === 0) return [];
  const shiftStart = shiftProfile === "early" ? 6 * 60 : 14 * 60;
  const nominalEnd = shiftProfile === "early" ? 14 * 60 : 22 * 60;

  // Compress window by 28 min per order beyond 5 to force overflow
  const overCapacity = Math.max(0, selectedIds.length - 5);
  const shiftEnd = nominalEnd - overCapacity * 28;

  const orderMap = Object.fromEntries(ORDERS.map(o => [o.id, o]));
  const selected = selectedIds.map(id => orderMap[id]).filter(Boolean);

  // Nearest-neighbour route from virtual depot
  const depot = { x: 0, y: 50 };
  const unvisited = [...selected];
  const sorted = [];
  let current = depot;
  while (unvisited.length > 0) {
    let minDist = Infinity, nearestIdx = 0;
    unvisited.forEach((o, i) => {
      const d = Math.hypot(o.x - current.x, o.y - current.y);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    });
    sorted.push(unvisited[nearestIdx]);
    current = unvisited[nearestIdx];
    unvisited.splice(nearestIdx, 1);
  }

  let currentTime = shiftStart;
  let prevPos = depot;
  return sorted.map((order, index) => {
    const duration = ORDER_SERVICE_DURATIONS[order.id] ?? 20;
    const dist = Math.hypot(order.x - prevPos.x, order.y - prevPos.y);
    const travel = Math.max(8, Math.round(dist * 0.45));
    currentTime += travel;

    // For 6+ order selections: force stops from position 5 onwards past the nominal
    // shift end to simulate time-window conflicts and loading queue delays.
    if (overCapacity > 0 && index >= 5 && currentTime < nominalEnd) {
      currentTime = nominalEnd + (index - 4) * 18; // 18 min past cutoff per extra stop
    }

    const h = Math.floor(currentTime / 60);
    const m = currentTime % 60;
    const arrival = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const overflow = currentTime > nominalEnd;
    prevPos = order;
    currentTime += duration;
    return { id: order.id, location: order.location, arrival, duration, overflow };
  });
}

// Compute savings figures that scale with the number of selected orders
function computeSavings(count) {
  return {
    co2: (count * 1.55).toFixed(1),
    time: count * 5 + Math.floor(count / 3) * 4,
  };
}

// Generate a contextual AI rationale as structured bullet points
// Returns: { status: "ok"|"overflow", bullets: [{ type, text }] }
function buildAIRationale(selectedIds, shiftProfile, tourResult) {
  if (!tourResult || tourResult.length === 0) return null;

  const shiftLabel = shiftProfile === "early" ? "Early Shift (06:00–14:00)" : "Late Shift (14:00–22:00)";
  const shiftEnd = shiftProfile === "early" ? "14:00" : "22:00";
  const nextShift = shiftProfile === "early" ? "Late Shift (14:00)" : "Early Shift tomorrow (06:00)";
  const overflows = tourResult.filter(o => o.overflow);
  const normals = tourResult.filter(o => !o.overflow);
  const overCapacity = Math.max(0, selectedIds.length - 5);
  const orderMap = Object.fromEntries(ORDERS.map(o => [o.id, o]));
  const totalService = tourResult.reduce((s, o) => s + o.duration, 0);

  // Geographic clusters
  const west = tourResult.filter(o => (orderMap[o.id]?.x ?? 50) < 40).map(o => o.id);
  const central = tourResult.filter(o => { const x = orderMap[o.id]?.x ?? 50; return x >= 40 && x <= 65; }).map(o => o.id);
  const east = tourResult.filter(o => (orderMap[o.id]?.x ?? 50) > 65).map(o => o.id);
  const zones = [west.length && `${west.join(", ")} (west)`, central.length && `${central.join(", ")} (central)`, east.length && `${east.join(", ")} (east)`].filter(Boolean);

  const firstStop = tourResult[0];
  const lastNormal = normals[normals.length - 1];
  const bullets = [];

  // ── Routing logic ──
  bullets.push({ type: "info", text: `Nearest-neighbour algorithm applied to ${selectedIds.length} orders, starting from depot — minimises total travel distance.` });

  // ── Geography ──
  if (zones.length > 1) {
    bullets.push({ type: "info", text: `Orders span ${zones.length} geographic zones: ${zones.join("; ")}. Stops grouped by proximity to eliminate backtracking.` });
  } else {
    bullets.push({ type: "info", text: `All orders concentrated in the ${zones[0] || "same zone"} — compact, low-mileage route.` });
  }

  // ── Sequence start ──
  bullets.push({ type: "info", text: `Route begins at ${firstStop.location} (ETA ${firstStop.arrival}) · Total service time: ${totalService} min across ${selectedIds.length} stops.` });

  if (overflows.length === 0) {
    // ── All fit ──
    bullets.push({ type: "ok", text: `All ${tourResult.length} stops completed by ${lastNormal?.arrival ?? shiftEnd} — within the ${shiftEnd} shift cutoff. No reallocation needed.` });
  } else {
    // ── Overflow reasons ──
    const overflowIds = overflows.map(o => o.id).join(", ");
    bullets.push({ type: "warn", text: `${selectedIds.length} orders exceed single-vehicle capacity for the ${shiftLabel} — cumulative service + transit time surpasses the ${shiftEnd} cutoff.` });
    bullets.push({ type: "warn", text: `${overflows.length === 1 ? "Order" : "Orders"} ${overflowIds} cannot be reached in time — ${overflows.map(o => `${o.id} ETA ${o.arrival}`).join(", ")} (after shift end).` });

    if (overCapacity >= 3) {
      bullets.push({ type: "action", text: `Recommendation: Split into 2 tours — assign first ${normals.length} stops to this shift, create a new tour for ${overflowIds}.` });
    } else {
      bullets.push({ type: "action", text: `Recommendation: Reassign ${overflowIds} to the next available ${nextShift}.` });
    }
    bullets.push({ type: "action", text: `Alternative: Reduce selection to 5 or fewer orders to fit all stops within a single shift.` });
  }

  return { status: overflows.length > 0 ? "overflow" : "ok", bullets };
}

const AI_STEPS_TOUR = [
  { label: "Data Agent", desc: "Fetching orders and historical routes...", duration: 800 },
  { label: "Pattern Recognition Agent", desc: "Analyzing past 6 months of tour data...", duration: 1000 },
  { label: "Model Selection Agent", desc: "Selecting best-fit optimization model...", duration: 800 },
  { label: "Optimization Agent", desc: "Computing optimal sequence...", duration: 1200 },
  { label: "Recommendation Agent", desc: "Generating final plan...", duration: 600 },
];

const AI_STEPS_SHORT = [
  { label: "Data Agent", desc: "Fetching historical tour data and sales trends...", duration: 900 },
  { label: "Pattern Recognition Agent", desc: "Detecting seasonal and weekly patterns...", duration: 1100 },
  { label: "Forecasting Model", desc: "Generating predictions and recommendations...", duration: 1000 },
];

// Generate 30-day order volume mock data
function generateOrderVolume(from) {
  const data = [];
  const base = new Date(from || "2026-03-16");
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < 30; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const weekTrend = Math.floor(i / 7) * 8;
    const volume = isWeekend
      ? Math.round(20 + Math.random() * 10)
      : Math.round(85 + weekTrend + Math.random() * 15);
    data.push({
      date: `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`,
      orders: volume,
      lower: Math.round(volume * 0.87),
      upper: Math.round(volume * 1.13),
      isWeekend,
      dayLabel: DAY_LABELS[dow],
    });
  }
  return data;
}

// Generate container forecast data
function generateContainerForecast(days) {
  const data = [];
  const base = new Date("2026-03-16");
  for (let i = 0; i < Math.min(days, 60); i += Math.ceil(days / 20)) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const need = Math.round(600 + i * 8 + Math.random() * 40);
    const stock = Math.round(820 - i * 3 + Math.random() * 20);
    data.push({
      date: `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`,
      "Forecasted Need": need,
      "Need Upper": Math.round(need * 1.1),
      "Need Lower": Math.round(need * 0.9),
      "Current Stock": stock,
    });
  }
  return data;
}

// ─── ARCHITECTURE NODES ───────────────────────────────────────────────────────

const ARCH_NODES = {
  // Tour Planning (blue)
  tp_src: { label: "Logistocard\n(Orders)", icon: Database, color: "blue", pipeline: "tour", x: 20, y: 60, desc: "The source system for all incoming transport orders. Logistocard feeds structured order data — pickup locations, time windows, cargo type — into the AI pipeline in real time.", tech: ["REST API", "PostgreSQL"], input: "Manual order entry, EDI feeds", output: "Structured order objects with metadata" },
  tp_da: { label: "Data Agent", icon: Cpu, color: "blue", pipeline: "tour", x: 160, y: 60, desc: "Fetches and normalizes order data alongside historical route performance. Enriches each order with geocoded coordinates and past delivery statistics from the vector store.", tech: ["FastAPI", "PostgreSQL + pgvector"], input: "Raw orders from Logistocard", output: "Enriched, normalized order dataset" },
  tp_pr: { label: "Pattern Recognition\nAgent", icon: Brain, color: "blue", pipeline: "tour", x: 300, y: 60, desc: "Uses a fine-tuned small language model to identify seasonal, time-of-day, and location-specific patterns from 6+ months of tour history. Flags anomalies and high-risk stops.", tech: ["Small Language Model", "scikit-learn"], input: "Historical tour records, current orders", output: "Pattern embeddings + risk flags" },
  tp_ms: { label: "Model Selection\nAgent", icon: GitBranch, color: "blue", pipeline: "tour", x: 440, y: 60, desc: "Dynamically selects the optimal routing algorithm based on order count, geographic spread, and time constraints. Chooses between VRP solvers or ML-based heuristics.", tech: ["CrewAI", "OR-Tools"], input: "Pattern embeddings + order profile", output: "Selected model + configuration" },
  tp_opt: { label: "Optimization Agent", icon: Zap, color: "blue", pipeline: "tour", x: 580, y: 60, desc: "Executes the selected optimization model to produce the minimum-distance, constraint-satisfying tour sequence. Respects time windows, vehicle capacity, and driver shift limits.", tech: ["OR-Tools", "XGBoost"], input: "Normalized orders + model config", output: "Optimal stop sequence with ETAs" },
  tp_rec: { label: "Recommendation\nAgent", icon: Sparkles, color: "blue", pipeline: "tour", x: 720, y: 60, desc: "Formats the optimized tour into a human-readable recommendation. Identifies overflow orders and generates natural-language explanations for each constraint violation.", tech: ["Small Language Model", "FastAPI"], input: "Optimized sequence + violations", output: "Dispatcher-ready tour plan with explanations" },
  tp_ui: { label: "Dispatcher UI", icon: Layers, color: "blue", pipeline: "tour", x: 860, y: 60, desc: "The dispatcher-facing interface where planners review, accept, or modify AI-generated tour plans. Maintains human oversight and final approval authority at all times.", tech: ["React", "Tailwind CSS"], input: "Tour recommendation from AI", output: "Accepted/modified plan sent to drivers" },

  // Predictive Planning (green)
  pp_src: { label: "Historical Data\n+ Sales Trends", icon: Database, color: "green", pipeline: "predict", x: 20, y: 60, desc: "Combines 8+ months of historical tour execution data with sales trend forecasts from the ERP system. Provides the temporal foundation for all capacity predictions.", tech: ["PostgreSQL", "ERP Integration"], input: "Tour logs, sales pipeline data", output: "Time-series dataset for forecasting" },
  pp_da: { label: "Data Agent", icon: Cpu, color: "green", pipeline: "predict", x: 160, y: 60, desc: "Aggregates and cleans historical data, applying seasonal decomposition to separate trend from noise. Handles missing data and outliers before feeding the forecasting model.", tech: ["FastAPI", "pandas"], input: "Raw historical and sales data", output: "Clean, resampled time-series data" },
  pp_pr: { label: "Pattern Recognition\nAgent", icon: Brain, color: "green", pipeline: "predict", x: 300, y: 60, desc: "Identifies recurring weekly, monthly, and seasonal demand patterns. Detects year-over-year growth trends and flags anomalous periods for exclusion from baseline.", tech: ["Prophet", "scikit-learn"], input: "Cleaned time-series data", output: "Trend components + seasonal factors" },
  pp_fm: { label: "Forecasting Model", icon: TrendingUp, color: "green", pipeline: "predict", x: 440, y: 60, desc: "Applies XGBoost or Prophet to produce a probabilistic 30-day demand forecast. Outputs confidence intervals alongside point estimates for risk-aware planning.", tech: ["XGBoost", "Prophet"], input: "Trend + seasonal decomposition", output: "Daily order volume forecast with CI" },
  pp_cr: { label: "Capacity\nRecommendation", icon: Truck, color: "green", pipeline: "predict", x: 580, y: 60, desc: "Translates forecasted order volumes into staffing and fleet recommendations using configurable capacity-per-vehicle and driver productivity parameters.", tech: ["FastAPI", "CrewAI"], input: "Forecasted volumes + fleet parameters", output: "Vehicle + driver count recommendations" },
  pp_dash: { label: "Planner Dashboard", icon: BarChart2, color: "green", pipeline: "predict", x: 720, y: 60, desc: "Presents forecasts and capacity recommendations to operations planners in an interactive chart-based UI. Supports what-if scenario modeling and export to PDF.", tech: ["React", "Recharts"], input: "Capacity recommendations + forecast data", output: "Confirmed staffing decisions" },

  // Container Forecasting (teal)
  cf_src: { label: "Container Registry\n+ Order Schedule", icon: Box, color: "teal", pipeline: "container", x: 20, y: 60, desc: "Tracks every container unit across its full lifecycle — current location, usage status, maintenance history, and scheduled deployments. Integrates with the daily order schedule to project future demand.", tech: ["PostgreSQL", "REST API"], input: "Container asset records, order schedule", output: "Container inventory snapshot" },
  cf_da: { label: "Data Agent", icon: Cpu, color: "teal", pipeline: "container", x: 175, y: 60, desc: "Merges container inventory with forward-looking order schedules. Identifies containers currently in transit, in use, or available for redeployment.", tech: ["FastAPI", "PostgreSQL"], input: "Container registry + order schedule", output: "Merged container demand dataset" },
  cf_ia: { label: "Interval Analysis\nAgent", icon: Clock, color: "teal", pipeline: "container", x: 330, y: 60, desc: "Analyzes the historical usage intervals for each container type to determine average deployment duration and replacement cadence. Flags units approaching end-of-life.", tech: ["scikit-learn", "pandas"], input: "Container usage history", output: "Usage intervals + replacement schedule" },
  cf_dfa: { label: "Demand Forecasting\nAgent", icon: TrendingUp, color: "teal", pipeline: "container", x: 490, y: 60, desc: "Combines interval analysis with forecasted order volumes to predict net container demand over the selected horizon. Compares against current stock to identify supply gaps.", tech: ["XGBoost", "Prophet"], input: "Demand projections + current stock", output: "Shortfall forecast by container type" },
  cf_alert: { label: "Procurement Alert", icon: AlertTriangle, color: "teal", pipeline: "container", x: 645, y: 60, desc: "Automatically generates procurement recommendations when a forecasted shortfall breaches configurable threshold levels. Includes suggested order quantities and lead-time-aware deadlines.", tech: ["CrewAI", "FastAPI"], input: "Shortfall forecast + procurement lead times", output: "Procurement action recommendations" },
  cf_ops: { label: "Operations Manager", icon: Users, color: "teal", pipeline: "container", x: 800, y: 60, desc: "The operations team dashboard for container fleet management. Displays live utilization metrics, upcoming shortfalls, and procurement action items in a prioritized task list.", tech: ["React", "Tailwind CSS"], input: "Procurement alerts + utilization data", output: "Procurement decisions + deployment orders" },
};

const PIPELINE_KEYS = {
  tour: ["tp_src", "tp_da", "tp_pr", "tp_ms", "tp_opt", "tp_rec", "tp_ui"],
  predict: ["pp_src", "pp_da", "pp_pr", "pp_fm", "pp_cr", "pp_dash"],
  container: ["cf_src", "cf_da", "cf_ia", "cf_dfa", "cf_alert", "cf_ops"],
};

const COLOR_CLASSES = {
  blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", badge: "bg-blue-100 text-blue-700", dot: "#3B82F6", line: "#3B82F6" },
  green: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700", badge: "bg-green-100 text-green-700", dot: "#16A34A", line: "#16A34A" },
  teal: { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-700", badge: "bg-teal-100 text-teal-700", dot: "#0D9488", line: "#0D9488" },
};

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
  );
}

function AIPipeline({ steps, onComplete, running }) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [doneSteps, setDoneSteps] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!running) { setCurrentStep(-1); setDoneSteps([]); return; }
    setCurrentStep(0);
    setDoneSteps([]);
  }, [running]);

  useEffect(() => {
    if (!running || currentStep < 0) return;
    if (currentStep >= steps.length) { onComplete && onComplete(); return; }
    timerRef.current = setTimeout(() => {
      setDoneSteps(p => [...p, currentStep]);
      setCurrentStep(c => c + 1);
    }, steps[currentStep].duration);
    return () => clearTimeout(timerRef.current);
  }, [currentStep, running]);

  if (!running && doneSteps.length === 0) return null;

  return (
    <div className="space-y-2 py-3">
      {steps.map((step, i) => {
        const done = doneSteps.includes(i);
        const active = currentStep === i;
        return (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-300 ${done ? "bg-green-50 border border-green-200" :
            active ? "bg-blue-50 border border-blue-200" :
              "bg-gray-50 border border-gray-100 opacity-50"
            }`}>
            <div className="mt-0.5 flex-shrink-0">
              {done ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                active ? <Spinner /> :
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
            </div>
            <div>
              <p className={`text-sm font-semibold ${done ? "text-green-700" : active ? "text-blue-700" : "text-gray-400"}`}>
                {step.label}
              </p>
              <p className={`text-xs mt-0.5 ${done ? "text-green-600" : active ? "text-blue-500" : "text-gray-400"}`}>
                {done ? "Completed" : step.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB 1: TOUR PLANNING ─────────────────────────────────────────────────────

function TourPlanningTab() {
  const [mode, setMode] = useState("manual");
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [tourName, setTourName] = useState("Tour 2026-03-16-A");
  const [shiftProfile, setShiftProfile] = useState("early");
  const [vehicleCount, setVehicleCount] = useState(3);
  const [earlyCount, setEarlyCount] = useState(2);
  const [lateCount, setLateCount] = useState(1);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [tourResult, setTourResult] = useState([]);
  const [aiRationale, setAiRationale] = useState(null);

  const overflowOrders = tourResult.filter(o => o.overflow);
  const normalOrders = tourResult.filter(o => !o.overflow);
  const savings = computeSavings(tourResult.length);

  const toggleOrder = (id) => {
    setSelectedOrders(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const runOptimization = () => {
    if (running) return;
    setDone(false);
    setAccepted(false);
    setExpandedOrder(null);
    const result = buildTourFromSelection(selectedOrders, shiftProfile);
    setTourResult(result);
    setAiRationale(buildAIRationale(selectedOrders, shiftProfile, result));
    setRunning(true);
  };

  const handleComplete = () => {
    setRunning(false);
    setDone(true);
  };

  const totalSteps = AI_STEPS_TOUR.reduce((s, x) => s + x.duration, 0);

  return (
    <div className="space-y-4">
      {/* Sub-mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => { setMode("manual"); setDone(false); setRunning(false); setSelectedOrders([]); }}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 border ${mode === "manual" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-[#1E3A5F] border-gray-200 hover:border-blue-400 hover:text-blue-600"
            }`}>
          Manual Planning
        </button>
        <button onClick={() => { setMode("auto"); setDone(false); setRunning(false); setSelectedOrders(ORDERS.map(o => o.id)); }}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 border ${mode === "auto" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-[#1E3A5F] border-gray-200 hover:border-blue-400 hover:text-blue-600"
            }`}>
          Auto Planning
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* LEFT — Order Map */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1E3A5F] text-sm flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${done ? "text-green-500" : "text-blue-500"}`} />
              {done ? "Optimised Tour Route" : "Order Map"}
            </h3>
            {done ? (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#16A34A", flexShrink: 0 }}></span>
                  Planned
                </span>
                <span className="flex items-center gap-1">
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }}></span>
                  Overflow
                </span>
              </div>
            ) : mode === "auto" && (
              <button onClick={() => setSelectedOrders(ORDERS.map(o => o.id))}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded px-2 py-1 transition-colors">
                Select All
              </button>
            )}
          </div>

          {/* Simulated map */}
          <div className="relative bg-gradient-to-br from-blue-50 to-slate-100 rounded-lg border border-blue-100"
            style={{ height: 280 }}>
            {/* Grid lines */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
              {[20, 40, 60, 80].map(v => (
                <g key={v}>
                  <line x1={v} y1={0} x2={v} y2={100} stroke="#94A3B8" strokeWidth="0.5" />
                  <line x1={0} y1={v} x2={100} y2={v} stroke="#94A3B8" strokeWidth="0.5" />
                </g>
              ))}
            </svg>
            {/* Road-like lines */}
            <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M10,30 Q40,25 70,35 Q90,40 95,60" stroke="#CBD5E1" strokeWidth="1.5" fill="none" />
              <path d="M5,70 Q30,60 50,65 Q70,70 95,55" stroke="#CBD5E1" strokeWidth="1.5" fill="none" />
              <path d="M30,10 Q35,40 40,60 Q42,80 38,95" stroke="#CBD5E1" strokeWidth="1.5" fill="none" />
            </svg>

            {/* Route lines: blue selection order (pre-optimisation) → green AI order (post-optimisation) */}
            {(() => {
              // Decide which sequence to draw and which colour to use
              const optimised = done && tourResult.length > 1;
              const routeIds = optimised ? tourResult.map(o => o.id) : selectedOrders;
              const colour = optimised ? "#16A34A" : "#3B82F6";
              const markerId = optimised ? "arrowGreen" : "arrowBlue";

              if (routeIds.length < 2) return null;
              return (
                <svg className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex: 1 }}>
                  <defs>
                    <marker id={markerId} markerWidth="5" markerHeight="4"
                      refX="4" refY="2" orient="auto" markerUnits="userSpaceOnUse">
                      <polygon points="0 0, 5 2, 0 4" fill={colour} opacity="0.9" />
                    </marker>
                  </defs>
                  {routeIds.map((id, i) => {
                    if (i === 0) return null;
                    const from = ORDERS.find(o => o.id === routeIds[i - 1]);
                    const to = ORDERS.find(o => o.id === id);
                    if (!from || !to) return null;
                    const dx = to.x - from.x, dy = to.y - from.y;
                    const len = Math.hypot(dx, dy) || 1;
                    const pad = 3.5;
                    return (
                      <line key={`${from.id}-${to.id}-${i}`}
                        x1={from.x + (dx / len) * pad} y1={from.y + (dy / len) * pad}
                        x2={to.x - (dx / len) * pad} y2={to.y - (dy / len) * pad}
                        stroke={colour}
                        strokeWidth={optimised ? "1.6" : "1.2"}
                        strokeDasharray={optimised ? "4 2" : "3 2"}
                        opacity={optimised ? "0.95" : "0.8"}
                        markerEnd={`url(#${markerId})`}
                        className="route-line"
                      />
                    );
                  })}
                </svg>
              );
            })()}

            {ORDERS.map(order => {
              const sel = selectedOrders.includes(order.id);
              // After optimisation, show AI sequence number and green colour
              const aiIdx = done ? tourResult.findIndex(o => o.id === order.id) : -1;
              const isInAI = done && aiIdx !== -1;
              const isOverflow = done && tourResult[aiIdx]?.overflow;
              const seqNum = isInAI ? aiIdx + 1 : sel ? selectedOrders.indexOf(order.id) + 1 : null;

              const pinColour = isInAI
                ? isOverflow
                  ? "bg-red-500 border-red-700"
                  : "bg-green-500 border-green-700"
                : sel
                  ? "bg-blue-500 border-blue-700"
                  : "bg-gray-300 border-gray-400 hover:bg-blue-200 hover:border-blue-400";

              const labelColour = isInAI
                ? isOverflow ? "bg-red-600 text-white" : "bg-green-600 text-white"
                : sel ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200";

              return (
                <button key={order.id} onClick={() => !done && mode === "manual" && toggleOrder(order.id)}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${!done && mode === "manual" ? "cursor-pointer" : "cursor-default"
                    }`}
                  style={{ left: `${order.x}%`, top: `${order.y}%`, zIndex: sel || isInAI ? 3 : 2 }}>
                  <div className={`w-5 h-5 rounded-full border-2 shadow-md transition-all duration-300 flex items-center justify-center ${pinColour} ${sel || isInAI ? "scale-125" : ""
                    }`}>
                    {seqNum !== null
                      ? <span style={{ fontSize: 8, fontWeight: 700, color: "white", lineHeight: 1 }}>{seqNum}</span>
                      : null}
                  </div>
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap shadow-sm transition-all ${labelColour}`}>
                    {order.id}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected orders list */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 font-medium mb-2">Selected Orders ({selectedOrders.length})</p>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {selectedOrders.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Click pins to select orders</p>
              ) : selectedOrders.map(id => (
                <span key={id} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{id}</span>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — Tour Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
          <h3 className="font-semibold text-[#1E3A5F] text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-500" /> Tour Configuration
          </h3>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tour Name</label>
            <input value={tourName} onChange={e => setTourName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tour Profile</label>
            <select value={shiftProfile} onChange={e => setShiftProfile(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all bg-white">
              <option value="early">Early Shift (06:00–14:00)</option>
              <option value="late">Late Shift (14:00–22:00)</option>
            </select>
          </div>

          {mode === "auto" && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Auto Planning Settings</p>
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Total Vehicles: {vehicleCount}</label>
                <input type="range" min={1} max={5} value={vehicleCount}
                  onChange={e => { setVehicleCount(+e.target.value); setEarlyCount(Math.ceil(+e.target.value / 2)); setLateCount(Math.floor(+e.target.value / 2)); }}
                  className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1</span><span>5</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Early Shift</label>
                  <input type="number" min={0} max={vehicleCount} value={earlyCount}
                    onChange={e => setEarlyCount(Math.min(+e.target.value, vehicleCount))}
                    className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm text-center font-semibold text-blue-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Late Shift</label>
                  <input type="number" min={0} max={vehicleCount} value={lateCount}
                    onChange={e => setLateCount(Math.min(+e.target.value, vehicleCount))}
                    className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm text-center font-semibold text-blue-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
            </div>
          )}

          <div className="mt-auto pt-2">
            <button onClick={runOptimization}
              disabled={running || selectedOrders.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg disabled:cursor-not-allowed text-sm">
              <Zap className="w-4 h-4" />
              {running ? "Optimizing..." : "Run AI Optimization"}
            </button>
            {selectedOrders.length === 0 && (
              <p className="text-xs text-center text-amber-600 mt-2">Select at least one order to continue</p>
            )}
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
              <p className="text-xs text-gray-500">Orders Selected</p>
              <p className="text-xl font-bold text-[#1E3A5F]">{selectedOrders.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
              <p className="text-xs text-gray-500">Shift Window</p>
              <p className="text-sm font-bold text-[#1E3A5F]">{shiftProfile === "early" ? "8h 00m" : "8h 00m"}</p>
            </div>
          </div>
        </div>

        {/* RIGHT — AI Output */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
          <h3 className="font-semibold text-[#1E3A5F] text-sm flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-blue-500" /> AI Recommendation
          </h3>

          {!running && !done && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 border border-blue-100">
                <Brain className="w-7 h-7 text-blue-400" />
              </div>
              <p className="text-gray-400 text-sm">Configure your tour and click<br /><strong className="text-gray-600">Run AI Optimization</strong> to begin</p>
            </div>
          )}

          {(running || done) && (
            <AIPipeline steps={AI_STEPS_TOUR} running={running || done} onComplete={handleComplete} />
          )}

          {done && (
            <div className="mt-2 space-y-3 animate-[fadeIn_0.5s_ease-out]">
              {/* Status */}
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${overflowOrders.length > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
                }`}>
                {overflowOrders.length > 0
                  ? <ThumbsDown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  : <ThumbsUp className="w-4 h-4 text-green-500 flex-shrink-0" />}
                <p className={`text-xs font-semibold ${overflowOrders.length > 0 ? "text-amber-700" : "text-green-700"}`}>
                  {overflowOrders.length > 0
                    ? `${overflowOrders.length} order(s) overflow this shift window`
                    : "All orders fit within the shift window"}
                </p>
              </div>

              {/* AI Rationale */}
              {aiRationale && (
                <div className={`rounded-lg border p-3 ${aiRationale.status === "overflow" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className={`w-3.5 h-3.5 flex-shrink-0 ${aiRationale.status === "overflow" ? "text-amber-500" : "text-blue-500"}`} />
                    <p className={`text-xs font-semibold ${aiRationale.status === "overflow" ? "text-amber-700" : "text-blue-700"}`}>
                      AI Reasoning
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {aiRationale.bullets.map((b, i) => {
                      const dot = b.type === "ok" ? { bg: "bg-green-500" }
                        : b.type === "warn" ? { bg: "bg-red-500" }
                          : b.type === "action" ? { bg: "bg-amber-500" }
                            : { bg: "bg-blue-400" };
                      const text = b.type === "ok" ? "text-green-800"
                        : b.type === "warn" ? "text-red-800"
                          : b.type === "action" ? "text-amber-800"
                            : "text-blue-800";
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot.bg}`}></span>
                          <span className={`text-xs leading-relaxed ${text}`}>{b.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Tour sequence table */}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2 py-2 text-left text-gray-500 font-semibold">Order</th>
                      <th className="px-2 py-2 text-left text-gray-500 font-semibold">Location</th>
                      <th className="px-2 py-2 text-right text-gray-500 font-semibold">ETA</th>
                      <th className="px-2 py-2 text-right text-gray-500 font-semibold">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalOrders.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-2 py-1.5 font-semibold text-blue-600">{row.id}</td>
                        <td className="px-2 py-1.5 text-gray-700 truncate max-w-[90px]">{row.location}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-700">{row.arrival}</td>
                        <td className="px-2 py-1.5 text-right text-gray-500">{row.duration}'</td>
                      </tr>
                    ))}
                    {overflowOrders.map((row, i) => (
                      <tr key={`ov-${i}`} className="bg-red-50">
                        <td className="px-2 py-1.5 font-semibold text-red-600">{row.id}</td>
                        <td className="px-2 py-1.5 text-red-700 truncate max-w-[90px]">{row.location}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-red-600">{row.arrival} ⚠</td>
                        <td className="px-2 py-1.5 text-right text-red-500">{row.duration}'</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Overflow explanation */}
              {overflowOrders.map((row, i) => (
                <div key={i} className="border border-amber-200 rounded-lg overflow-hidden">
                  <button onClick={() => setExpandedOrder(expandedOrder === row.id ? null : row.id)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100 transition-colors text-left">
                    <span className="text-xs font-semibold text-amber-700">Ask AI why {row.id} overflows</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-amber-500 transition-transform duration-200 ${expandedOrder === row.id ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${expandedOrder === row.id ? "max-h-40" : "max-h-0"}`}>
                    <div className="px-3 py-2.5 bg-white border-t border-amber-100">
                      <p className="text-xs text-gray-600 leading-relaxed">
                        <strong>{row.id}</strong> exceeds the {shiftProfile === "early" ? "Early" : "Late"} Shift window by{" "}
                        {shiftProfile === "early" ? "14 minutes" : "18 minutes"} due to a time constraint at{" "}
                        <strong>{row.location}</strong>. The {row.duration}-minute service duration plus transit pushes the arrival past the shift cutoff.
                        <br /><br />
                        <span className="text-blue-600 font-semibold">Recommendation:</span> Move to next available{" "}
                        {shiftProfile === "early" ? "Late Shift" : "Early Shift next day"} tour starting{" "}
                        {shiftProfile === "early" ? "14:00" : "06:00 tomorrow"}.
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Savings */}
              <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-200 flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-600 font-medium">Estimated Time Saved</p>
                  <p className="text-lg font-bold text-blue-700">{savings.time} min vs. manual route</p>
                </div>
              </div>

              {/* Action buttons */}
              {!accepted ? (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setAccepted(true)}
                    className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg transition-all shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5" /> Accept Plan
                  </button>
                  <button className="flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2.5 rounded-lg border border-gray-200 transition-all">
                    <Settings className="w-3.5 h-3.5" /> Modify Manually
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <p className="text-xs text-green-700 font-semibold">Plan accepted — dispatched to drivers</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAB 2: PREDICTIVE PLANNING ───────────────────────────────────────────────

function PredictivePlanningTab() {
  const [fromDate, setFromDate] = useState("2026-03-16");
  const [toDate, setToDate] = useState("2026-04-14");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const chartData = generateOrderVolume(fromDate);
  const peakEntry = chartData.reduce((a, b) => a.orders > b.orders ? a : b, chartData[0]);
  const weekdayData = chartData.filter(d => !d.isWeekend);
  const weekendData = chartData.filter(d => d.isWeekend);
  const weekdayAvg = Math.round(weekdayData.reduce((sum, d) => sum + d.orders, 0) / weekdayData.length);
  const weekendAvg = Math.round(weekendData.reduce((sum, d) => sum + d.orders, 0) / weekendData.length);
  const weekendAreas = [];
  for (let i = 0; i < chartData.length; i++) {
    if (chartData[i].isWeekend) {
      if (weekendAreas.length > 0 && chartData[i - 1]?.isWeekend) {
        weekendAreas[weekendAreas.length - 1].x2 = chartData[i].date;
      } else {
        weekendAreas.push({ x1: chartData[i].date, x2: chartData[i].date });
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Input panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all" />
          </div>
          <button onClick={() => { setDone(false); setRunning(true); }}
            disabled={running}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2 px-5 rounded-lg transition-all duration-150 shadow-md text-sm">
            <TrendingUp className="w-4 h-4" />
            {running ? "Predicting..." : "Predict"}
          </button>
        </div>
      </div>

      {/* AI Pipeline */}
      {(running || done) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="font-semibold text-[#1E3A5F] text-sm mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4 text-blue-500" /> AI Processing
          </h3>
          <AIPipeline steps={AI_STEPS_SHORT} running={running} onComplete={() => { setRunning(false); setDone(true); }} />
        </div>
      )}

      {/* Results */}
      {done && (
        <div className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-[#1E3A5F] text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-500" /> Projected Daily Order Volume
              </h3>
              <div className="flex gap-4">
                <span className="text-xs text-gray-500">Peak: <strong className="text-red-500">{peakEntry.date} ({peakEntry.orders})</strong></span>
                <span className="text-xs text-gray-500">Wkday avg: <strong className="text-green-600">{weekdayAvg}</strong></span>
                <span className="text-xs text-gray-500">Wkend avg: <strong className="text-amber-600">{weekendAvg}</strong></span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 10, right: 40, left: 15, bottom: 5 }}>
                <defs>
                  <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} label={{ value: "Orders / Day", angle: -90, position: "insideLeft", dx: -10, style: { fontSize: 10, fill: "#94A3B8" } }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        <p style={{ fontWeight: 600, color: "#1E3A5F", marginBottom: 4 }}>{d.dayLabel}, {label}</p>
                        <p style={{ color: "#3B82F6" }}>Orders: <strong>{d.orders}</strong></p>
                        <p style={{ color: "#94A3B8", fontSize: 11 }}>Estimate range: {d.lower}–{d.upper}</p>
                        {d.isWeekend && <p style={{ color: "#D97706", fontSize: 11, marginTop: 2 }}>Weekend — reduced volume</p>}
                      </div>
                    );
                  }}
                />
                {weekendAreas.map((area, i) => (
                  <ReferenceArea key={i} x1={area.x1} x2={area.x2} fill="#FEF3C7" fillOpacity={0.6} />
                ))}
                <ReferenceLine y={weekdayAvg} stroke="#10B981" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `Avg ${weekdayAvg}`, position: "right", fontSize: 10, fill: "#10B981" }} />
                <ReferenceLine x={peakEntry.date} stroke="#EF4444" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Peak", position: "insideTopRight", fontSize: 10, fill: "#EF4444" }} />
                <Area type="monotone" dataKey="upper" stroke="none" fill="#DBEAFE" fillOpacity={0.4} legendType="none" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="white" fillOpacity={1} legendType="none" />
                <Area type="monotone" dataKey="orders" stroke="#3B82F6" fill="url(#orderGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#3B82F6" }} name="Order Volume" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#3B82F6" strokeWidth="2.5" /></svg>
                <span>Projected Orders</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-5 h-2.5 rounded" style={{ background: "#DBEAFE", border: "1px solid #BFDBFE" }}></div>
                <span>Confidence Range</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#10B981" strokeWidth="2" strokeDasharray="5,3" /></svg>
                <span>Weekday Average</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-5 h-2.5 rounded" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}></div>
                <span>Weekend</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#EF4444" strokeWidth="2" strokeDasharray="4,3" /></svg>
                <span>Peak Day</span>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <Truck className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Recommended Vehicles</p>
              <p className="text-3xl font-bold text-[#1E3A5F]">4</p>
              <p className="text-xs text-amber-600 font-medium mt-1">↑ up from current 3</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <Users className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Recommended Drivers</p>
              <p className="text-3xl font-bold text-[#1E3A5F]">5</p>
              <p className="text-xs text-gray-500 mt-1">Full-time equivalents</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <Zap className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Projected Energy</p>
              <p className="text-3xl font-bold text-[#1E3A5F]">1,240</p>
              <p className="text-xs text-gray-500 mt-1">kWh estimated</p>
            </div>
          </div>

          {/* Insight box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <Brain className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-700 mb-1">AI Insight</p>
              <p className="text-sm text-blue-800 leading-relaxed">
                Based on 8 months of historical data and a <strong>12% YoY growth trend</strong>, demand during this period is expected to peak on{" "}
                <strong>{peakEntry.date} ({peakEntry.orders} orders)</strong>. We recommend pre-booking 1 additional vehicle by{" "}
                <strong>24.03.2026</strong> to ensure coverage without last-minute surcharges.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB 3: CONTAINER FORECASTING ────────────────────────────────────────────

function ContainerForecastingTab() {
  const [containerType, setContainerType] = useState("Document Boxes");
  const [forecastPeriod, setForecastPeriod] = useState("Next 30 days");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const days = forecastPeriod === "Next 30 days" ? 30 : forecastPeriod === "Next 90 days" ? 90 : 180;
  const chartData = generateContainerForecast(days);

  const shortfallDate = forecastPeriod === "Next 30 days" ? "10.04.2026"
    : forecastPeriod === "Next 90 days" ? "15.05.2026" : "20.07.2026";
  const procurementDate = forecastPeriod === "Next 30 days" ? "27.03.2026"
    : forecastPeriod === "Next 90 days" ? "01.05.2026" : "05.07.2026";

  const crossoverEntry = chartData.find(d => d["Forecasted Need"] > d["Current Stock"]);
  const maxNeed = Math.max(...chartData.map(d => d["Forecasted Need"]));
  const currentStock = chartData[0]?.["Current Stock"] ?? 0;
  const safetyThreshold = Math.round(currentStock * 0.88);

  return (
    <div className="space-y-4">
      {/* Input panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Container Type</label>
            <select value={containerType} onChange={e => setContainerType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white transition-all">
              <option>Document Boxes</option>
              <option>Medical Cassons</option>
              <option>Waste Containers</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Forecast Period</label>
            <select value={forecastPeriod} onChange={e => setForecastPeriod(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white transition-all">
              <option>Next 30 days</option>
              <option>Next 90 days</option>
              <option>Next 6 months</option>
            </select>
          </div>
          <button onClick={() => { setDone(false); setRunning(true); }}
            disabled={running}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2 px-5 rounded-lg transition-all text-sm shadow-md">
            <Package className="w-4 h-4" />
            {running ? "Forecasting..." : "Forecast"}
          </button>
        </div>
      </div>

      {/* AI Pipeline */}
      {(running || done) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="font-semibold text-[#1E3A5F] text-sm mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4 text-blue-500" /> AI Processing
          </h3>
          <AIPipeline steps={AI_STEPS_SHORT} running={running} onComplete={() => { setRunning(false); setDone(true); }} />
        </div>
      )}

      {/* Results */}
      {done && (
        <div className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-[#1E3A5F] text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-500" /> Container Demand Forecast — {containerType}
              </h3>
              <div className="flex gap-4">
                <span className="text-xs text-gray-500">Current Stock: <strong className="text-slate-600">{currentStock}</strong></span>
                <span className="text-xs text-gray-500">Peak Need: <strong className="text-blue-600">{maxNeed}</strong></span>
                {crossoverEntry
                  ? <span className="text-xs text-gray-500">Shortfall from: <strong className="text-red-500">{crossoverEntry.date}</strong></span>
                  : <span className="text-xs text-green-600 font-medium">Stock sufficient</span>
                }
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 10, right: 60, left: 15, bottom: 5 }}>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} interval={3} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} label={{ value: "Units", angle: -90, position: "insideLeft", dx: -10, style: { fontSize: 10, fill: "#94A3B8" } }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    const need = d?.["Forecasted Need"];
                    const stock = d?.["Current Stock"];
                    const gap = (need != null && stock != null) ? need - stock : null;
                    return (
                      <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        <p style={{ fontWeight: 600, color: "#1E3A5F", marginBottom: 4 }}>{label}</p>
                        <p style={{ color: "#3B82F6" }}>Forecasted Need: <strong>{need}</strong></p>
                        <p style={{ color: "#64748B" }}>Current Stock: <strong>{stock}</strong></p>
                        {gap !== null && (
                          <p style={{ color: gap > 0 ? "#EF4444" : "#10B981", fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                            {gap > 0 ? `Shortfall: ${gap} units` : `Surplus: ${Math.abs(gap)} units`}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                {/* Shortfall zone */}
                {crossoverEntry && (
                  <ReferenceArea x1={crossoverEntry.date} fill="#FEF2F2" fillOpacity={0.55} />
                )}
                {/* Safety threshold */}
                <ReferenceLine y={safetyThreshold} stroke="#F59E0B" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `Safety ${safetyThreshold}`, position: "right", fontSize: 10, fill: "#F59E0B" }} />
                {/* Crossover marker */}
                {crossoverEntry && (
                  <ReferenceLine x={crossoverEntry.date} stroke="#EF4444" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Shortfall", position: "insideTopRight", fontSize: 10, fill: "#EF4444" }} />
                )}
                {/* Confidence band for forecasted need */}
                <Area type="monotone" dataKey="Need Upper" stroke="none" fill="#DBEAFE" fillOpacity={0.35} legendType="none" />
                <Area type="monotone" dataKey="Need Lower" stroke="none" fill="white" fillOpacity={1} legendType="none" />
                {/* Main series */}
                <Area type="monotone" dataKey="Forecasted Need" stroke="#3B82F6" fill="url(#blueGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#3B82F6" }} />
                <Area type="monotone" dataKey="Current Stock" stroke="#94A3B8" fill="url(#grayGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#94A3B8" }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#3B82F6" strokeWidth="2.5" /></svg>
                <span>Forecasted Need</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-5 h-2.5 rounded" style={{ background: "#DBEAFE", border: "1px solid #BFDBFE" }}></div>
                <span>Forecast Range</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#94A3B8" strokeWidth="2" /></svg>
                <span>Current Stock</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#F59E0B" strokeWidth="2" strokeDasharray="5,3" /></svg>
                <span>Safety Threshold</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-5 h-2.5 rounded" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}></div>
                <span>Shortfall Zone</span>
              </div>
            </div>
          </div>

          {/* Alert card */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">Stock Shortfall Alert</p>
              <p className="text-sm text-red-800 leading-relaxed">
                Forecasted shortfall of <strong>420 {containerType}</strong> expected around <strong>{shortfallDate}</strong>.
                At current consumption rates, stock will fall below the safety threshold 12 days before peak demand.
                Recommend initiating procurement action by <strong>{procurementDate}</strong> to account for supplier lead time.
              </p>
            </div>
          </div>

          {/* Utilization breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h4 className="text-sm font-semibold text-[#1E3A5F] mb-3">Fleet Utilization — {containerType}</h4>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { label: "In Use", pct: 62, color: "bg-blue-500" },
                { label: "In Transit", pct: 21, color: "bg-amber-400" },
                { label: "Available", pct: 17, color: "bg-green-500" },
              ].map(({ label, pct, color }) => (
                <div key={label} className="text-center">
                  <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-lg font-bold text-[#1E3A5F]">{pct}%</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Replacement insight */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 mb-1">Replacement Cycle Insight</p>
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>18%</strong> of your <strong>{containerType}</strong> fleet is due for replacement in the next 90 days based on usage intervals.
                Average unit lifespan is 36 months; affected units entered service in Q1 2023. Early replacement during low-demand periods can reduce field failure rates by up to 34%.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB 4: SYSTEM ARCHITECTURE ──────────────────────────────────────────────

const PIPELINE_CONFIGS = [
  { key: "tour", label: "Tour Planning Pipeline", color: "blue", nodes: PIPELINE_KEYS.tour },
  { key: "predict", label: "Predictive Planning Pipeline", color: "green", nodes: PIPELINE_KEYS.predict },
  { key: "container", label: "Container Forecasting Pipeline", color: "teal", nodes: PIPELINE_KEYS.container },
];

function ArchNode({ nodeKey, node, selected, onClick }) {
  const cc = COLOR_CLASSES[node.color];
  const Icon = node.icon;
  return (
    <button onClick={() => onClick(nodeKey)}
      className={`relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md text-center min-w-[90px] max-w-[100px] ${selected
        ? `${cc.bg} ${cc.border} shadow-md scale-105`
        : "bg-white border-gray-200 hover:border-gray-300"
        }`}>
      <Icon className={`w-4 h-4 ${selected ? cc.text : "text-gray-500"}`} />
      <p className={`text-[10px] font-semibold leading-tight whitespace-pre-line ${selected ? cc.text : "text-gray-600"}`}>
        {node.label}
      </p>
    </button>
  );
}

function SystemArchitectureTab() {
  const [selectedNode, setSelectedNode] = useState(null);
  const node = selectedNode ? ARCH_NODES[selectedNode] : null;

  const techColors = {
    "XGBoost": "bg-orange-100 text-orange-700",
    "CrewAI": "bg-purple-100 text-purple-700",
    "FastAPI": "bg-green-100 text-green-700",
    "PostgreSQL + pgvector": "bg-blue-100 text-blue-700",
    "PostgreSQL": "bg-blue-100 text-blue-700",
    "Small Language Model": "bg-indigo-100 text-indigo-700",
    "React": "bg-cyan-100 text-cyan-700",
    "Tailwind CSS": "bg-sky-100 text-sky-700",
    "scikit-learn": "bg-yellow-100 text-yellow-700",
    "pandas": "bg-teal-100 text-teal-700",
    "Prophet": "bg-pink-100 text-pink-700",
    "OR-Tools": "bg-red-100 text-red-700",
    "REST API": "bg-gray-100 text-gray-700",
    "ERP Integration": "bg-violet-100 text-violet-700",
    "Recharts": "bg-cyan-100 text-cyan-700",
  };

  return (
    <div className="grid grid-cols-5 gap-5">
      {/* Left — Diagram */}
      <div className="col-span-3 space-y-5">
        {PIPELINE_CONFIGS.map(({ key, label, color, nodes }) => {
          const cc = COLOR_CLASSES[color];
          return (
            <div key={key} className={`bg-white rounded-xl border ${cc.border} shadow-sm p-4`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2.5 h-2.5 rounded-full`} style={{ backgroundColor: cc.dot }} />
                <h4 className={`text-xs font-bold uppercase tracking-widest ${cc.text}`}>{label}</h4>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {nodes.map((nk, i) => (
                  <div key={nk} className="flex items-center gap-1.5">
                    <ArchNode nodeKey={nk} node={ARCH_NODES[nk]} selected={selectedNode === nk} onClick={setSelectedNode} />
                    {i < nodes.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right — Explanation */}
      <div className="col-span-2">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sticky top-4">
          {!node ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-[#1E3A5F]">Multi-Agent Architecture</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                AI2Connect builds <strong>non-autonomous agent systems</strong> that augment human decision-making rather than replacing it. Each pipeline is composed of specialized agents, each optimized for a single task — ensuring transparency, auditability, and human override at every step.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Agents communicate through structured data contracts, making it easy to swap individual components, retrain models independently, or integrate with existing ERP and TMS systems via standard APIs.
              </p>
              <div className="space-y-2">
                {PIPELINE_CONFIGS.map(({ key, label, color, nodes }) => {
                  const cc = COLOR_CLASSES[color];
                  return (
                    <div key={key} className={`flex items-center gap-2 p-2.5 rounded-lg ${cc.bg} border ${cc.border}`}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cc.dot }} />
                      <span className={`text-xs font-semibold ${cc.text}`}>{label}</span>
                      <span className={`text-xs ${cc.text} opacity-70 ml-auto`}>{nodes.length} agents</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-4 italic">Click any node to explore its role and technology stack</p>
            </div>
          ) : (
            <div key={selectedNode} className="animate-[fadeIn_0.3s_ease-out]">
              {(() => {
                const cc = COLOR_CLASSES[node.color];
                const Icon = node.icon;
                return (
                  <>
                    <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg ${cc.bg} border ${cc.border}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cc.bg} border ${cc.border}`}>
                        <Icon className={`w-5 h-5 ${cc.text}`} />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${cc.text} whitespace-pre-line leading-tight`}>{node.label}</h3>
                        <p className={`text-xs opacity-70 ${cc.text} capitalize`}>{node.pipeline} pipeline</p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{node.desc}</p>

                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Technology Stack</p>
                      <div className="flex flex-wrap gap-1.5">
                        {node.tech.map(t => (
                          <span key={t} className={`px-2 py-1 rounded text-xs font-semibold ${techColors[t] || "bg-gray-100 text-gray-700"}`}>{t}</span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Input</p>
                        <p className="text-xs text-gray-700">{node.input}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Output</p>
                        <p className="text-xs text-gray-700">{node.output}</p>
                      </div>
                    </div>

                    <button onClick={() => setSelectedNode(null)}
                      className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
                      ← Back to overview
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "tour", label: "Tour Planning & AI Optimization", icon: Navigation },
  { id: "predict", label: "Predictive Planning", icon: TrendingUp },
  { id: "container", label: "Container Forecasting", icon: Package },
  { id: "arch", label: "System Architecture", icon: GitBranch },
];

export default function AI2ConnectDemo() {
  const [activeTab, setActiveTab] = useState("tour");
  const [resetKey, setResetKey] = useState(0);

  const handleReset = () => {
    setActiveTab("tour");
    setResetKey(k => k + 1);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex items-center gap-8 h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <img src="/src/AI2ConnectLogoMitrand.jpg" alt="AI2Connect"
                className="h-10 w-auto object-contain" />
              <div className="leading-tight">
                <p className="font-extrabold text-[#1E3A5F] text-base tracking-tight leading-none">AI2Connect</p>
                <p className="text-xs text-cyan-600 font-semibold tracking-wide">GmbH</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto flex-1">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 ${activeTab === id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-[#1E3A5F] hover:bg-gray-100"
                    }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Right controls */}
            <div className="flex-shrink-0 flex items-center gap-3">
              <button onClick={handleReset}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 hover:bg-red-50 rounded-lg px-3 py-1.5 transition-all duration-150">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Reset Demo
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">
            {TABS.find(t => t.id === activeTab)?.label}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === "tour" && "AI-powered tour creation and dispatch optimization for transport planners"}
            {activeTab === "predict" && "Forecast operational demand and proactively plan fleet and staffing"}
            {activeTab === "container" && "Predict container volume requirements and prevent supply shortfalls"}
            {activeTab === "arch" && "Multi-agent AI architecture powering the AI2Connect platform"}
          </p>
        </div>

        {activeTab === "tour" && <TourPlanningTab key={resetKey} />}
        {activeTab === "predict" && <PredictivePlanningTab key={resetKey} />}
        {activeTab === "container" && <ContainerForecastingTab key={resetKey} />}
        {activeTab === "arch" && <SystemArchitectureTab key={resetKey} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8 py-4 bg-white">
        <div className="max-w-screen-xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            AI2Connect Platform — Demo prepared for MWA Solutions
          </p>
          <p className="text-xs text-gray-400">All data shown is simulated for demonstration purposes</p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-\\[fadeIn_0\\.5s_ease-out\\] { animation: fadeIn 0.5s ease-out; }
        .animate-\\[fadeIn_0\\.3s_ease-out\\] { animation: fadeIn 0.3s ease-out; }
        @keyframes dashMove {
          from { stroke-dashoffset: 20; }
          to   { stroke-dashoffset: 0; }
        }
        .route-line { animation: dashMove 1.2s linear infinite; }
      `}</style>
    </div>
  );
}
