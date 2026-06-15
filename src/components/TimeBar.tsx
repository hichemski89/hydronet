import { useEffect, useRef, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { formatClock } from '../utils/format';

export default function TimeBar() {
  const results = useNetworkStore((s) => s.results);
  const timeIndex = useNetworkStore((s) => s.currentTimeIndex);
  const setTimeIndex = useNetworkStore((s) => s.setCurrentTimeIndex);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  const count = results?.times.length ?? 0;

  useEffect(() => {
    if (!playing || count <= 1) return;
    timer.current = window.setInterval(() => {
      const next = (useNetworkStore.getState().currentTimeIndex + 1) % count;
      setTimeIndex(next);
    }, 700);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, count, setTimeIndex]);

  if (!results || count <= 1) return null;

  const t = results.times[timeIndex] ?? 0;

  return (
    <div className="time-bar">
      <button className="btn btn-sm" onClick={() => setPlaying((p) => !p)}>
        {playing ? '⏸' : '▶'}
      </button>
      <button className="btn btn-sm" onClick={() => setTimeIndex(Math.max(0, timeIndex - 1))}>
        ⏮
      </button>
      <input
        type="range"
        min={0}
        max={count - 1}
        value={timeIndex}
        onChange={(e) => setTimeIndex(parseInt(e.target.value))}
        className="time-slider"
      />
      <button className="btn btn-sm" onClick={() => setTimeIndex(Math.min(count - 1, timeIndex + 1))}>
        ⏭
      </button>
      <span className="time-label">
        {formatClock(t)} <span className="time-sub">({timeIndex + 1}/{count})</span>
      </span>
    </div>
  );
}
