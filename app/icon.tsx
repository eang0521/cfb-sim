import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a4d2e",
          borderRadius: 6,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32">
          <g transform="rotate(-30 16 16)">
            <ellipse cx="16" cy="16" rx="12" ry="7" fill="#8a4a26" stroke="#4a2a12" strokeWidth="1" />
            <line x1="7" y1="16" x2="25" y2="16" stroke="#fff" strokeWidth="1.5" />
            <line x1="11" y1="13.5" x2="11" y2="18.5" stroke="#fff" strokeWidth="1.2" />
            <line x1="14.5" y1="13" x2="14.5" y2="19" stroke="#fff" strokeWidth="1.2" />
            <line x1="18" y1="13" x2="18" y2="19" stroke="#fff" strokeWidth="1.2" />
            <line x1="21" y1="13.5" x2="21" y2="18.5" stroke="#fff" strokeWidth="1.2" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
