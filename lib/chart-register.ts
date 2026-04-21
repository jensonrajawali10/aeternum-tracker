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
  // Match the violet/dark palette in globals.css (--color-muted, --color-border)
  Chart.defaults.color = "#A1A1AA";
  Chart.defaults.borderColor = "#242428";
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif";
  Chart.defaults.font.size = 11;
  registered = true;
}
