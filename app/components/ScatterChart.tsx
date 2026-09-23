"use client";

import { useState } from "react";
import { TeamLogo } from "@/app/components/TeamLogo";

export interface ScatterDatum {
  id: string;
  label: string; // team abbreviation, shown in the hover tooltip
  x: number;
  y: number;
}

const WIDTH = 560;
const HEIGHT = 560;
const MARGIN = { top: 16, right: 16, bottom: 40, left: 52 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

// A single blue hue for every dot -- one series, so no legend is needed
// (the chart's title already says what's plotted); identity per-point comes
// from the hover tooltip instead of color or a direct label on every dot.
const DOT_COLOR = "#2a78d6";
const SURFACE = "#fcfcfb";
const GRIDLINE = "#e1e0d9";
const MUTED = "#898781";
const PRIMARY_INK = "#0b0b0b";

function domain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = span * 0.08;
  return [min - pad, max + pad];
}

// A small "nice numbers" tick generator so gridlines/labels land on clean
// round values instead of whatever the padded data domain happens to be.
function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const rawStep = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let step: number;
  if (residual > 5) step = 10 * magnitude;
  else if (residual > 2) step = 5 * magnitude;
  else if (residual > 1) step = 2 * magnitude;
  else step = magnitude;

  const niceMin = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= max + step * 0.001; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

export function ScatterChart({
  title,
  xLabel,
  yLabel,
  points,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  points: ScatterDatum[];
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const [xMin, xMax] = domain(points.map((p) => p.x));
  const [yMin, yMax] = domain(points.map((p) => p.y));
  const scaleX = (x: number) => MARGIN.left + ((x - xMin) / (xMax - xMin)) * PLOT_WIDTH;
  const scaleY = (y: number) => MARGIN.top + PLOT_HEIGHT - ((y - yMin) / (yMax - yMin)) * PLOT_HEIGHT;

  const xTicks = niceTicks(xMin, xMax);
  const yTicks = niceTicks(yMin, yMax);

  const plotted = points.map((p) => ({ ...p, px: scaleX(p.x), py: scaleY(p.y) }));
  const hovered = plotted.find((p) => p.id === hoveredId) ?? null;
  // Flip the tooltip below the dot instead of above when there isn't room
  // above it, so it never gets clipped off the top of the chart.
  const tooltipBelow = hovered !== null && hovered.py - MARGIN.top < 70;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-700">{title}</h3>
      <div className="relative" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label={title}>
          {/* Gridlines -- recessive hairlines, drawn before any marks. */}
          {yTicks.map((t) => (
            <line
              key={`gy-${t}`}
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={scaleY(t)}
              y2={scaleY(t)}
              stroke={GRIDLINE}
              strokeWidth={1}
            />
          ))}
          {xTicks.map((t) => (
            <line
              key={`gx-${t}`}
              x1={scaleX(t)}
              x2={scaleX(t)}
              y1={MARGIN.top}
              y2={HEIGHT - MARGIN.bottom}
              stroke={GRIDLINE}
              strokeWidth={1}
            />
          ))}

          {/* Axis tick labels. */}
          {yTicks.map((t) => (
            <text key={`yl-${t}`} x={MARGIN.left - 8} y={scaleY(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED}>
              {t}
            </text>
          ))}
          {xTicks.map((t) => (
            <text
              key={`xl-${t}`}
              x={scaleX(t)}
              y={HEIGHT - MARGIN.bottom + 16}
              textAnchor="middle"
              fontSize={11}
              fill={MUTED}
            >
              {t}
            </text>
          ))}

          {/* Axis titles. */}
          <text
            x={MARGIN.left + PLOT_WIDTH / 2}
            y={HEIGHT - 6}
            textAnchor="middle"
            fontSize={12}
            fill={PRIMARY_INK}
          >
            {xLabel}
          </text>
          <text
            x={14}
            y={MARGIN.top + PLOT_HEIGHT / 2}
            textAnchor="middle"
            fontSize={12}
            fill={PRIMARY_INK}
            transform={`rotate(-90, 14, ${MARGIN.top + PLOT_HEIGHT / 2})`}
          >
            {yLabel}
          </text>

          {/* Dots -- each carries a 2px surface-color ring so overlapping
              points stay legible, and lifts slightly (bigger radius) on
              hover. */}
          {plotted.map((p) => (
            <circle
              key={p.id}
              cx={p.px}
              cy={p.py}
              r={p.id === hoveredId ? 6 : 4}
              fill={DOT_COLOR}
              stroke={SURFACE}
              strokeWidth={2}
            />
          ))}

          {/* Transparent hit targets, drawn on top so overlapping dots don't
              block each other's hover -- each is >=24px in rendered pixels
              (the SVG's viewBox units track 1:1 with CSS px at this chart's
              typical rendered width). */}
          {plotted.map((p) => (
            <circle
              key={`hit-${p.id}`}
              cx={p.px}
              cy={p.py}
              r={12}
              fill="transparent"
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === p.id ? null : cur))}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm"
            style={{
              left: `${(hovered.px / WIDTH) * 100}%`,
              top: `${(hovered.py / HEIGHT) * 100}%`,
              transform: `translate(-50%, ${tooltipBelow ? "12px" : "calc(-100% - 12px)"})`,
            }}
          >
            <TeamLogo name={hovered.label} className="h-4 w-4" />
            <span className="font-semibold">{hovered.label}</span>
            <span className="text-zinc-500">
              {xLabel} {hovered.x} &middot; {yLabel} {hovered.y}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
