export default function CampusBuilding({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', margin: '0 auto 1.5rem' }}
    >
      {/* Ground shadow */}
      <ellipse cx="60" cy="108" rx="50" ry="4" fill="rgba(207,184,124,0.08)" />

      {/* Left wing */}
      <rect x="10" y="52" width="28" height="54" rx="2" fill="#1a1a1a" stroke="#CFB87C" strokeWidth="1.5" />
      {/* Left wing windows */}
      <rect x="16" y="58" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.25" />
      <rect x="26" y="58" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.25" />
      <rect x="16" y="72" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.18" />
      <rect x="26" y="72" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.18" />
      <rect x="16" y="86" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.12" />
      <rect x="26" y="86" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.12" />

      {/* Right wing */}
      <rect x="82" y="52" width="28" height="54" rx="2" fill="#1a1a1a" stroke="#CFB87C" strokeWidth="1.5" />
      {/* Right wing windows */}
      <rect x="88" y="58" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.25" />
      <rect x="98" y="58" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.25" />
      <rect x="88" y="72" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.18" />
      <rect x="98" y="72" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.18" />
      <rect x="88" y="86" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.12" />
      <rect x="98" y="86" width="6" height="8" rx="1" fill="#CFB87C" opacity="0.12" />

      {/* Center building */}
      <rect x="30" y="38" width="60" height="68" rx="2" fill="#141414" stroke="#CFB87C" strokeWidth="1.5" />

      {/* Center windows row 1 */}
      <rect x="38" y="46" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.3" />
      <rect x="50" y="46" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.3" />
      <rect x="62" y="46" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.3" />
      <rect x="74" y="46" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.3" />

      {/* Center windows row 2 */}
      <rect x="38" y="62" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.22" />
      <rect x="50" y="62" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.22" />
      <rect x="62" y="62" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.22" />
      <rect x="74" y="62" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.22" />

      {/* Center windows row 3 */}
      <rect x="38" y="78" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.15" />
      <rect x="50" y="78" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.15" />
      <rect x="62" y="78" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.15" />
      <rect x="74" y="78" width="7" height="9" rx="1.5" fill="#CFB87C" opacity="0.15" />

      {/* Front door */}
      <rect x="52" y="92" width="16" height="14" rx="2" fill="#0a0a0a" stroke="#CFB87C" strokeWidth="1" />
      <rect x="54" y="92" width="12" height="3" rx="1" fill="#CFB87C" opacity="0.2" />

      {/* Tower / cupola */}
      <rect x="50" y="18" width="20" height="22" rx="2" fill="#1a1a1a" stroke="#CFB87C" strokeWidth="1.5" />
      {/* Tower window */}
      <rect x="55" y="24" width="10" height="10" rx="5" fill="#CFB87C" opacity="0.35" />

      {/* Spire */}
      <polygon points="60,4 54,18 66,18" fill="#CFB87C" opacity="0.9" />

      {/* Pediment / triangular top on main building */}
      <polygon points="60,28 32,40 88,40" fill="#141414" stroke="#CFB87C" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Columns */}
      <rect x="40" y="40" width="3" height="12" rx="1" fill="#CFB87C" opacity="0.2" />
      <rect x="52" y="40" width="3" height="12" rx="1" fill="#CFB87C" opacity="0.2" />
      <rect x="65" y="40" width="3" height="12" rx="1" fill="#CFB87C" opacity="0.2" />
      <rect x="77" y="40" width="3" height="12" rx="1" fill="#CFB87C" opacity="0.2" />

      {/* Steps */}
      <rect x="44" y="106" width="32" height="3" rx="1" fill="#1e1e1e" stroke="#CFB87C" strokeWidth="0.5" opacity="0.5" />
      <rect x="48" y="103" width="24" height="3" rx="1" fill="#1e1e1e" stroke="#CFB87C" strokeWidth="0.5" opacity="0.4" />
    </svg>
  );
}
