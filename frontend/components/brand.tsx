/**
 * Brand marks drawn in SVG (from the coming-soon page): the BB monogram and bluebonnet motifs.
 * Pure markup, no JavaScript.
 */
export function Monogram({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="60" rx="46" ry="56.5" fill="#FAF9F3" stroke="#1E3A8A" strokeWidth="1.4" />
      <ellipse cx="60" cy="60" rx="41" ry="51" fill="none" stroke="#8B8CFC" strokeWidth="0.7" />
      <text x="60" y="62" textAnchor="middle" fontFamily="Georgia, serif" fontSize="34" fill="#1E3A8A" letterSpacing="-2">BB</text>
      <g transform="translate(60 90)">
        <path d="M0 -10 v18" stroke="#1E3A8A" strokeWidth="1.1" />
        <ellipse cx="0" cy="-14" rx="5" ry="7" fill="#8B8CFC" />
        <ellipse cx="-5" cy="-6" rx="3.4" ry="5" fill="#1E3A8A" transform="rotate(-30)" />
        <ellipse cx="5" cy="-6" rx="3.4" ry="5" fill="#1E3A8A" transform="rotate(30)" />
        <path d="M0 6 C-8 2 -12 6 -14 10 M0 6 C8 2 12 6 14 10" stroke="#1E3A8A" strokeWidth="1" fill="none" />
      </g>
    </svg>
  );
}

/** A bluebonnet sprig: stem, leaves and stacked blooms. */
export function Sprig({ className, height = 240 }: { className?: string; height?: number }) {
  const blooms = [
    [0, 0, 1], [-10, -22, 0.92], [9, -42, 0.86], [-8, -62, 0.8], [7, -80, 0.72], [-5, -97, 0.64], [4, -112, 0.55], [0, -125, 0.45],
  ];
  return (
    <svg className={className} height={height} viewBox="-60 -150 120 260" aria-hidden="true">
      <path d="M0 100 C-4 60 6 20 0 -130" stroke="#1E3A8A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {[-60, -30, 28, 58].map((angle, index) => (
        <path key={angle} transform={`translate(0 ${80 - index * 6}) rotate(${angle})`} d="M0 0 C8 -22 14 -38 5 -62 C-2 -36 -6 -20 0 0Z"
          fill="#8B8CFC" fillOpacity="0.45" stroke="#1E3A8A" strokeWidth="0.8" />
      ))}
      {blooms.map(([x, y, scale], index) => (
        <g key={index} transform={`translate(${x} ${y}) scale(${scale})`}>
          <path d="M2 14 C-16 12 -22 -2 -12 -14 C-4 -20 10 -16 16 -6 C22 2 16 14 4 16Z" fill="#8B8CFC" />
          <path d="M0 10 C-12 8 -16 -2 -8 -10 C-2 -4 6 0 4 10Z" fill="#1E3A8A" />
          <ellipse cx="4" cy="-4" rx="4.2" ry="2.6" fill="#FAF9F3" />
        </g>
      ))}
    </svg>
  );
}

export function Diamond() {
  return <span aria-hidden="true" className="divider-mark">◆</span>;
}
