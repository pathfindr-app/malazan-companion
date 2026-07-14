const fallbackGuide = {
  book: { title: "Gardens of the Moon", author: "Steven Erikson" },
  boundary: { through_position: 16, chapter: "Chapter One" },
  characters: [
    { name: "Example Character", summary: "Known-so-far summaries will appear here after local extraction and approval.", firstSeen: "Chapter One", confidence: 0.7 }
  ],
  factions: ["Example faction entries will be spoiler-gated."],
  mysteries: ["Open questions will be tracked without future-book answers."]
};

const state = {
  guide: fallbackGuide,
  query: "",
  activeIndex: 0,
  visibleCharacters: []
};

const $ = (selector) => document.querySelector(selector);
const stack = $("#character-stack");
const searchInput = $("#guide-search");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value = "") {
  return String(value).toLowerCase().trim();
}

function toTitleCase(value = "") {
  return String(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function chapterLabel(boundary = {}) {
  if (boundary.chapter) return boundary.chapter;
  if (boundary.label && !/position/i.test(boundary.label)) return boundary.label;

  const position = Number(boundary.through_position ?? boundary.position);
  if (position === 16) return "Chapter One";
  if (position === 17) return "Chapter Two";
  if (position === 18) return "Chapter Three";
  if (position === 19) return "Chapter Four";
  if (Number.isFinite(position)) return `reading position ${position}`;
  return "current chapter";
}

function technicalBoundary(boundary = {}) {
  const position = boundary.through_position ?? boundary.position;
  if (position) return `EPUB source position ${position} · translated into a chapter label`;
  return "Chapter label shown instead of raw source indexing";
}

const GUIDE_DATA_URL = "data/guide.json?v=20260714-chapter-four-web-v2";

async function loadGuide() {
  try {
    const response = await fetch(GUIDE_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Using fallback guide data", error);
    return fallbackGuide;
  }
}

function characterHaystack(character) {
  return normalize([
    character.name,
    character.summary,
    Array.isArray(character.aliases) ? character.aliases.join(" ") : character.aliases,
    character.firstSeen,
    character.firstSeenPosition,
    character.type
  ].filter(Boolean).join(" "));
}

function applyFilter() {
  const query = normalize(state.query);
  const characters = state.guide.characters || [];
  state.visibleCharacters = query
    ? characters
        .filter((character) => characterHaystack(character).includes(query))
        .sort((a, b) => {
          const aName = normalize(a.name);
          const bName = normalize(b.name);
          const aScore = aName === query ? 0 : aName.startsWith(query) ? 1 : aName.includes(query) ? 2 : 3;
          const bScore = bName === query ? 0 : bName.startsWith(query) ? 1 : bName.includes(query) ? 2 : 3;
          return aScore - bScore || aName.localeCompare(bName);
        })
    : characters;

  if (state.activeIndex >= state.visibleCharacters.length) state.activeIndex = 0;
  if (state.activeIndex < 0) state.activeIndex = 0;
}

function confidenceLabel(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return "uncertain";
  if (confidence >= 0.88) return "high confidence";
  if (confidence >= 0.72) return "medium confidence";
  return "tentative";
}

function confidenceDots(value) {
  const confidence = Number(value);
  const lit = Number.isFinite(confidence) ? Math.max(1, Math.round(confidence * 5)) : 2;
  return Array.from({ length: 5 }, (_, index) => `<span class="${index < lit ? "active" : ""}"></span>`).join("");
}

function characterFirstSeen(character) {
  return character.firstSeen || (character.firstSeenPosition ? `Position ${character.firstSeenPosition}` : "Unknown");
}

function focusCardTemplate(character) {
  const firstSeen = characterFirstSeen(character);
  const initial = escapeHtml((character.name || "?").slice(0, 1));
  const image = character.image
    ? `<figure class="character-portrait"><img src="${escapeHtml(character.image)}" alt="Spoiler-safe portrait of ${escapeHtml(character.name)}" loading="eager" decoding="async" /></figure>`
    : `<div class="sigel" aria-hidden="true">${initial}</div>`;

  return `
    <article class="character-card" aria-live="polite">
      ${image}
      <div class="card-body">
        <div class="card-meta">
          <span class="badge">Revealed: ${escapeHtml(toTitleCase(firstSeen))}</span>
          <span class="badge">${escapeHtml(confidenceLabel(character.confidence))}</span>
        </div>
        <h3>${escapeHtml(character.name)}</h3>
        <p>${escapeHtml(character.summary || "No spoiler-safe summary yet.")}</p>
        <div class="proximity-row">
          <span>Known-so-far clarity</span>
          <span class="proximity-dots" aria-hidden="true">${confidenceDots(character.confidence)}</span>
        </div>
      </div>
    </article>
  `;
}

function railItemTemplate(character, index) {
  const active = index === state.activeIndex;
  const firstSeen = characterFirstSeen(character);
  return `
    <button class="rail-card" type="button" data-card-index="${index}" aria-current="${active ? "true" : "false"}">
      <span class="rail-name">${escapeHtml(character.name)}</span>
      <span class="rail-meta">${escapeHtml(toTitleCase(firstSeen))}</span>
    </button>
  `;
}

function renderStack() {
  applyFilter();
  const characters = state.visibleCharacters;
  const total = characters.length;
  $("#deck-count").textContent = state.query
    ? `${total} matching ${total === 1 ? "entry" : "entries"}`
    : `${total} revealed entries · pick from the rail`;

  if (!total) {
    stack.innerHTML = `<div class="empty-state"><div><strong>No match inside the current boundary.</strong><br />Try a character, faction, or mystery from Chapter One.</div></div>`;
    $("#card-progress").textContent = "0 / 0";
    return;
  }

  stack.innerHTML = `
    <div class="focus-card-wrap">
      ${focusCardTemplate(characters[state.activeIndex])}
    </div>
    <div class="character-rail" aria-label="Character picker">
      ${characters.map(railItemTemplate).join("")}
    </div>
  `;
  $("#card-progress").textContent = `${state.activeIndex + 1} / ${total}`;
  bindRailEvents();
  requestAnimationFrame(centerActiveRailCard);
}

function centerActiveRailCard() {
  const rail = stack.querySelector(".character-rail");
  const active = stack.querySelector('.rail-card[aria-current="true"]');
  if (!rail || !active) return;
  const targetLeft = active.offsetLeft - (rail.clientWidth - active.clientWidth) / 2;
  rail.scrollLeft = Math.max(0, targetLeft);
}

function selectCard(index) {
  applyFilter();
  if (index < 0 || index >= state.visibleCharacters.length) return;
  state.activeIndex = index;
  renderStack();
}

function bindRailEvents() {
  stack.querySelectorAll(".rail-card").forEach((button) => {
    button.addEventListener("click", () => selectCard(Number(button.dataset.cardIndex || 0)));
  });
}

function graphCategoryLabel(category = "contact") {
  const labels = {
    lineage: "Lineage / household",
    command: "Command / authority",
    mystery: "Open mystery",
    faction: "Faction tie",
    bond: "Personal bond",
    service: "Service / household",
    contact: "Direct contact",
    uncertain: "Uncertain mention"
  };
  return labels[category] || toTitleCase(category);
}

function nodeTypeFor(name, guide) {
  if ((guide.characters || []).some((character) => character.name === name)) return "character";
  if ((guide.factions || []).some((faction) => (typeof faction === "string" ? faction : faction.name) === name)) return "faction";
  return "concept";
}

function buildRelationshipGraph(guide) {
  const relationships = guide.relationships || [];
  const nodeMap = new Map();
  relationships.forEach((relationship) => {
    [relationship.source, relationship.target].forEach((name) => {
      if (!name || nodeMap.has(name)) return;
      nodeMap.set(name, {
        id: name,
        label: name,
        type: nodeTypeFor(name, guide),
        links: 0
      });
    });
  });
  relationships.forEach((relationship) => {
    const source = nodeMap.get(relationship.source);
    const target = nodeMap.get(relationship.target);
    if (source) source.links += 1;
    if (target) target.links += 1;
  });
  return { nodes: Array.from(nodeMap.values()), relationships };
}

function graphNodePosition(node, index, total) {
  const featured = {
    "House Paran": [16, 16],
    "Tavore Paran": [30, 14],
    "Garnet": [18, 25],
    "Ganoes Paran": [42, 22],
    "Topper": [54, 14],
    "Toc the Younger": [51, 27],
    "Claw": [66, 18],
    "Lorn": [64, 35],
    "Laseen": [82, 18],
    "Malazan Empire": [75, 30],
    "Unnamed Itko Kan captain": [78, 43],
    "Aragan": [70, 53],

    "Sorry": [52, 47],
    "Sorry — Bridgeburner recruit": [60, 55],
    "Rigga": [43, 38],
    "Fishergirl's father": [56, 38],
    "Ammanas": [40, 62],
    "Cotillion": [52, 65],
    "Shadowthrone": [64, 67],
    "Gear": [70, 57],
    "Oponn": [42, 33],
    "Hood's servant": [34, 34],

    "Bridgeburners": [80, 62],
    "Whiskeyjack": [26, 51],
    "Quick Ben": [24, 42],
    "Kalam": [17, 48],
    "Fiddler": [18, 35],
    "Hedge": [25, 32],
    "Mallet": [33, 28],
    "Trotts": [42, 26],
    "Picker": [54, 35],
    "Antsy": [59, 40],
    "Dujek Onearm": [74, 74],
    "Onearm's Host": [84, 79],

    "Tattersail": [47, 77],
    "2nd Army": [36, 80],
    "Calot": [39, 69],
    "Hairlock": [55, 75],
    "Tayschrenn": [62, 84],
    "Nightchill": [73, 84],
    "Bellurdan": [80, 91],
    "A'Karonys": [89, 84],

    "Anomander Rake": [21, 73],
    "Moon's Spawn": [13, 65],
    "Tiste Andii": [13, 83],
    "Caladan Brood": [27, 90],
    "Crimson Guard": [39, 92],
    "Dancer": [56, 93],
    "Mock": [68, 92],
    "Dassem Ultor": [78, 88],
    "House Shadow": [73, 63],
    "High House Death": [32, 43],
    "Moranth": [91, 58],
    "Darujhistan": [92, 45]
  };
  if (featured[node.id]) return featured[node.id];
  const angle = (-90 + (360 / Math.max(total, 1)) * index) * (Math.PI / 180);
  const radius = node.type === "faction" ? 41 : 34;
  return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
}

function relationshipDetailTemplate(relationship) {
  if (!relationship) {
    return `<strong>Click a node or line.</strong><p>The web grows as new chapters add spoiler-gated relationships, lineage, command ties, faction links, and open mysteries.</p>`;
  }
  return `
    <strong>${escapeHtml(relationship.source)} ↔ ${escapeHtml(relationship.target)}</strong>
    <span>${escapeHtml(graphCategoryLabel(relationship.category))} · ${escapeHtml(relationship.kind || "known-so-far link")}</span>
    <p>${escapeHtml(relationship.summary || "Known-so-far relationship through the current boundary.")}</p>
  `;
}

function renderRelationshipMap(guide) {
  const map = $("#relationship-map");
  const detail = $("#map-detail");
  const count = $("#map-count");
  if (!map || !detail || !count) return;

  const { nodes, relationships } = buildRelationshipGraph(guide);
  const positions = new Map(nodes.map((node, index) => [node.id, graphNodePosition(node, index, nodes.length)]));
  count.textContent = `${nodes.length} nodes · ${relationships.length} spoiler-safe links`;

  if (!relationships.length) {
    map.innerHTML = `<div class="empty-state"><div><strong>No relationships exported yet.</strong><br />The map will fill as chapter data expands.</div></div>`;
    detail.innerHTML = relationshipDetailTemplate();
    return;
  }

  const lines = relationships.map((relationship, index) => {
    const source = positions.get(relationship.source);
    const target = positions.get(relationship.target);
    if (!source || !target) return "";
    const confidence = Number(relationship.confidence ?? 0.7);
    const uncertain = confidence < 0.72 || relationship.category === "mystery" || relationship.category === "uncertain";
    return `<button class="map-edge map-edge-${escapeHtml(relationship.category || "contact")}" data-link-index="${index}" style="--x1:${source[0]};--y1:${source[1]};--x2:${target[0]};--y2:${target[1]};--alpha:${Math.max(0.38, Math.min(0.95, confidence)).toFixed(2)}" aria-label="${escapeHtml(relationship.source)} to ${escapeHtml(relationship.target)}: ${escapeHtml(relationship.kind || "relationship")}"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${source[0]}" y1="${source[1]}" x2="${target[0]}" y2="${target[1]}" class="${uncertain ? "uncertain" : ""}" /></svg></button>`;
  }).join("");

  const nodeButtons = nodes.map((node, index) => {
    const [x, y] = positions.get(node.id);
    const size = Math.min(1.34, 0.84 + node.links * 0.08);
    return `<button class="map-node map-node-${node.type}" data-node-name="${escapeHtml(node.id)}" style="--x:${x};--y:${y};--node-scale:${size.toFixed(2)}" aria-label="Show links for ${escapeHtml(node.label)}"><span>${escapeHtml(node.label)}</span><em>${node.links}</em></button>`;
  }).join("");

  map.innerHTML = `<div class="map-canvas"><div class="map-veil" aria-hidden="true"></div>${lines}${nodeButtons}</div>`;
  detail.innerHTML = relationshipDetailTemplate(relationships[0]);

  map.querySelectorAll(".map-edge").forEach((button) => {
    button.addEventListener("click", () => {
      const relationship = relationships[Number(button.dataset.linkIndex || 0)];
      detail.innerHTML = relationshipDetailTemplate(relationship);
      map.querySelectorAll(".map-edge, .map-node").forEach((element) => element.classList.remove("is-selected", "is-related"));
      button.classList.add("is-selected");
      [relationship.source, relationship.target].forEach((name) => {
        map.querySelector(`.map-node[data-node-name="${CSS.escape(name)}"]`)?.classList.add("is-related");
      });
    });
  });

  map.querySelectorAll(".map-node").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.nodeName || "";
      const related = relationships.filter((relationship) => relationship.source === name || relationship.target === name);
      map.querySelectorAll(".map-edge, .map-node").forEach((element) => element.classList.remove("is-selected", "is-related"));
      button.classList.add("is-selected");
      related.forEach((relationship) => {
        const linkIndex = relationships.indexOf(relationship);
        map.querySelector(`.map-edge[data-link-index="${linkIndex}"]`)?.classList.add("is-related");
      });
      const characterIndex = (state.guide.characters || []).findIndex((character) => character.name === name);
      if (characterIndex >= 0) {
        state.query = "";
        searchInput.value = "";
        state.visibleCharacters = state.guide.characters || [];
        state.activeIndex = characterIndex;
        renderStack();
      }
      detail.innerHTML = related.length
        ? `<strong>${escapeHtml(name)}</strong><span>${related.length} known-so-far ${related.length === 1 ? "connection" : "connections"}</span>${related.slice(0, 4).map((relationship) => `<p>${escapeHtml(relationship.source === name ? relationship.target : relationship.source)} — ${escapeHtml(relationship.kind || graphCategoryLabel(relationship.category))}</p>`).join("")}`
        : `<strong>${escapeHtml(name)}</strong><p>No exported relationships yet.</p>`;
    });
  });
}

