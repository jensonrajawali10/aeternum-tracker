"use client";

import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from "chart.js";

let registered = false;

export function registerCharts() {
  if (registered) return;
  Chart.register(
    CategoryScale,
    LinearScale,
    TimeScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
  );
  Chart.defaults.color = "#7a8699";
  Chart.defaults.borderColor = "#1f2a38";
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif";
  Chart.defaults.font.size = 11;
  registered = true;
}
