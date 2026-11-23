import type { CSSProperties } from "react";

const COUNT = 28;
const COLORS = ["rgba(10,10,10,0.14)", "rgba(220,38,38,0.28)", "rgba(22,163,74,0.26)", "rgba(10,10,10,0.1)"];

// Deterministic pseudo-random values so server and client render identically.
const rand = (i: number, salt: number): number => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export default function Snowfall() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {Array.from({ length: COUNT }, (_, i) => {
        const size = 3 + rand(i, 1) * 5;
        const style = {
          left: `${rand(i, 2) * 100}%`,
          width: `${size}px`,
          height: `${size}px`,
          background: COLORS[i % COLORS.length],
          animationDuration: `${14 + rand(i, 3) * 16}s`,
          animationDelay: `-${rand(i, 4) * 30}s`,
          "--drift": `${(rand(i, 5) - 0.5) * 80}px`,
        } as CSSProperties;
        return <span key={i} className="snowflake" style={style} />;
      })}
    </div>
  );
}
