/** One set, one stroke width. Geometric to match the rest of the chrome. */
const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const MoonIcon = () => (
  <svg {...base}>
    <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.7 6.7 0 0 0 9.7 9.7z" />
  </svg>
);

export const SlidersIcon = () => (
  <svg {...base}>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <circle cx="9" cy="7" r="2.1" />
    <circle cx="15" cy="12" r="2.1" />
    <circle cx="8" cy="17" r="2.1" />
  </svg>
);

/** Pinned favorites. Filled when pinned so state reads without color alone. */
export const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg {...base} width={18} height={18} fill={filled ? "currentColor" : "none"}>
    <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
  </svg>
);
