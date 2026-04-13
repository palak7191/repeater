import './Sparkline.css';

export default function Sparkline({ values, height = 60, showAxis = true }) {
  if (!values || values.length < 2) {
    return (
      <div className="sparkline sparkline--empty" style={{ height }}>
        <span>Not enough data</span>
      </div>
    );
  }

  const width = 300;
  const padding = 4;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  // Scale values to SVG coordinates
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = padding + ((max - v) / range) * (height - padding * 2);
    return { x, y, v };
  });

  // Create path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Zero line position
  const zeroY = padding + ((max - 0) / range) * (height - padding * 2);

  // Gradient: green above zero, red below
  const lastValue = values[values.length - 1];
  const isPositive = lastValue >= 0;

  return (
    <div className="sparkline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="sparkline__svg"
      >
        <defs>
          <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--win)" stopOpacity="0.3" />
            <stop offset={`${(zeroY / height) * 100}%`} stopColor="var(--win)" stopOpacity="0.1" />
            <stop offset={`${(zeroY / height) * 100}%`} stopColor="var(--loss)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--loss)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`}
          fill="url(#sparkGradient)"
        />

        {/* Zero line */}
        {showAxis && (
          <line
            x1={padding}
            y1={zeroY}
            x2={width - padding}
            y2={zeroY}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={isPositive ? 'var(--win)' : 'var(--loss)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End dot */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          fill={isPositive ? 'var(--win)' : 'var(--loss)'}
        />
      </svg>

      {/* Value labels */}
      {showAxis && (
        <div className="sparkline__labels">
          <span className="sparkline__label sparkline__label--max positive">
            +${max.toLocaleString()}
          </span>
          <span className={`sparkline__label sparkline__label--current ${isPositive ? 'positive' : 'negative'}`}>
            {lastValue >= 0 ? '+' : ''}${lastValue.toLocaleString()}
          </span>
          {min < 0 && (
            <span className="sparkline__label sparkline__label--min negative">
              ${min.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
