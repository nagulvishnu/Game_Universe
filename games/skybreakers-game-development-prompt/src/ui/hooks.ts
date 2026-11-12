import { useEffect, useState } from 'react';
export function useTick(ms = 100) { const [, set] = useState(0); useEffect(() => { const i = setInterval(() => set(x => (x + 1) % 1e9), ms); return () => clearInterval(i); }, [ms]); }
