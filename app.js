const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const VOICE_TYPES = ["Prime", "Prime alte", "Sobreprime", "Segundo", "Tercia", "Solista 1", "Solista 2", "Solista 3", "Solista 4", "Solista 5", "Solista 6"];
const VOICE_PRESET = [
  { id: "prime", name: "Prime", color: "#e63946", active: true },
  { id: "prime_alte", name: "Prime alte", color: "#1d3557", active: true },
  { id: "sobreprime", name: "Sobreprime", color: "#0d9488", active: true },
  { id: "segundo", name: "Segundo", color: "#2a9d8f", active: true },
  { id: "tercia", name: "Tercia", color: "#6a4c93", active: true }
];
const VOICE_COLORS = ["#e63946", "#1d3557", "#0d9488", "#2a9d8f", "#6a4c93", "#ef476f", "#3a86ff"];
// Pasos diatónicos (línea/entrelínea): sin semitonos intermedios
const STAFF_PITCHES = [
  "C3","D3","E3","F3","G3","A3","B3",
  "C4","D4","E4","F4","G4","A4","B4",
  "C5","D5","E5","F5","G5","A5","B5"
];

const state = {
  voices: structuredClone(VOICE_PRESET),
  selectedVoiceId: "prime",
  tokens: [],
  blocks: [],
  dragging: null,
  nextVoiceId: 100
};

const keySelect = document.getElementById("key");
const voicesEl = document.getElementById("voices");
const staff = document.getElementById("editor-staff");
const blocksEl = document.getElementById("blocks");

KEYS.forEach((k) => {
  const o = document.createElement("option");
  o.value = k;
  o.textContent = k;
  keySelect.append(o);
});

function pitchToY(pitch) {
  const idx = STAFF_PITCHES.indexOf(pitch);
  const baseY = 260;
  return baseY - idx * 10;
}

function yToPitch(y) {
  const baseY = 260;
  const idx = Math.round((baseY - y) / 10);
  return STAFF_PITCHES[Math.max(0, Math.min(STAFF_PITCHES.length - 1, idx))];
}

function buildColumns(tokens, startX = 150) {
  let cursor = startX;
  const columns = tokens.map((t) => {
    const syllW = Math.max((t.syllable || "").length * 18, 36);
    const chordW = Math.max((t.chord || "").length * 14, 24);
    const width = Math.max(60, syllW, chordW) + 20;
    const centerX = cursor + width / 2;
    const c = { startX: cursor, endX: cursor + width, centerX, width };
    cursor += width;
    return c;
  });
  return { columns, totalWidth: Math.max(980, cursor + 120) };
}

function tokenFromX(x, columns) {
  return columns.findIndex((c) => x >= c.startX && x <= c.endX);
}

function addVoice(name = "Sobreprime") {
  const color = VOICE_COLORS[state.voices.length % VOICE_COLORS.length];
  const id = `voice_${state.nextVoiceId++}`;
  state.voices.push({ id, name, color, active: true });
  state.tokens.forEach((t) => { t.notes[id] = null; });
  state.selectedVoiceId = id;
}

function removeVoice(id) {
  state.voices = state.voices.filter((v) => v.id !== id);
  state.tokens.forEach((t) => { delete t.notes[id]; });
  if (!state.voices.find((v) => v.id === state.selectedVoiceId)) {
    state.selectedVoiceId = state.voices[0]?.id || null;
  }
}

