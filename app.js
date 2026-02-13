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
  "F3","G3","A3","B3",
  "C4","D4","E4","F4","G4","A4","B4",
  "C5","D5","E5","F5","G5","A5","B5",
  "C6","D6","E6"
];

const KEY_SIGNATURES = {
  C: { type: null, count: 0 },
  G: { type: "sharp", count: 1 },
  D: { type: "sharp", count: 2 },
  A: { type: "sharp", count: 3 },
  E: { type: "sharp", count: 4 },
  B: { type: "sharp", count: 5 },
  "F#": { type: "sharp", count: 6 },
  "C#": { type: "sharp", count: 7 },
  F: { type: "flat", count: 1 },
  Bb: { type: "flat", count: 2 },
  Eb: { type: "flat", count: 3 },
  Ab: { type: "flat", count: 4 }
};

const SHARP_SIGNATURE_PITCHES = ["F5", "C5", "G5", "D5", "A4", "E5", "B4"];
const FLAT_SIGNATURE_PITCHES = ["B4", "E5", "A4", "D5", "G4", "C5", "F4"];
const NOTE_TO_SEMITONE = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
};
const SEMITONE_TO_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SEMITONE_TO_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const state = {
  voices: structuredClone(VOICE_PRESET),
  selectedVoiceId: "prime",
  tokens: [],
  blocks: [],
  dragging: null,
  nextVoiceId: 100,
  currentKey: "C"
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
  const baseY = 320;
  return baseY - idx * 10;
}

