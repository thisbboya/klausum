export function AuthBg() {
  return (
    <>
      {/* Gold radial glow behind card */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(244,163,0,0.10) 0%, rgba(244,163,0,0.04) 40%, transparent 70%)",
        }}
      />
      {/* Blue ambient bottom-left */}
      <div
        className="pointer-events-none absolute bottom-[-100px] left-[-100px] z-0 h-[400px] w-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)",
        }}
      />
      {/* Slowly rotating rings */}
      <div
        className="pointer-events-none absolute -right-[100px] -top-[100px] z-0 h-[400px] w-[400px] rounded-full border"
        style={{ borderColor: "rgba(244,163,0,0.07)", animation: "klausumSlowRotate 30s linear infinite" }}
      />
      <div
        className="pointer-events-none absolute bottom-[50px] -left-[80px] z-0 h-[250px] w-[250px] rounded-full border"
        style={{ borderColor: "rgba(59,130,246,0.06)", animation: "klausumSlowRotate 40s linear infinite reverse" }}
      />
      {/* Dot grids */}
      <div
        className="pointer-events-none absolute left-10 top-20 z-0 grid opacity-[0.14]"
        style={{ gridTemplateColumns: "repeat(5, 8px)", gap: "8px" }}
        aria-hidden
      >
        {Array.from({ length: 25 }).map((_, i) => (
          <span key={i} className="block h-[3px] w-[3px] rounded-full bg-[#F4A300]" />
        ))}
      </div>
      <div
        className="pointer-events-none absolute bottom-20 right-10 z-0 grid opacity-[0.14]"
        style={{ gridTemplateColumns: "repeat(5, 8px)", gap: "8px" }}
        aria-hidden
      >
        {Array.from({ length: 25 }).map((_, i) => (
          <span key={i} className="block h-[3px] w-[3px] rounded-full bg-[#F4A300]" />
        ))}
      </div>
    </>
  );
}
