import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "https://linklite-api-ekdk.onrender.com/api");

export default function App() {
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function loadLinks() {
    try {
      setLoadingLinks(true);
      const response = await fetch(`${API_URL}/links`);
      const body = await response.json();

      if (!response.ok) throw new Error(body.message || "Could not load links.");
      setLinks(body.data);
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoadingLinks(false);
    }
  }

  useEffect(() => {
    loadLinks();
  }, []);

  async function createShortLink(event) {
    event.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Paste a URL first.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.message || "Could not shorten URL.");
      }

      setLinks((current) => [body, ...current]);
      setUrl("");
      await copyToClipboard(body.shortUrl, body.shortCode);
    } catch (err) {
      setError(err.message || "Could not shorten URL.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(value, key) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Could not copy automatically. Please copy the link manually.");
    }
  }

  const totalClicks = links.reduce((sum, link) => sum + Number(link.clicks || 0), 0);

  return (
    <div className="app">
      <header className="hero">
        <nav className="nav">
          <div className="logo">
            <span className="logo-mark">↗</span>
            <span>LinkLite</span>
          </div>
          <span className="tag">URL SHORTENER</span>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">SIMPLE. FAST. PERSISTENT.</span>
          <h1>Turn long links into<br /><em>short, shareable URLs.</em></h1>
          <p>Create a short link, share it anywhere, and keep track of every click.</p>

          <form className="shorten-form" onSubmit={createShortLink}>
            <div className="input-wrap">
              <span>🔗</span>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/your-long-url"
                maxLength={2048}
                autoComplete="off"
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Shorten URL"}
            </button>
          </form>

          {error && <div className="error">⚠ {error}</div>}
          {!loading && copied && <div className="success">✓ Short link copied to clipboard</div>}
        </div>
      </header>

      <main className="content">
        <section className="summary">
          <div>
            <span>Total links</span>
            <strong>{links.length}</strong>
          </div>
          <div>
            <span>Total clicks</span>
            <strong>{totalClicks}</strong>
          </div>
          <div>
            <span>Database</span>
            <strong>PostgreSQL</strong>
          </div>
        </section>

        <section className="links-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR LINKS</span>
              <h2>Shortened URLs</h2>
            </div>
            <button className="refresh" onClick={loadLinks} disabled={loadingLinks}>
              {loadingLinks ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          {loadingLinks ? (
            <div className="empty">Loading your links…</div>
          ) : links.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">↗</div>
              <h3>No shortened links yet</h3>
              <p>Paste your first long URL above to get started.</p>
            </div>
          ) : (
            <div className="link-list">
              {links.map((link) => (
                <article className="link-row" key={link.id}>
                  <div className="link-info">
                    <a
                      className="short-url"
                      href={link.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.shortUrl}
                    </a>
                    <span className="original" title={link.originalUrl}>
                      {link.originalUrl}
                    </span>
                  </div>

                  <div className="clicks">
                    <strong>{link.clicks}</strong>
                    <span>click{link.clicks === 1 ? "" : "s"}</span>
                  </div>

                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(link.shortUrl, link.shortCode)}
                  >
                    {copied === link.shortCode ? "Copied!" : "Copy"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>LinkLite · Built with React, Express & PostgreSQL</span>
        <span>Round 1 Assignment</span>
      </footer>
    </div>
  );
}
