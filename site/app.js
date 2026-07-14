const fallbackGuide = {
  book: { title: "Gardens of the Moon", author: "Steven Erikson" },
  boundary: { through_position: 16, chapter: "Chapter One" },
  characters: [
    { name: "Example Character", summary: "Known-so-far summaries will appear here after local extraction and approval.", firstSeen: "Chapter One", confidence: 0.7 }
  ],
  factions: ["Example faction entries will be spoiler-gated."],
  mysteries: ["Open questions will be tracked without future-book answers."],
  relationships: [],
  visualReferences: []
};

const GUIDE_DATA_URL = "data/guide.json?v=20260714-atlas-overhaul";

const state = {
  guide: fallbackGuide,
  query: "",
  graphQuery: "",
  graphFilter: "spotlight",
  atlasFilter: "all",
  activeIndex: 0,
  visibleCharacters: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const stack = $("#character-stack");
const searchInput = $("#guide-search");
const graphInput = $("#graph-search");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value = "") { return String(value).toLowerCase().trim(); }
function toTitleCase(value = "") { return String(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function slug(value = "") { return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

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
    Array.isArray(character.snapshots) ? character.snapshots.map((s) => `${s.label} ${s.summary} ${s.image}`).join(" ") : "",
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
          const names = (c) => [c.name, ...(Array.isArray(c.aliases) ? c.aliases : [])].map(normalize);
          const score = (c) => {
            const all = names(c);
            if (all.some((name) => name === query)) return 0;
            if (all.some((name) => name.startsWith(query))) return 1;
            if (normalize(c.name).includes(query)) return 2;
            return 3;
          };
          return score(a) - score(b) || normalize(a.name).localeCompare(normalize(b.name));
        })
    : characters;

  if (state.activeIndex >= state.visibleCharacters.length) state.activeIndex = 0;
  if (state.activeIndex < 0) state.activeIndex = 0;
}

function clarityLabel(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return "reader uncertainty";
  if (confidence >= 0.88) return "clear enough for now";
  if (confidence >= 0.72) return "partly veiled";
  return "deeply uncertain";
}

function clarityDots(value) {
  const confidence = Number(value);
  const lit = Number.isFinite(confidence) ? Math.max(1, Math.round(confidence * 5)) : 2;
  return Array.from({ length: 5 }, (_, index) => `<span class="${index < lit ? "active" : ""}"></span>`).join("");
}

function characterFirstSeen(character) {
  return character.firstSeen || (character.firstSeenPosition ? `Position ${character.firstSeenPosition}` : "Unknown");
}

function snapshotsFor(character) {
  const base = [{
    label: character.firstSeen || "First revealed",
    title: character.name,
    summary: character.summary || "Known-so-far summary.",
    image: character.image,
    status: character.imageStatus || "canon"
  }];
  const snapshots = Array.isArray(character.snapshots) && character.snapshots.length ? character.snapshots : base;
  return snapshots.filter(Boolean);
}

function focusCardTemplate(character) {
  const firstSeen = characterFirstSeen(character);
  const snapshots = snapshotsFor(character);
  const activeSnapshot = snapshots[snapshots.length - 1] || {};
  const imagePath = activeSnapshot.image || character.image;
  const initial = escapeHtml((character.name || "?").slice(0, 1));
  const image = imagePath
    ? `<figure class="character-portrait"><img src="${escapeHtml(imagePath)}" alt="Spoiler-safe portrait of ${escapeHtml(character.name)}" loading="eager" decoding="async" /></figure>`
    : `<div class="sigel" aria-hidden="true">${initial}</div>`;

  const aliases = Array.isArray(character.aliases) && character.aliases.length
    ? `<div class="alias-row"><span>Aliases</span>${character.aliases.map((alias) => `<em>${escapeHtml(alias)}</em>`).join("")}</div>`
    : "";

  const timeline = snapshots.length > 1
    ? `<div class="snapshot-strip" aria-label="Chapter snapshots">${snapshots.map((snapshot, index) => `
        <button type="button" class="snapshot-chip ${index === snapshots.length - 1 ? "is-current" : ""}" data-snapshot-image="${escapeHtml(snapshot.image || "")}" data-snapshot-summary="${escapeHtml(snapshot.summary || "")}" data-snapshot-label="${escapeHtml(snapshot.label || "Snapshot")}">
          <span>${escapeHtml(snapshot.label || `State ${index + 1}`)}</span>
          <small>${index === snapshots.length - 1 ? "current" : "preserved"}</small>
        </button>`).join("")}</div>`
    : "";

  return `
    <article class="character-card" aria-live="polite">
      ${image}
      <div class="card-body">
        <div class="card-meta">
          <span class="badge">Revealed: ${escapeHtml(toTitleCase(firstSeen))}</span>
          <span class="badge badge-clarity">${escapeHtml(clarityLabel(character.confidence))}</span>
        </div>
        <h3>${escapeHtml(character.name)}</h3>
        ${aliases}
        <p class="character-summary">${escapeHtml(activeSnapshot.summary || character.summary || "No spoiler-safe summary yet.")}</p>
        ${timeline}
        <div class="proximity-row">
          <span>Known-so-far clarity</span>
          <span class="proximity-dots" aria-hidden="true">${clarityDots(character.confidence)}</span>
        </div>
      </div>
    </article>
  `;
}

