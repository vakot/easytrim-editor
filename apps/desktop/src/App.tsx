import "./App.css";

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Local video editor</p>
        <h1>Easy Cut</h1>
        <p className="summary">Fast, focused video trimming powered by FFmpeg.</p>
      </header>

      <section className="foundation" aria-labelledby="foundation-title">
        <div className="status-mark" aria-hidden="true" />
        <div>
          <h2 id="foundation-title">Desktop foundation ready</h2>
          <p>
            React, TypeScript, Vite, Rust, and Tauri are connected and ready for the media workflow.
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
