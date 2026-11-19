type IconProps = { size?: number }

export function BookOpenIcon({ size = 20 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 5.5A2.5 2.5 0 0 1 6 3h4.5v17H6a2.5 2.5 0 0 0-2.5 2.5V5.5Z" /><path d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-4.5v17H18a2.5 2.5 0 0 1 2.5 2.5V5.5Z" /></svg>
}

export function CalendarIcon({ size = 20 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" /><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></svg>
}

export function ListIcon({ size = 20 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
}

export function UsersIcon({ size = 20 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-3.4 2.2-5 5.5-5s5.1 1.6 5.5 5" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17 15c2.2.4 3.4 2 3.7 4.5" /></svg>
}