function railItemTemplate(character, index) {
  const active = index === state.activeIndex;
  const firstSeen = characterFirstSeen(character);
  const hasTimeline = Array.isArray(character.snapshots) && character.snapshots.length > 1;
  return `
    <button class="rail-card" type="button" data-card-index="${index}" aria-current="${active ? "true" : "false"}">
      <span class="rail-name">${escapeHtml(character.name)}</span>
      <span class="rail-meta">${escapeHtml(toTitleCase(firstSeen))}${hasTimeline ? " · timeline" : ""}</span>
    </button>
  `;
}

function renderStack() {
  applyFilter();
  const characters = state.visibleCharacters;
  const total = characters.length;
  $("#deck-count").textContent = state.query
    ? `${total} matching ${total === 1 ? "entry" : "entries"}`
    : `${total} revealed entries`;

  if (!total) {
    stack.innerHTML = `<div class="empty-state"><div><strong>No match inside the current boundary.</strong><br />Try a character, faction, or mystery from the current chapter gate.</div></div>`;
    $("#card-progress").textContent = "0 / 0";
    return;
  }

  stack.innerHTML = `
    <div class="focus-card-wrap">${focusCardTemplate(characters[state.activeIndex])}</div>
    <div class="character-rail" aria-label="Character picker">${characters.map(railItemTemplate).join("")}</div>
  `;
  $("#card-progress").textContent = `${state.activeIndex + 1} / ${total}`;
  bindRailEvents();
  bindSnapshotEvents();
  requestAnimationFrame(centerActiveRailCard);
}

function bindSnapshotEvents() {
  $$(".snapshot-chip", stack).forEach((button) => {
    button.addEventListener("click", () => {
      $$(".snapshot-chip", stack).forEach((chip) => chip.classList.remove("is-current"));
      button.classList.add("is-current");
      const image = button.dataset.snapshotImage;
      const summary = button.dataset.snapshotSummary;
      const portrait = $(".character-portrait img");
      const text = $(".character-summary");
      if (image && portrait) portrait.src = image;
      if (summary && text) text.textContent = summary;
    });
  });
}

function centerActiveRailCard() {
  const rail = stack.querySelector(".character-rail");
  const active = stack.querySelector('.rail-card[aria-current="true"]');
  if (!rail || !active) return;
  rail.scrollLeft = Math.max(0, active.offsetLeft - (rail.clientWidth - active.clientWidth) / 2);
}

function selectCard(index) {
  applyFilter();
  if (index < 0 || index >= state.visibleCharacters.length) return;
  state.activeIndex = index;
  renderStack();
}

function bindRailEvents() {
  $$(".rail-card", stack).forEach((button) => {
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
      nodeMap.set(name, { id: name, label: name, type: nodeTypeFor(name, guide), links: 0, categories: new Set() });
    });
  });
  relationships.forEach((relationship) => {
    const source = nodeMap.get(relationship.source);
    const target = nodeMap.get(relationship.target);
    if (source) { source.links += 1; source.categories.add(relationship.category || "contact"); }
    if (target) { target.links += 1; target.categories.add(relationship.category || "contact"); }
  });
  return { nodes: Array.from(nodeMap.values()).map((node) => ({ ...node, categories: Array.from(node.categories) })), relationships };
}