function renderVoices() {
  voicesEl.innerHTML = "";
  state.voices.forEach((v) => {
    const row = document.createElement("div");
    row.className = `voice-row${state.selectedVoiceId === v.id ? " active-edit" : ""}`;

    const badge = document.createElement("span");
    badge.className = "voice-badge";
    badge.style.color = v.color;
    badge.textContent = v.name;

    const typeSelect = document.createElement("select");
    VOICE_TYPES.forEach((name) => {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      if (name === v.name) o.selected = true;
      typeSelect.append(o);
    });
    typeSelect.addEventListener("change", () => { v.name = typeSelect.value; renderStaff(staff, state.tokens, state.voices, true); });

    const active = document.createElement("input");
    active.type = "checkbox";
    active.checked = v.active;
    active.addEventListener("change", () => {
      v.active = active.checked;
      renderStaff(staff, state.tokens, state.voices, true);
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = `Editar`;
    editBtn.className = "muted";
    editBtn.addEventListener("click", () => {
      state.selectedVoiceId = v.id;
      renderVoices();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Quitar";
    removeBtn.className = "muted";
    removeBtn.addEventListener("click", () => {
      removeVoice(v.id);
      renderVoices();
      renderStaff(staff, state.tokens, state.voices, true);
    });

    row.append(badge, typeSelect, active, document.createTextNode("Activa"), editBtn, removeBtn);
    voicesEl.append(row);
  });
}

function drawLedgerLines(ns, svg, x, y) {
  const topLine = 150;
  const bottomLine = 230;
  const lineLen = 24;

  if (y < topLine) {
    for (let ly = topLine - 20; ly >= y; ly -= 20) {
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(x - lineLen / 2));
      line.setAttribute("x2", String(x + lineLen / 2));
      line.setAttribute("y1", String(ly));
      line.setAttribute("y2", String(ly));
      line.setAttribute("stroke", "#1c2a2a");
      line.setAttribute("stroke-width", "1.6");
      svg.append(line);
    }
  }

  if (y > bottomLine) {
    for (let ly = bottomLine + 20; ly <= y; ly += 20) {
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(x - lineLen / 2));
      line.setAttribute("x2", String(x + lineLen / 2));
      line.setAttribute("y1", String(ly));
      line.setAttribute("y2", String(ly));
      line.setAttribute("stroke", "#1c2a2a");
      line.setAttribute("stroke-width", "1.6");
      svg.append(line);
    }
  }
}

function drawNote(ns, svg, x, y, color, tokenIndex, voiceId) {
  drawLedgerLines(ns, svg, x, y);

  const note = document.createElementNS(ns, "ellipse");
  note.setAttribute("cx", String(x));
  note.setAttribute("cy", String(y));
  note.setAttribute("rx", "10");
  note.setAttribute("ry", "7");
  note.setAttribute("fill", color);
  note.setAttribute("data-token", String(tokenIndex));
  note.setAttribute("data-voice", voiceId);
  note.style.cursor = "ns-resize";
  svg.append(note);

  const stem = document.createElementNS(ns, "line");
  stem.setAttribute("x1", String(x + 9));
  stem.setAttribute("x2", String(x + 9));
  stem.setAttribute("y1", String(y));
  stem.setAttribute("y2", String(y - 30));
  stem.setAttribute("stroke", color);
  stem.setAttribute("stroke-width", "2");
  svg.append(stem);
}

function renderStaff(svg, tokens, voices, isEditor = false) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const ns = "http://www.w3.org/2000/svg";

  const { columns, totalWidth } = buildColumns(tokens);
  svg.setAttribute("viewBox", `0 0 ${totalWidth} 320`);
  svg.style.minWidth = `${totalWidth}px`;

  const clef = document.createElementNS(ns, "text");
  clef.setAttribute("x", "28");
  clef.setAttribute("y", "230");
  clef.setAttribute("font-size", "140");
  clef.textContent = "𝄞";
  svg.append(clef);

  for (let i = 0; i < 5; i += 1) {
    const y = 150 + i * 20;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", "100");
    line.setAttribute("x2", String(totalWidth - 35));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "#1c2a2a");
    line.setAttribute("stroke-width", "2");
    svg.append(line);
  }

  tokens.forEach((t, i) => {
    const col = columns[i];

    const chord = document.createElementNS(ns, "text");
    chord.setAttribute("x", String(col.centerX));
    chord.setAttribute("y", "34");
    chord.setAttribute("text-anchor", "middle");
    chord.setAttribute("font-size", "20");
    chord.setAttribute("fill", "#0a3b4a");
    chord.textContent = t.chord || "";
    svg.append(chord);

    const syll = document.createElementNS(ns, "text");
    syll.setAttribute("x", String(col.centerX));
    syll.setAttribute("y", "66");
    syll.setAttribute("text-anchor", "middle");
    syll.setAttribute("font-size", "24");
    syll.setAttribute("fill", "#6b7280");
    syll.textContent = t.syllable.toUpperCase();
    svg.append(syll);

    voices.filter((v) => v.active).forEach((v) => {
      const pitch = t.notes?.[v.id];
      if (!pitch) return;
      // mismas x para todas las voces: una arriba de otra
      const x = col.centerX;
      drawNote(ns, svg, x, pitchToY(pitch), v.color, i, v.id);
    });
  });

  if (isEditor) {
    const help = document.createElementNS(ns, "text");
    help.setAttribute("x", "100");
    help.setAttribute("y", "302");
    help.setAttribute("font-size", "13");
    help.setAttribute("fill", "#4f6663");
    const selectedName = state.voices.find((v) => v.id === state.selectedVoiceId)?.name || "-";
    help.textContent = `Voz en edición: ${selectedName}. Clic para crear nota. Arrastrá vertical para mover (pasos línea/entrelínea).`;
    svg.append(help);

    svg.onmousedown = (event) => {
      const target = event.target;
      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());

      if (target.tagName === "ellipse" && target.dataset.token && target.dataset.voice) {
        state.dragging = { tokenIndex: Number(target.dataset.token), voiceId: target.dataset.voice };
        return;
      }

      const tokenIndex = tokenFromX(p.x, columns);
      if (tokenIndex === -1 || !state.selectedVoiceId) return;
      const pitch = yToPitch(p.y);
      state.tokens[tokenIndex].notes[state.selectedVoiceId] = pitch;
      renderStaff(staff, state.tokens, state.voices, true);
    };

    svg.onmousemove = (event) => {
      if (!state.dragging) return;
      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const pitch = yToPitch(p.y);
      const t = state.tokens[state.dragging.tokenIndex];
      if (!t) return;
      t.notes[state.dragging.voiceId] = pitch;
      renderStaff(staff, state.tokens, state.voices, true);
    };

    svg.onmouseup = () => { state.dragging = null; };
    svg.onmouseleave = () => { state.dragging = null; };
  }
}

