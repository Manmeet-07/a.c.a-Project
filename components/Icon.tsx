import type { CSSProperties } from "react";
const paths = {
  spark: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z",
  profile: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 8h5m-5 4h5m-3 4h3",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4",
  file: "M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8m-8 4h6",
};
export default function Icon({ name, className, style }: { name: keyof typeof paths; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