function graphNodePosition(node, index, total) {
  const featured = {
    "Ganoes Paran": [42, 22], "House Paran": [16, 16], "Tavore Paran": [30, 14], "Garnet": [18, 25],
    "Topper": [54, 14], "Toc the Younger": [51, 27], "Claw": [66, 18], "Lorn": [64, 35], "Laseen": [82, 18], "Malazan Empire": [75, 30], "Unnamed Itko Kan captain": [78, 43], "Aragan": [70, 53],
    "Sorry": [52, 47], "Sorry — Bridgeburner recruit": [60, 55], "Rigga": [43, 38], "Fishergirl's father": [56, 38], "Ammanas": [40, 62], "Cotillion": [52, 65], "Shadowthrone": [64, 67], "Gear": [70, 57], "Oponn": [42, 33], "Hood's servant": [34, 34],
    "Bridgeburners": [80, 62], "Whiskeyjack": [26, 51], "Quick Ben": [24, 42], "Kalam": [17, 48], "Fiddler": [18, 35], "Hedge": [25, 32], "Mallet": [33, 28], "Trotts": [42, 26], "Picker": [54, 35], "Antsy": [59, 40], "Dujek Onearm": [74, 74], "Onearm's Host": [84, 79],
    "Tattersail": [47, 77], "2nd Army": [36, 80], "Calot": [39, 69], "Hairlock": [55, 75], "Tayschrenn": [62, 84], "Nightchill": [73, 84], "Bellurdan": [80, 91], "A'Karonys": [89, 84],
    "Anomander Rake": [21, 73], "Moon's Spawn": [13, 65], "Tiste Andii": [13, 83], "Caladan Brood": [27, 90], "Crimson Guard": [39, 92], "Dancer": [56, 93], "Mock": [68, 92], "Dassem Ultor": [78, 88], "House Shadow": [73, 63], "High House Death": [32, 43], "Moranth": [91, 58], "Darujhistan": [92, 45]
  };
  if (featured[node.id]) return featured[node.id];
  const angle = (-90 + (360 / Math.max(total, 1)) * index) * (Math.PI / 180);
  const radius = node.type === "faction" ? 42 : 35;
  return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
}

function relationshipPassesFilter(relationship) {
  if (state.graphFilter === "all") return true;
  if (state.graphFilter === "spotlight") {
    const core = new Set(["Sorry", "Sorry — Bridgeburner recruit", "Ganoes Paran", "Tattersail", "Hairlock", "Oponn", "Shadowthrone", "Whiskeyjack", "Quick Ben", "Bridgeburners", "Anomander Rake"]);
    const anchors = new Set(["Sorry", "Sorry — Bridgeburner recruit", "Ganoes Paran", "Tattersail", "Hairlock", "Oponn", "Shadowthrone"]);
    const bothCore = core.has(relationship.source) && core.has(relationship.target);
    const anchoredImportant = (anchors.has(relationship.source) || anchors.has(relationship.target)) && ["mystery", "bond", "command", "faction"].includes(relationship.category || "contact");
    return bothCore || anchoredImportant;
  }
  if (state.graphFilter === "bond") return ["bond", "service", "contact"].includes(relationship.category || "contact");
  return (relationship.category || "contact") === state.graphFilter;
}

function relationshipPassesQuery(relationship) {
  const q = normalize(state.graphQuery);
  if (!q) return true;
  return normalize([relationship.source, relationship.target, relationship.kind, relationship.summary, relationship.category].join(" ")).includes(q);
}

function relationshipDetailTemplate(relationship, related = []) {
  if (!relationship) {
    return `<p class="eyebrow">Selected thread</p><h3>Search, hover, or tap a node.</h3><p>The World Web is intentionally filtered: use search to turn the full tangle into one character’s orbit.</p>`;
  }
  const relatedList = related.length
    ? `<div class="thread-list">${related.slice(0, 8).map((item) => `<span>${escapeHtml(item.source === relationship.source ? item.target : item.source)} · ${escapeHtml(item.kind || graphCategoryLabel(item.category))}</span>`).join("")}</div>`
    : "";
  return `
    <p class="eyebrow">Selected thread</p>
    <h3>${escapeHtml(relationship.source)} <span>↔</span> ${escapeHtml(relationship.target)}</h3>
    <strong>${escapeHtml(graphCategoryLabel(relationship.category))} · ${escapeHtml(relationship.kind || "known-so-far link")}</strong>
    <p>${escapeHtml(relationship.summary || "Known-so-far relationship through the current boundary.")}</p>
    ${relatedList}
  `;
}