function renderBlocks() {
  blocksEl.innerHTML = "";
  state.blocks.forEach((b, i) => {
    const item = document.createElement("article");
    item.className = "block-item";

    const meta = document.createElement("div");
    meta.className = "block-meta";
    meta.textContent = `Bloque ${i + 1} · ${b.songType} · Tonalidad ${b.key}`;

    const wrap = document.createElement("div");
    wrap.className = "staff-wrap";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("block-staff");
    renderStaff(svg, b.tokens, b.voices, false);
    wrap.append(svg);

    item.append(meta, wrap);
    blocksEl.append(item);
  });
}

function resetAllBlank() {
  state.tokens = [];
  document.getElementById("syllable-input").value = "";
  document.getElementById("chord-input").value = "";
  renderStaff(staff, state.tokens, state.voices, true);
}

document.getElementById("token-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const syllableInput = document.getElementById("syllable-input");
  const chordInput = document.getElementById("chord-input");
  const syllable = syllableInput.value.trim();
  if (!syllable) return;

  state.tokens.push({
    syllable,
    chord: chordInput.value.trim(),
    notes: Object.fromEntries(state.voices.map((v) => [v.id, null]))
  });

  syllableInput.value = "";
  chordInput.value = "";
  renderStaff(staff, state.tokens, state.voices, true);
});

document.getElementById("add-voice").addEventListener("click", () => {
  addVoice("Sobreprime");
  renderVoices();
  renderStaff(staff, state.tokens, state.voices, true);
});

document.getElementById("clear-line").addEventListener("click", resetAllBlank);

document.getElementById("save-block").addEventListener("click", () => {
  if (!state.tokens.length) return;
  state.blocks.push({
    tokens: structuredClone(state.tokens),
    voices: structuredClone(state.voices),
    key: document.getElementById("key").value,
    songType: document.getElementById("song-type").value
  });
  renderBlocks();
  resetAllBlank();
});

renderVoices();
renderStaff(staff, state.tokens, state.voices, true);
renderBlocks();
