/** The onboarding character from the design handoff. The in-app blob stays until the mascot is final. */
export function OnboardingMascot({ size = 76 }: { size?: number }) {
  const shade = "rgba(0,0,0,0.24)";
  return (
    <svg className="ob-mascot" width={size} height={size * 1.3} viewBox="0 0 100 130" aria-hidden="true">
      <path d="M24 68c-7 4-9 13-4.5 19 3.2 4.3 9.5 4.3 12.7 0" fill="var(--mascot)" />
      <path d="M76 68c7 4 9 13 4.5 19-3.2 4.3-9.5 4.3-12.7 0" fill="var(--mascot)" />
      <ellipse cx="39" cy="92" rx="6" ry="4" fill="var(--mascot)" />
      <ellipse cx="61" cy="92" rx="6" ry="4" fill="var(--mascot)" />
      <path d="M34 22h32c9 0 15 7 15 16v28c0 12-13 20-31 20s-31-8-31-20V38c0-9 6-16 15-16z" fill="var(--mascot)" />
      <path d="M46 22l4-9 4 9z" fill="var(--mascot)" />
      <path d="M24 46c8-4 44-4 52 0 2 1 2 7 0 8-8 4-44 4-52 0-2-1-2-7 0-8z" fill={shade} />
      <path d="M74 47l11-7-2 11z" fill={shade} />
      <path d="M75 51l12 3-7 9z" fill={shade} />
      <circle cx="40" cy="50" r="3.6" fill="#fff" />
      <circle cx="60" cy="50" r="3.6" fill="#fff" />
      <path d="M36 60c5 6 23 6 28 0" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