function yToPitch(y) {
  const baseY = 320;
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

function getKeySignature(key) {
  return KEY_SIGNATURES[key] || { type: null, count: 0 };
}

function getNoteData(noteValue) {
  if (!noteValue) return null;
  if (typeof noteValue === "string") return { pitch: noteValue, accidental: null };
  return { pitch: noteValue.pitch, accidental: noteValue.accidental || null };
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
    typeSelect.addEventListener("change", () => { v.name = typeSelect.value; renderStaff(staff, state.tokens, state.voices, true, keySelect.value); });

    const active = document.createElement("input");
    active.type = "checkbox";
    active.checked = v.active;
    active.addEventListener("change", () => {
      v.active = active.checked;
      renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
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
      renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
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

function drawAccidental(ns, svg, x, y, accidental, color = "#0a3b4a") {
  if (!accidental) return;
  const text = document.createElementNS(ns, "text");
  text.setAttribute("x", String(x - 24));
  text.setAttribute("y", String(y + 6));
  text.setAttribute("font-size", "24");
  text.setAttribute("fill", color);
  text.textContent = accidental === "sharp" ? "♯" : accidental === "flat" ? "♭" : "♮";
  svg.append(text);
}

function getKeySignatureOffset(key) {
  const signature = getKeySignature(key);
  if (!signature.count || !signature.type) return 0;
  return Math.min(72, signature.count * 11);
}

function drawKeySignature(ns, svg, key) {
  const signature = getKeySignature(key);
  if (!signature.count || !signature.type) return;

  const pitches = signature.type === "sharp" ? SHARP_SIGNATURE_PITCHES : FLAT_SIGNATURE_PITCHES;
  const symbol = signature.type === "sharp" ? "♯" : "♭";
  const startX = 102;

  for (let i = 0; i < signature.count; i += 1) {
    const mark = document.createElementNS(ns, "text");
    mark.setAttribute("x", String(startX + i * 11));
    mark.setAttribute("y", String(pitchToY(pitches[i]) + 8));
    mark.setAttribute("font-size", "22");
    mark.setAttribute("fill", "#1c2a2a");
    mark.textContent = symbol;
    svg.append(mark);
  }

}

function ensureNoteMenu() {
  let menu = document.getElementById("note-context-menu");
  if (menu) return menu;

  menu = document.createElement("div");
  menu.id = "note-context-menu";
  menu.className = "context-menu";
  menu.innerHTML = `
    <button type="button" data-accidental="flat">♭ Bemol</button>
    <button type="button" data-accidental="sharp">♯ Sostenido</button>
    <button type="button" data-accidental="none">Quitar alteración</button>
  `;

  document.body.append(menu);
  return menu;
}

function hideNoteMenu() {
  const menu = document.getElementById("note-context-menu");
  if (!menu) return;
  menu.classList.remove("visible");
}

function renderStaff(svg, tokens, voices, isEditor = false, key = "C", onEditChord = null) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const ns = "http://www.w3.org/2000/svg";

  const signatureOffset = getKeySignatureOffset(key);
  const { columns, totalWidth } = buildColumns(tokens, 132 + signatureOffset);
  svg.setAttribute("viewBox", `0 0 ${totalWidth} 320`);
  svg.style.minWidth = `${totalWidth}px`;

  const clef = document.createElementNS(ns, "text");
  clef.setAttribute("x", "28");
  clef.setAttribute("y", "230");
  clef.setAttribute("font-size", "112");
  clef.textContent = "𝄞";
  svg.append(clef);

  drawKeySignature(ns, svg, key);

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

    const editChord = () => {
      const nextChord = prompt("Editar acorde", t.chord || "");
      if (nextChord === null) return;
      if (onEditChord) {
        onEditChord(i, nextChord.trim());
        return;
      }
      t.chord = nextChord.trim();
      renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
    };

    if (isEditor || onEditChord) {
      const chordHitbox = document.createElementNS(ns, "rect");
      chordHitbox.setAttribute("x", String(col.startX));
      chordHitbox.setAttribute("y", "14");
      chordHitbox.setAttribute("width", String(col.width));
      chordHitbox.setAttribute("height", "28");
      chordHitbox.setAttribute("fill", "transparent");
      chordHitbox.style.cursor = "pointer";
      chordHitbox.addEventListener("click", editChord);
      svg.append(chordHitbox);
    }

    const chord = document.createElementNS(ns, "text");
    chord.setAttribute("x", String(col.centerX));
    chord.setAttribute("y", "34");
    chord.setAttribute("text-anchor", "middle");
    chord.setAttribute("font-size", "20");
    chord.setAttribute("fill", "#0a3b4a");
    chord.textContent = t.chord || "—";
    if (isEditor || onEditChord) {
      chord.style.cursor = "pointer";
      chord.addEventListener("click", editChord);
    }
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
      const noteData = getNoteData(t.notes?.[v.id]);
      if (!noteData?.pitch) return;
      // mismas x para todas las voces: una arriba de otra
      const x = col.centerX;
      drawNote(ns, svg, x, pitchToY(noteData.pitch), v.color, i, v.id);
      drawAccidental(ns, svg, x, pitchToY(noteData.pitch), noteData.accidental);
    });
  });

  if (isEditor) {
    const help = document.createElementNS(ns, "text");
    help.setAttribute("x", "100");
    help.setAttribute("y", "302");
    help.setAttribute("font-size", "13");
    help.setAttribute("fill", "#4f6663");
    const selectedName = state.voices.find((v) => v.id === state.selectedVoiceId)?.name || "-";
    help.textContent = `Voz en edición: ${selectedName}. Clic para crear nota · Ctrl+clic para borrar · Clic derecho para alteraciones · Arrastrá vertical para mover.`;
    svg.append(help);

    const menu = ensureNoteMenu();
    const closeMenu = () => hideNoteMenu();
    document.addEventListener("click", closeMenu, { once: true });

    svg.onmousedown = (event) => {
      const target = event.target;
      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());

      if (target.tagName === "ellipse" && target.dataset.token && target.dataset.voice) {
        if (event.ctrlKey) {
          const tokenIndex = Number(target.dataset.token);
          const voiceId = target.dataset.voice;
          state.tokens[tokenIndex].notes[voiceId] = null;
          renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
          return;
        }
        state.dragging = { tokenIndex: Number(target.dataset.token), voiceId: target.dataset.voice };
        return;
      }

      const tokenIndex = tokenFromX(p.x, columns);
      if (tokenIndex === -1 || !state.selectedVoiceId) return;
      const pitch = yToPitch(p.y);
      if (event.ctrlKey) {
        state.tokens[tokenIndex].notes[state.selectedVoiceId] = null;
      } else {
        state.tokens[tokenIndex].notes[state.selectedVoiceId] = { pitch, accidental: null };
      }
      renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
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
      const current = getNoteData(t.notes[state.dragging.voiceId]);
      t.notes[state.dragging.voiceId] = { pitch, accidental: current?.accidental || null };
      renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
    };

    svg.oncontextmenu = (event) => {
      const target = event.target;
      if (!(target.tagName === "ellipse" && target.dataset.token && target.dataset.voice)) {
        hideNoteMenu();
        return;
      }

      event.preventDefault();
      const tokenIndex = Number(target.dataset.token);
      const voiceId = target.dataset.voice;

      menu.style.left = `${event.clientX}px`;
      menu.style.top = `${event.clientY}px`;
      menu.classList.add("visible");

      menu.onclick = (menuEvent) => {
        const button = menuEvent.target.closest("button[data-accidental]");
        if (!button) return;
        const current = getNoteData(state.tokens[tokenIndex].notes[voiceId]);
        if (!current) return;
        const accidental = button.dataset.accidental === "none" ? null : button.dataset.accidental;
        state.tokens[tokenIndex].notes[voiceId] = { ...current, accidental };
        hideNoteMenu();
        renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
      };
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
    renderStaff(svg, b.tokens, b.voices, false, b.key, (tokenIndex, chord) => {
      b.tokens[tokenIndex].chord = chord;
      renderBlocks();
    });
    wrap.append(svg);

    item.append(meta, wrap);
    blocksEl.append(item);
  });
}

