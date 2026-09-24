import "./Mascot.css";

export type MascotMood = "neutral" | "happy" | "confirmed";

export function Mascot({
  mood = "neutral",
  size = 40,
  float = true,
}: {
  mood?: MascotMood;
  size?: number;
  float?: boolean;
}) {
  const face = { stroke: "var(--mascot-face)", strokeWidth: 2.2, strokeLinecap: "round", fill: "none" } as const;
  return (
    <svg
      className={float ? "mascot is-floating" : "mascot"}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path d="M20 3c9 0 16 6 16 15.5S30 35 20 35 3 27 3 18.5 11 3 20 3z" fill="var(--mascot)" />
      {mood === "happy" ? (
        <path d="M12.5 17.5q2.5-3 5 0M22.5 17.5q2.5-3 5 0" {...face} />
      ) : (
        <>
          <circle cx="15" cy="17" r="2.4" fill="var(--mascot-face)" />
          <circle cx="25" cy="17" r="2.4" fill="var(--mascot-face)" />
        </>
      )}
      {mood === "confirmed" ? (
        <path d="M15 24l3.5 3.5L26 20" {...face} strokeWidth={2.6} strokeLinejoin="round" />
      ) : (
        <path d="M14 24c2.5 3 9.5 3 12 0" {...face} />
      )}
    </svg>
  );
}
