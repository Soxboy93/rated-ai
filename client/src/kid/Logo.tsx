/** The Rated AI mark: a soft teal rounded square with a spark. Drawn in SVG so it is crisp at any size. */
export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Rated AI" style={{ flex: "none" }}>
      <defs>
        <linearGradient id="ra-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f5f9e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#ra-logo)" />
      <path d="M24 9c1.2 7.4 3.6 9.8 11 11-7.4 1.2-9.8 3.6-11 11-1.2-7.4-3.6-9.8-11-11 7.4-1.2 9.8-3.6 11-11Z" fill="#fff" />
      <circle cx="36" cy="35" r="3.4" fill="#ffd166" />
    </svg>
  );
}