function renderRelationshipMap(guide) {
  const map = $("#relationship-map");
  const detail = $("#map-detail");
  const count = $("#map-count");
  if (!map || !detail || !count) return;

  const { nodes, relationships } = buildRelationshipGraph(guide);
  const positions = new Map(nodes.map((node, index) => [node.id, graphNodePosition(node, index, nodes.length)]));
  const visibleRelationships = relationships.filter((r) => relationshipPassesFilter(r) && relationshipPassesQuery(r));
  const visibleNames = new Set(visibleRelationships.flatMap((r) => [r.source, r.target]));
  const q = normalize(state.graphQuery);
  count.textContent = `${visibleNames.size || nodes.length} visible nodes · ${visibleRelationships.length} links`;

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
    const isVisible = relationshipPassesFilter(relationship) && relationshipPassesQuery(relationship);
    return `<button class="map-edge map-edge-${escapeHtml(relationship.category || "contact")} ${isVisible ? "is-visible" : "is-muted"}" data-link-index="${index}" style="--alpha:${Math.max(0.32, Math.min(0.95, confidence)).toFixed(2)}" aria-label="${escapeHtml(relationship.source)} to ${escapeHtml(relationship.target)}: ${escapeHtml(relationship.kind || "relationship")}"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${source[0]}" y1="${source[1]}" x2="${target[0]}" y2="${target[1]}" class="${uncertain ? "uncertain" : ""}" /></svg></button>`;
  }).join("");

  const nodeButtons = nodes.map((node) => {
    const [x, y] = positions.get(node.id);
    const isVisible = !q && state.graphFilter === "all" ? true : visibleNames.has(node.id) || normalize(node.label).includes(q);
    const isMatched = q && normalize(node.label).includes(q);
    const size = Math.min(1.34, 0.82 + node.links * 0.055);
    return `<button class="map-node map-node-${node.type} ${isVisible ? "is-visible" : "is-muted"} ${isMatched ? "is-matched" : ""}" data-node-name="${escapeHtml(node.id)}" style="--x:${x};--y:${y};--node-scale:${size.toFixed(2)}" aria-label="Show links for ${escapeHtml(node.label)}"><span>${escapeHtml(node.label)}</span><em>${node.links}</em></button>`;
  }).join("");

  map.innerHTML = `<div class="map-canvas"><div class="map-veil" aria-hidden="true"></div><div class="map-orb" aria-hidden="true"></div>${lines}${nodeButtons}</div>`;
  detail.innerHTML = relationshipDetailTemplate(visibleRelationships[0] || relationships[0]);

  const chooseRelationship = (relationship, button) => {
    const related = relationships.filter((r) => r.source === relationship.source || r.target === relationship.source || r.source === relationship.target || r.target === relationship.target);
    detail.innerHTML = relationshipDetailTemplate(relationship, related);
    $$(".map-edge, .map-node", map).forEach((element) => element.classList.remove("is-selected", "is-related"));
    button?.classList.add("is-selected");
    [relationship.source, relationship.target].forEach((name) => map.querySelector(`.map-node[data-node-name="${CSS.escape(name)}"]`)?.classList.add("is-related"));
  };

  $$(".map-edge", map).forEach((button) => {
    const relationship = relationships[Number(button.dataset.linkIndex || 0)];
    button.addEventListener("mouseenter", () => chooseRelationship(relationship, button));
    button.addEventListener("click", () => chooseRelationship(relationship, button));
  });

  $$(".map-node", map).forEach((button) => {
    const name = button.dataset.nodeName || "";
    const related = relationships.filter((relationship) => relationship.source === name || relationship.target === name);
    const focusNode = () => {
      $$(".map-edge, .map-node", map).forEach((element) => element.classList.remove("is-selected", "is-related"));
      button.classList.add("is-selected");
      related.forEach((relationship) => {
        const linkIndex = relationships.indexOf(relationship);
        map.querySelector(`.map-edge[data-link-index="${linkIndex}"]`)?.classList.add("is-related");
        map.querySelector(`.map-node[data-node-name="${CSS.escape(relationship.source === name ? relationship.target : relationship.source)}"]`)?.classList.add("is-related");
      });
      const characterIndex = (state.guide.characters || []).findIndex((character) => character.name === name);
      if (characterIndex >= 0) {
        state.query = "";
        searchInput.value = "";
        state.visibleCharacters = state.guide.characters || [];
        state.activeIndex = characterIndex;
        renderStack();
      }
      detail.innerHTML = `
        <p class="eyebrow">Selected node</p>
        <h3>${escapeHtml(name)}</h3>
        <strong>${related.length} known-so-far ${related.length === 1 ? "connection" : "connections"}</strong>
        <div class="thread-list">${related.slice(0, 10).map((relationship) => `<span>${escapeHtml(relationship.source === name ? relationship.target : relationship.source)} · ${escapeHtml(relationship.kind || graphCategoryLabel(relationship.category))}</span>`).join("")}</div>`;
    };
    button.addEventListener("mouseenter", focusNode);
    button.addEventListener("click", focusNode);
  });
}

