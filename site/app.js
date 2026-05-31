const demo = {
  boundary: "Demo: Chapter 1",
  characters: [
    { name: "Example Character", summary: "Known-so-far summaries will appear here after local extraction and approval.", firstSeen: "Chapter 1" },
    { name: "Uncertain Figure", summary: "Ambiguous identities stay ambiguous until the text reveals more.", firstSeen: "Unknown" }
  ],
  factions: ["Example faction entries will be spoiler-gated."],
  mysteries: ["Open questions will be tracked without future-book answers."]
};

document.getElementById("boundary").textContent = demo.boundary;
document.getElementById("characters").innerHTML = demo.characters.map(c => `
  <article class="card">
    <h3>${c.name}</h3>
    <p>${c.summary}</p>
    <span class="badge">First seen: ${c.firstSeen}</span>
  </article>
`).join("");
document.getElementById("factions").innerHTML = demo.factions.map(x => `<li>${x}</li>`).join("");
document.getElementById("mysteries").innerHTML = demo.mysteries.map(x => `<li>${x}</li>`).join("");
