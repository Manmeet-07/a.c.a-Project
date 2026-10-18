// The ACA mark: a match ring that is mostly full (cyan) with one gap (orange),
// i.e. "a resume that fits, with one thing to work on".
const RING = 2 * Math.PI * 11;

export default function Logo({ size = 22, accent = "#22d3ee", gap = "#fb923c", track = "currentColor" }: {
  size?: number; accent?: string; gap?: string; track?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="11" fill="none" stroke={track} strokeOpacity="0.16" strokeWidth="5" />
      <circle cx="16" cy="16" r="11" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={RING} strokeDashoffset={RING * 0.27} transform="rotate(-90 16 16)" />
      <circle cx="8.2" cy="8.2" r="2.6" fill={gap} />
    </svg>
  );
}