function renderBoundary(guide) {
  const chapter = chapterLabel(guide.boundary || {});
  $("#boundary-title").textContent = `Through ${chapter}`;
  $("#boundary-explainer").textContent = `Showing only people, powers, places, and questions known by the end of ${chapter}.`;
  $("#boundary-technical").textContent = technicalBoundary(guide.boundary || {});
  $("#safe-status").textContent = `Spoiler gate: ${chapter}`;
  $("#stat-characters").textContent = String((guide.characters || []).length);
  $("#stat-links").textContent = String((guide.relationships || []).length);
  $("#stat-atlas").textContent = String((guide.visualReferences || []).length);
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

function atlasKind(item) {
  const text = normalize([item.category, item.type, item.name].join(" "));
  if (/creature|beast|hound|quorl|bestiary/.test(text)) return "creature";
  if (/magic|warren|deck|house|spell|ascendant/.test(text)) return "magic";
  if (/object|artifact|weapon/.test(text)) return "object";
  return "place";
}

function visualReferenceTemplate(item) {
  const name = item.name || "Atlas entry";
  const category = item.category || item.type || "Known-so-far reference";
  const firstSeen = item.firstSeen || "Current boundary";
  const kind = atlasKind(item);
  const image = item.image
    ? `<figure class="reference-art"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt || `Spoiler-safe reference for ${name}`)}" loading="eager" decoding="async" /></figure>`
    : "";

  return `
    <article class="reference-card" data-atlas-kind="${kind}">
      ${image}
      <div class="reference-copy">
        <div class="card-meta">
          <span class="badge">${escapeHtml(toTitleCase(kind))}</span>
          <span class="badge">${escapeHtml(category)}</span>
          <span class="badge">Revealed: ${escapeHtml(toTitleCase(firstSeen))}</span>
        </div>
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(item.summary || "Spoiler-safe Atlas entry through the current boundary.")}</p>
      </div>
    </article>
  `;
}

function renderVisualReferences(guide) {
  const references = guide.visualReferences || [];
  const count = $("#reference-count");
  const target = $("#visual-references");
  if (!count || !target) return;
  const visible = state.atlasFilter === "all" ? references : references.filter((item) => atlasKind(item) === state.atlasFilter);
  count.textContent = `${visible.length} ${visible.length === 1 ? "Atlas entry" : "Atlas entries"}`;
  target.innerHTML = visible.map(visualReferenceTemplate).join("") || `<p class="empty-copy">No Atlas entries in this category yet.</p>`;
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

  $("#clear-graph").addEventListener("click", () => {
    graphInput.value = "";
    state.graphQuery = "";
    renderRelationshipMap(state.guide);
    graphInput.focus();
  });
  graphInput.addEventListener("input", (event) => {
    state.graphQuery = event.target.value;
    renderRelationshipMap(state.guide);
  });
  $$("[data-graph-filter]").forEach((button) => button.addEventListener("click", () => {
    state.graphFilter = button.dataset.graphFilter || "all";
    $$("[data-graph-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    renderRelationshipMap(state.guide);
  }));
  $$("[data-atlas-filter]").forEach((button) => button.addEventListener("click", () => {
    state.atlasFilter = button.dataset.atlasFilter || "all";
    $$("[data-atlas-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    renderVisualReferences(state.guide);
  }));

  window.addEventListener("keydown", (event) => {
    if ([searchInput, graphInput].includes(event.target)) return;
    if (event.key === "ArrowLeft") moveCard(-1);
    if (event.key === "ArrowRight") moveCard(1);
    if (event.key === "/") {
      event.preventDefault();
      searchInput.focus();
    }
  });

  let touchStartX = 0;
  stack.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0]?.clientX || 0; }, { passive: true });
  stack.addEventListener("touchend", (event) => {
    const delta = (event.changedTouches[0]?.clientX || 0) - touchStartX;
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