function renderBoundary(guide) {
  const chapter = chapterLabel(guide.boundary || {});
  $("#boundary-title").textContent = `Through ${chapter}`;
  $("#boundary-explainer").textContent = `Showing people, factions, and questions known by the end of ${chapter}.`;
  $("#boundary-technical").textContent = technicalBoundary(guide.boundary || {});
  $("#safe-status").textContent = `Spoiler gate: ${chapter}`;
}

function factionTemplate(item) {
  const name = typeof item === "string" ? item : item.name;
  const summary = typeof item === "string" ? "Revealed by the current chapter boundary." : (item.summary || "Revealed by the current chapter boundary.");
  return `<article class="rune-item"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(summary)}</p></article>`;
}

function mysteryTemplate(item, index) {
  const question = typeof item === "string" ? item : (item.question || item.name || "Open question");
  return `<article class="mystery-item"><strong>Mystery ${index + 1}</strong><p>${escapeHtml(question)}</p></article>`;
}

function renderSideRail(guide) {
  const factions = guide.factions || [];
  const mysteries = guide.mysteries || guide.open_questions || [];

  $("#faction-count").textContent = `${factions.length}`;
  $("#mystery-count").textContent = `${mysteries.length}`;
  $("#factions").innerHTML = factions.map(factionTemplate).join("") || `<p>No factions exported yet.</p>`;
  $("#mysteries").innerHTML = mysteries.map(mysteryTemplate).join("") || `<p>No mysteries exported yet.</p>`;
}

