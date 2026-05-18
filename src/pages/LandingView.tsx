import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const LandingView = () => {
  const { id } = useParams<{ id: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-landing-page?id=${id}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.text();
      })
      .then(setHtml)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load landing page"));
  }, [id]);

  if (error) {
    return (
      <div style={{ fontFamily: "system-ui", padding: 48, textAlign: "center" }}>
        <h1>Landing page unavailable</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div style={{ fontFamily: "system-ui", padding: 48, textAlign: "center" }}>
        Loading…
      </div>
    );
  }

  return (
    <iframe
      title="Landing Page"
      srcDoc={html}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: 0 }}
      sandbox="allow-forms allow-popups allow-scripts allow-same-origin"
    />
  );
};

export default LandingView;
