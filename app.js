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
    const response = await fetch("data/guide.json", { cache: "no-store" });
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

function cardPosition(index) {
  const offset = index - state.activeIndex;
  const depth = Math.min(Math.abs(offset), 6);
  const visible = Math.abs(offset) <= 5;
  const baseScale = Math.max(0.48, 1 - depth * 0.105);
  const x = offset * 126;
  const y = depth * 20;
  const rotate = offset * -3.6;
  return { offset, depth, visible, baseScale, x, y, rotate };
}

function cardTemplate(character, index) {
  const position = cardPosition(index);
  const active = position.offset === 0;
  const firstSeen = character.firstSeen || (character.firstSeenPosition ? `Position ${character.firstSeenPosition}` : "Unknown");
  const initial = escapeHtml((character.name || "?").slice(0, 1));

  return `
    <article
      class="character-card ${position.visible ? "" : "hidden-card"}"
      data-active="${active}"
      data-card-index="${index}"
      style="--x:${position.x}px; --y:${position.y}px; --scale:${position.baseScale}; --rotate:${position.rotate}deg; --lift:0px; --glow:0; --fade:${position.visible ? Math.max(0.18, 1 - position.depth * .14) : 0}; z-index:${60 - position.depth};"
      aria-hidden="${!active}"
      role="button"
      tabindex="${active ? 0 : -1}"
      aria-label="Open ${escapeHtml(character.name)} card"
    >
      <div class="sigel" aria-hidden="true">${initial}</div>
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

function renderStack() {
  applyFilter();
  const characters = state.visibleCharacters;
  const total = characters.length;
  $("#deck-count").textContent = state.query
    ? `${total} matching ${total === 1 ? "entry" : "entries"}`
    : `${total} revealed entries · swipe the deck`;

  if (!total) {
    stack.innerHTML = `<div class="empty-state"><div><strong>No match inside the current boundary.</strong><br />Try a character, faction, or mystery from Chapter One.</div></div>`;
    $("#card-progress").textContent = "0 / 0";
    return;
  }

  stack.innerHTML = characters.map(cardTemplate).join("");
  $("#card-progress").textContent = `${state.activeIndex + 1} / ${total}`;
  bindCardStackEvents();
}

function selectCard(index) {
  applyFilter();
  if (index < 0 || index >= state.visibleCharacters.length) return;
  state.activeIndex = index;
  renderStack();
}

function resetProximity() {
  stack.querySelectorAll(".character-card").forEach((card) => {
    const index = Number(card.dataset.cardIndex || 0);
    const position = cardPosition(index);
    card.style.setProperty("--x", `${position.x}px`);
    card.style.setProperty("--y", `${position.y}px`);
    card.style.setProperty("--scale", position.baseScale.toFixed(3));
    card.style.setProperty("--rotate", `${position.rotate}deg`);
    card.style.setProperty("--lift", "0px");
    card.style.setProperty("--glow", "0");
  });
}

function updatePointerProximity(clientX, clientY) {
  stack.querySelectorAll(".character-card:not(.hidden-card)").forEach((card) => {
    const index = Number(card.dataset.cardIndex || 0);
    const position = cardPosition(index);
    const rect = card.getBoundingClientRect();
    const cardX = rect.left + rect.width / 2;
    const cardY = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - cardX, clientY - cardY);
    const proximity = Math.max(0, 1 - distance / 330);
    const hoverScale = position.baseScale + proximity * 0.18;
    const lift = -proximity * 36;
    card.style.setProperty("--scale", hoverScale.toFixed(3));
    card.style.setProperty("--lift", `${lift.toFixed(1)}px`);
    card.style.setProperty("--glow", proximity.toFixed(3));
    card.style.zIndex = String(80 + Math.round(proximity * 30) - position.depth);
  });
}

function bindCardStackEvents() {
  stack.querySelectorAll(".character-card").forEach((card) => {
    const index = Number(card.dataset.cardIndex || 0);
    card.addEventListener("click", () => selectCard(index));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCard(index);
      }
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

  stack.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    updatePointerProximity(event.clientX, event.clientY);
  });
  stack.addEventListener("pointerleave", resetProximity);

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
  renderStack();
  renderSideRail(guide);
}

bindInteractions();
loadGuide().then(renderGuide);
