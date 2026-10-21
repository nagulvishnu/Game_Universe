interface IconProps {
  className?: string;
  color?: string;
}

export function KeyIcon({ color = '#d4a72c', className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="5.2" />
      <circle cx="9" cy="9" r="1.6" fill={color} />
      <path d="M13 13 L27 27" />
      <path d="M22 22 l3.2 -3.2" />
      <path d="M26 26 l3 -3" />
    </svg>
  );
}

export function PadlockIcon({ color = '#d9534f', className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="14" width="20" height="14" rx="2.5" />
      <path d="M10 14 V10 a6 6 0 0 1 12 0 V14" />
      <circle cx="16" cy="21" r="2" fill={color} />
    </svg>
  );
}

export function BottleIcon({ color = '#5fbf7a', className = 'h-8 w-8' }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3 h6 v6 c0 3 4 4 4 9 v9 a2 2 0 0 1 -2 2 h-10 a2 2 0 0 1 -2 -2 v-9 c0 -5 4 -6 4 -9 z" />
      <path d="M10 19 h12" />
    </svg>
  );
}

export function EarIcon({ color = '#aaa', className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9 a6 6 0 0 1 12 0 c0 3 -2 4 -3 6 s-1 5 -4 5 s-3 -2 -3 -3" />
      <path d="M10 9 a2 2 0 0 1 4 0 c0 1.4 -1.2 1.8 -1.6 2.6" />
    </svg>
  );
}

export function TorchIcon({ color = '#ffe9a8', className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 h8 l-1 5 h-6 z" />
      <path d="M9 8 v3 l-1 2 v8 h8 v-8 l-1 -2 v-3" />
      <path d="M12 14 v3" />
    </svg>
  );
}

export function SkullIcon({ color = '#c92a2a', className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} stroke="none">
      <path d="M12 2 C6.5 2 3 6 3 10.5 c0 3 1.4 4.8 3.2 5.9 V20 a1 1 0 0 0 1 1 h2 v-2 h1.3 v2 h2.9 v-2 H14.7 v2 h2 a1 1 0 0 0 1 -1 v-3.6 C19.6 15.300 21 13.500 21 10.5 C21 6 17.500 2 12 2 z M8.500 9 a2 2 0 1 1 0 4 a2 2 0 0 1 0 -4 z m7 0 a2 2 0 1 1 0 4 a2 2 0 0 1 0 -4 z M12 13.500 l1.200 2.300 h-2.400 z" fillRule="evenodd" />
    </svg>
  );
}