function visualReferenceTemplate(item) {
  const name = item.name || "Visual reference";
  const category = item.category || item.type || "Known-so-far reference";
  const firstSeen = item.firstSeen || "Current boundary";
  const image = item.image
    ? `<figure class="reference-art"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt || `Spoiler-safe reference for ${name}`)}" loading="eager" decoding="async" /></figure>`
    : "";

  return `
    <article class="reference-card">
      ${image}
      <div class="reference-copy">
        <div class="card-meta">
          <span class="badge">${escapeHtml(category)}</span>
          <span class="badge">Revealed: ${escapeHtml(toTitleCase(firstSeen))}</span>
        </div>
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(item.summary || "Spoiler-safe visual reference through the current boundary.")}</p>
      </div>
    </article>
  `;
}

function renderVisualReferences(guide) {
  const references = guide.visualReferences || [];
  const count = $("#reference-count");
  const target = $("#visual-references");
  if (!count || !target) return;
  count.textContent = `${references.length} ${references.length === 1 ? "reference" : "references"}`;
  target.innerHTML = references.map(visualReferenceTemplate).join("") || `<p>No object or place references exported yet.</p>`;
}

function moveCard(delta) {
  applyFilter();
  const total = state.visibleCharacters.length;
  if (!total) return;
  state.activeIndex = (state.activeIndex + delta + total) % total;
  renderStack();
}

