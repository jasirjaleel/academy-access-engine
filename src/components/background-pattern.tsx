// Our own 8-point star (khatam) tile pattern + soft glows. See docs/DESIGN.md → Background.
export function BackgroundPattern() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-midnight">
      <svg className="absolute inset-0 h-full w-full opacity-[0.04]">
        <defs>
          <pattern id="khatam" width="56" height="56" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="white" strokeWidth="1">
              <rect x="16" y="16" width="24" height="24" />
              <rect x="16" y="16" width="24" height="24" transform="rotate(45 28 28)" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#khatam)" />
      </svg>
      <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-dusk/5 blur-[120px]" />
      <div className="absolute -bottom-40 right-1/4 h-[600px] w-[600px] rounded-full bg-teal/30 blur-[100px]" />
    </div>
  );
}
