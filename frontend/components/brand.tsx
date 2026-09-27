/** Official mark, served unchanged from /BlueBonnet.jpeg. */
export function Monogram({ size = 64 }: { size?: number }) {
  return <img src="/BlueBonnet.jpeg" alt="" height={size} />;
}

/** A bluebonnet sprig: stem, leaves and stacked blooms. */
export function Sprig({ className, height = 240 }: { className?: string; height?: number }) {
  const blooms = [
    [0, 0, 1], [-10, -22, 0.92], [9, -42, 0.86], [-8, -62, 0.8], [7, -80, 0.72], [-5, -97, 0.64], [4, -112, 0.55], [0, -125, 0.45],
  ];
  return (
    <svg className={className} height={height} viewBox="-60 -150 120 260" aria-hidden="true">
      <path d="M0 100 C-4 60 6 20 0 -130" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {[-60, -30, 28, 58].map((angle, index) => (
        <path key={angle} transform={`translate(0 ${80 - index * 6}) rotate(${angle})`} d="M0 0 C8 -22 14 -38 5 -62 C-2 -36 -6 -20 0 0Z"
          fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="0.8" />
      ))}
      {blooms.map(([x, y, scale], index) => (
        <g key={index} transform={`translate(${x} ${y}) scale(${scale})`}>
          <path d="M2 14 C-16 12 -22 -2 -12 -14 C-4 -20 10 -16 16 -6 C22 2 16 14 4 16Z" fill="#7953ff" />
          <path d="M0 10 C-12 8 -16 -2 -8 -10 C-2 -4 6 0 4 10Z" fill="#1c1cff" />
          <ellipse cx="4" cy="-4" rx="4.2" ry="2.6" fill="#bd88ff" />
        </g>
      ))}
    </svg>
  );
}

export function Diamond() {
  return <span aria-hidden="true" className="divider-mark">◆</span>;
}
