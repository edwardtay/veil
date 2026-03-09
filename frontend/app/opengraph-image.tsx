import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Veil — Private Payments, Full Compliance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(145deg, #09090b 0%, #0c0a0f 40%, #18181b 100%)",
          position: "relative",
        }}
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(212,175,55,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Gold radial glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "500px",
            background: "radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            position: "relative",
          }}
        >
          {/* Protocol label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "rgba(212,175,55,0.7)",
              fontSize: "14px",
              fontFamily: "monospace",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}
          >
            Privacy Protocol on Starknet
          </div>

          {/* Name */}
          <div
            style={{
              fontSize: "96px",
              fontWeight: 400,
              color: "#fafafa",
              fontFamily: "serif",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            Veil
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "28px",
              color: "#a1a1aa",
              maxWidth: "700px",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            Private Payments. Full Compliance.
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "40px",
              marginTop: "16px",
            }}
          >
            {[
              { value: "BTC-Backed", label: "Collateral" },
              { value: "ZK Proofs", label: "Groth16 BN254" },
              { value: "ASP Gated", label: "Compliance" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "rgba(212,175,55,0.9)",
                    fontFamily: "monospace",
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#71717a",
                    fontFamily: "monospace",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            color: "#52525b",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        >
          <span>veil-app-three.vercel.app</span>
          <span style={{ color: "#3f3f46" }}>·</span>
          <span>Starknet Sepolia</span>
          <span style={{ color: "#3f3f46" }}>·</span>
          <span>Live with 10 deposits</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
