async function loadGuide() {
  try {
    const response = await fetch("data/guide.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    return {
      book: { title: "Spoiler-Safe Reading Companion" },
      boundary: { label: "Demo: Chapter 1", through_position: 1 },
      characters: [
        { name: "Example Character", summary: "Known-so-far summaries will appear here after local extraction and approval.", firstSeen: "Chapter 1" },
        { name: "Uncertain Figure", summary: "Ambiguous identities stay ambiguous until the text reveals more.", firstSeen: "Unknown" }
      ],
      factions: ["Example faction entries will be spoiler-gated."],
      mysteries: ["Open questions will be tracked without future-book answers."]
    };
  }
}

function renderGuide(guide) {
  const boundary = guide.boundary?.label || `Through position ${guide.boundary?.through_position ?? "demo"}`;
  document.getElementById("boundary").textContent = boundary;
  document.getElementById("characters").innerHTML = (guide.characters || []).map(c => `
    <article class="card">
      <h3>${c.name}</h3>
      <p>${c.summary || "No spoiler-safe summary yet."}</p>
      <span class="badge">First seen: ${c.firstSeen || c.firstSeenPosition || "unknown"}</span>
    </article>
  `).join("") || `<p>No characters revealed at this boundary yet.</p>`;
  document.getElementById("factions").innerHTML = (guide.factions || []).map(x => `<li>${typeof x === "string" ? x : x.name}</li>`).join("") || `<li>No factions exported yet.</li>`;
  document.getElementById("mysteries").innerHTML = (guide.mysteries || []).map(x => `<li>${typeof x === "string" ? x : x.question}</li>`).join("") || `<li>No open mysteries exported yet.</li>`;
}

loadGuide().then(renderGuide);