function resetAllBlank() {
  state.tokens = [];
  document.getElementById("syllable-input").value = "";
  document.getElementById("chord-input").value = "";
  renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
}

function semitoneDelta(fromKey, toKey) {
  const from = NOTE_TO_SEMITONE[fromKey];
  const to = NOTE_TO_SEMITONE[toKey];
  if (from == null || to == null) return 0;
  let delta = to - from;
  if (delta > 6) delta -= 12;
  if (delta < -6) delta += 12;
  return delta;
}

function shouldPreferFlats(key) {
  return ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"].includes(key);
}

function transposeNoteName(note, semitones, preferFlats) {
  const current = NOTE_TO_SEMITONE[note];
  if (current == null) return note;
  const next = (current + semitones + 12) % 12;
  return preferFlats ? SEMITONE_TO_FLAT[next] : SEMITONE_TO_SHARP[next];
}

function transposeChord(chord, semitones, preferFlats) {
  if (!chord || semitones === 0) return chord;
  const match = chord.match(/^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/);
  if (!match) return chord;
  const [, root, quality = "", bass] = match;
  const nextRoot = transposeNoteName(root, semitones, preferFlats);
  const nextBass = bass ? transposeNoteName(bass, semitones, preferFlats) : null;
  return `${nextRoot}${quality}${nextBass ? `/${nextBass}` : ""}`;
}

function naturalPitchToMidi(pitch) {
  const match = pitch.match(/^([A-G])(\d)$/);
  if (!match) return null;
  const [, note, octaveRaw] = match;
  const octave = Number(octaveRaw);
  const semitone = NOTE_TO_SEMITONE[note];
  if (semitone == null) return null;
  return (octave + 1) * 12 + semitone;
}

function noteDataToMidi(noteData) {
  if (!noteData?.pitch) return null;
  const base = naturalPitchToMidi(noteData.pitch);
  if (base == null) return null;
  const offset = noteData.accidental === "sharp" ? 1 : noteData.accidental === "flat" ? -1 : 0;
  return base + offset;
}

function midiToStaffNoteData(midi, preferFlats) {
  const minMidi = naturalPitchToMidi(STAFF_PITCHES[0]);
  const maxMidi = naturalPitchToMidi(STAFF_PITCHES[STAFF_PITCHES.length - 1]);
  const safeMidi = Math.max(minMidi, Math.min(maxMidi, midi));
  const octave = Math.floor(safeMidi / 12) - 1;
  const semitone = ((safeMidi % 12) + 12) % 12;
  const noteName = preferFlats ? SEMITONE_TO_FLAT[semitone] : SEMITONE_TO_SHARP[semitone];

  if (noteName.length === 1) {
    return { pitch: `${noteName}${octave}`, accidental: null };
  }

  const accidental = noteName.includes("#") ? "sharp" : "flat";
  const natural = noteName[0];
  const naturalOctave = accidental === "flat" && natural === "C" ? octave + 1 : octave;
  return { pitch: `${natural}${naturalOctave}`, accidental };
}

function transposeStoredNote(noteValue, semitones, preferFlats) {
  if (!noteValue || semitones === 0) return noteValue;
  const noteData = getNoteData(noteValue);
  const midi = noteDataToMidi(noteData);
  if (midi == null) return noteValue;
  return midiToStaffNoteData(midi + semitones, preferFlats);
}

function transposeTokens(tokens, semitones, preferFlats) {
  tokens.forEach((token) => {
    token.chord = transposeChord(token.chord, semitones, preferFlats);
    Object.keys(token.notes || {}).forEach((voiceId) => {
      token.notes[voiceId] = transposeStoredNote(token.notes[voiceId], semitones, preferFlats);
    });
  });
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
  renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
});

document.getElementById("add-voice").addEventListener("click", () => {
  addVoice("Sobreprime");
  renderVoices();
  renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
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
renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
renderBlocks();

keySelect.addEventListener("change", () => {
  const nextKey = keySelect.value;
  const delta = semitoneDelta(state.currentKey, nextKey);
  const preferFlats = shouldPreferFlats(nextKey);

  if (delta !== 0) {
    transposeTokens(state.tokens, delta, preferFlats);
    state.blocks.forEach((block) => {
      transposeTokens(block.tokens, delta, preferFlats);
    });
  }

  state.blocks.forEach((block) => { block.key = nextKey; });

  state.currentKey = nextKey;
  renderStaff(staff, state.tokens, state.voices, true, keySelect.value);
  renderBlocks();
});