function bindInteractions() {
  $("#prev-card").addEventListener("click", () => moveCard(-1));
  $("#next-card").addEventListener("click", () => moveCard(1));
  $("#clear-search").addEventListener("click", () => {
    searchInput.value = "";
    state.query = "";
    state.activeIndex = 0;
    renderStack();
    searchInput.focus();
  });
  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.activeIndex = 0;
    renderStack();
  });

  window.addEventListener("keydown", (event) => {
    if (event.target === searchInput) return;
    if (event.key === "ArrowLeft") moveCard(-1);
    if (event.key === "ArrowRight") moveCard(1);
    if (event.key === "/") {
      event.preventDefault();
      searchInput.focus();
    }
  });

  let touchStartX = 0;
  stack.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0]?.clientX || 0;
  }, { passive: true });
  stack.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches[0]?.clientX || 0;
    const delta = touchEndX - touchStartX;
    if (Math.abs(delta) > 44) moveCard(delta > 0 ? -1 : 1);
  }, { passive: true });
}

function renderGuide(guide) {
  state.guide = guide;
  state.activeIndex = 0;
  renderBoundary(guide);
  renderRelationshipMap(guide);
  renderStack();
  renderSideRail(guide);
  renderVisualReferences(guide);
}

bindInteractions();
loadGuide().then(renderGuide);
