"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  background:
    "linear-gradient(135deg, rgba(255,247,237,1) 0%, rgba(255,237,213,1) 45%, rgba(254,215,170,1) 100%)",
  color: "#1f2937",
  fontFamily:
    'Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const wrapperStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 20px",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "720px",
  borderRadius: "32px",
  padding: "40px 32px",
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  border: "1px solid rgba(255, 255, 255, 0.7)",
  boxShadow: "0 24px 60px rgba(251, 146, 60, 0.18)",
  textAlign: "center",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 14px",
  borderRadius: "999px",
  backgroundColor: "#ffedd5",
  color: "#c2410c",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
};

const headingStyle: React.CSSProperties = {
  margin: "18px 0 0",
  fontSize: "clamp(2rem, 5vw, 3.5rem)",
  lineHeight: 1.1,
};

const bodyStyle: React.CSSProperties = {
  margin: "18px auto 0",
  maxWidth: "560px",
  fontSize: "17px",
  lineHeight: 1.7,
  color: "#4b5563",
};

const actionsStyle: React.CSSProperties = {
  marginTop: "32px",
  display: "flex",
  flexWrap: "wrap",
  gap: "14px",
  justifyContent: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "14px",
  padding: "14px 24px",
  backgroundColor: "#ea580c",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #ea580c",
  borderRadius: "14px",
  padding: "14px 24px",
  backgroundColor: "transparent",
  color: "#c2410c",
  fontSize: "16px",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};

const detailsStyle: React.CSSProperties = {
  marginTop: "28px",
  textAlign: "left",
  borderRadius: "18px",
  padding: "16px 18px",
  backgroundColor: "#fff7ed",
  border: "1px solid #fdba74",
};

const preStyle: React.CSSProperties = {
  margin: "12px 0 0",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: "14px",
  lineHeight: 1.6,
  color: "#7c2d12",
};

export default function GlobalError({
  error,
  reset,
}: GlobalErrorProps): React.JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <body style={pageStyle}>
        <main style={wrapperStyle}>
          <section style={cardStyle}>
            <div style={{ fontSize: "54px", lineHeight: 1 }} aria-hidden="true">
              🍲
            </div>
            <span style={badgeStyle}>Critical Error</span>
            <h1 style={headingStyle}>We hit a problem loading the app</h1>
            <p style={bodyStyle}>
              Something went wrong at the application shell level, so this page is
              running in a minimal recovery mode. Please try again or head back to
              the homepage.
            </p>

            <div style={actionsStyle}>
              <button type="button" onClick={() => reset()} style={primaryButtonStyle}>
                Try Again
              </button>
              <a href="/" style={secondaryButtonStyle}>
                Back to Home
              </a>
            </div>

            {isDevelopment && (
              <details style={detailsStyle}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                  Developer Details
                </summary>
                <pre style={preStyle}>{error.message || "No error message provided."}</pre>
                {error.digest ? (
                  <pre style={preStyle}>Digest: {error.digest}</pre>
                ) : null}
              </details>
            )}
          </section>
        </main>
      </body>
    </html>
  );
}
