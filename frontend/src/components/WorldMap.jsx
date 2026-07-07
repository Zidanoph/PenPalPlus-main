import { useState } from "react";
import { flagOf } from "./ui.jsx";

/* Simple equirectangular projection onto a 1000×520 viewBox. Good enough for
   a stylised "nautical chart" look — this app draws routes, not coastlines. */
function project(lat, lng) {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 520;
  return [x, y];
}

/* A gentle arc between two points, like the dashed airmail routes on the
   login page — never a straight line, always a little flight-path lift. */
function arcPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  // Lift perpendicular to the route, proportional to distance (capped).
  const lift = Math.min(dist * 0.22, 90);
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx = mx + nx * lift;
  const cy = my + ny * lift;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export default function WorldMap({ home, pins, selectedId, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const [hx, hy] = project(home.latitude, home.longitude);

  return (
    <div className="airmail-edge" style={{ padding: 4 }}>
      <svg
        viewBox="0 0 1000 520"
        style={{ width: "100%", height: "auto", display: "block", background: "var(--paper-2)", borderRadius: 8 }}
      >
        {/* faint lat/long grid — a nod to old navigation charts */}
        <g stroke="var(--paper-edge)" strokeWidth="1">
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={520} />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 104} x2={1000} y2={i * 104} />
          ))}
        </g>
        <rect x={0.5} y={0.5} width={999} height={519} fill="none" stroke="var(--sepia)" strokeWidth="1" opacity="0.4" />

        {/* flight paths, home → every correspondent */}
        <g fill="none" strokeWidth={selectedId ? 1 : 1.3}>
          {pins.map((p) => {
            const [px, py] = project(p.latitude, p.longitude);
            const active = selectedId === p.user_id || hovered === p.user_id;
            return (
              <path
                key={p.user_id}
                d={arcPath(hx, hy, px, py)}
                stroke={active ? "var(--postal-red)" : "var(--postal-blue)"}
                strokeDasharray={active ? "none" : "3 5"}
                opacity={selectedId && !active ? 0.18 : active ? 0.95 : 0.5}
                style={{ transition: "opacity 0.15s, stroke 0.15s" }}
              />
            );
          })}
        </g>

        {/* correspondent pins */}
        {pins.map((p) => {
          const [px, py] = project(p.latitude, p.longitude);
          const active = selectedId === p.user_id || hovered === p.user_id;
          const r = 5 + Math.min(p.letters_count, 6) * 0.9;
          return (
            <g
              key={p.user_id}
              transform={`translate(${px},${py})`}
              onMouseEnter={() => setHovered(p.user_id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(p.user_id === selectedId ? null : p.user_id)}
              style={{ cursor: "pointer" }}
            >
              <circle r={r} fill={p.avatar_color} stroke="var(--paper-2)" strokeWidth="2"
                opacity={selectedId && !active ? 0.35 : 1} />
              {active ? (
                <>
                  <rect x={10} y={-11} width={p.display_name.length * 6.4 + 16} height={22} rx={4}
                    fill="var(--ink)" opacity={0.92} />
                  <text x={18} y={4} fontSize="12" fill="var(--paper-2)" fontFamily="var(--font-mono)">
                    {flagOf(p.country_code)} {p.display_name}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}

        {/* home pin, drawn last so it stays on top */}
        <g transform={`translate(${hx},${hy})`}>
          <circle r={7} fill="var(--postal-red)" stroke="var(--paper-2)" strokeWidth="2.5" />
          <circle r={12} fill="none" stroke="var(--postal-red)" strokeWidth="1.5" opacity="0.5">
            <animate attributeName="r" values="7;16;7" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </div>
  );
}
