const NOTE_SEQUENCE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
const SHARP_TO_FLAT = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
const STRING_TYPES = ["Prime", "Prime alte", "Sobreprime", "Segundo", "Tercia", "Solista 1", "Solista 2", "Solista 3", "Solista 4", "Solista 5", "Solista 6"];
const STRING_COLORS = ["#e63946", "#1d3557", "#2a9d8f", "#f4a261", "#6a4c93", "#3a86ff", "#ef476f"];
const KEY_OPTIONS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

let transpose = 0;
let blocks = [];
let currentTokens = [];
let strings = [];
let stringId = 0;
let editingIndex = null;

const linePreview = document.getElementById("line-preview");
const staffPreview = document.getElementById("staff-preview");
const blocksList = document.getElementById("blocks-list");
const stringsContainer = document.getElementById("strings-container");
const commentsInput = document.getElementById("staff-comments");
const tonalityView = document.getElementById("tonality-view");
const baseKey = document.getElementById("base-key");
const phraseInput = document.getElementById("phrase-input");

function normalizeNote(note) { return FLAT_TO_SHARP[note] ?? note; }
function shiftNote(note, semitones, preferFlat = false) {
  const n = normalizeNote(note);
  const i = NOTE_SEQUENCE.indexOf(n);
  if (i < 0) return note;
  const next = NOTE_SEQUENCE[(i + semitones + 1200) % 12];
  return preferFlat && SHARP_TO_FLAT[next] ? SHARP_TO_FLAT[next] : next;
}
function transposeChord(chord, semitones) {
  const m = chord.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!m || !m[1]) return chord;
  return `${shiftNote(m[1], semitones, m[1].includes("b"))}${m[2]}`;
}
function transposePitch(note, octave, semitones) {
  const normalized = normalizeNote(note);
  const idx = NOTE_SEQUENCE.indexOf(normalized);
  const abs = octave * 12 + idx + semitones;
  const nextOct = Math.floor(abs / 12);
  const nextNote = NOTE_SEQUENCE[((abs % 12) + 12) % 12];
  return { note: nextNote, octave: nextOct };
}
function pitchToStaffY(note, octave) {
  const letter = note[0];
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const step = octave * 7 + letters.indexOf(letter);
  const e4 = 4 * 7 + letters.indexOf("E");
  const delta = step - e4;
  const bottomLineY = 220;
  return bottomLineY - delta * 10;
}
function formatTokenLines(tokens) {
  const chordLine = tokens.map((t) => (t.chord || "").padEnd(Math.max((t.chord || "").length, t.lyric.length) + 1, " ")).join("");
  const lyricLine = tokens.map((t) => t.lyric.padEnd(Math.max((t.chord || "").length, t.lyric.length) + 1, " ")).join("");
  return `${chordLine.trimEnd()}\n${lyricLine.trimEnd()}`;
}


function buildTokenColumns(tokens, firstX = 220) {
  const columns = [];
  let cursor = firstX;

  tokens.forEach((token) => {
    const lyricWidth = Math.max((token.lyric || "").length * 18, 36);
    const chordWidth = Math.max((token.chord || "").length * 14, 24);
    const width = Math.max(56, lyricWidth, chordWidth) + 18;
    const centerX = cursor + width / 2;
    columns.push({ width, centerX, startX: cursor, endX: cursor + width });
    cursor += width;
  });

  return { columns, endX: cursor };
}

function updateTonalityView() {
  const current = shiftNote(baseKey.value, transpose, baseKey.value.includes("b"));
  tonalityView.textContent = `Tonalidad: ${current} (${transpose > 0 ? `+${transpose}` : transpose})`;
}

function drawStaff(svg, tokens, stringData) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const ns = "http://www.w3.org/2000/svg";

  const firstX = 220;
  const { columns, endX } = buildTokenColumns(tokens, firstX);
  const totalWidth = Math.max(960, endX + 160);
  svg.setAttribute("viewBox", `0 0 ${totalWidth} 300`);
  svg.style.minWidth = `${totalWidth}px`;

  if (tokens.length) {
    tokens.forEach((token, tokenIndex) => {
      const lyricSyllable = document.createElementNS(ns, "text");
      lyricSyllable.setAttribute("x", String(columns[tokenIndex].centerX));
      lyricSyllable.setAttribute("y", "45");
      lyricSyllable.setAttribute("font-size", "30");
      lyricSyllable.setAttribute("text-anchor", "middle");
      lyricSyllable.setAttribute("fill", "#6b7280");
      lyricSyllable.textContent = token.lyric.toUpperCase();
      svg.append(lyricSyllable);
    });
  } else {
    const lyric = document.createElementNS(ns, "text");
    lyric.setAttribute("x", "170");
    lyric.setAttribute("y", "45");
    lyric.setAttribute("font-size", "30");
    lyric.setAttribute("fill", "#6b7280");
    lyric.textContent = "(SIN LETRA)";
    svg.append(lyric);
  }

  const clef = document.createElementNS(ns, "text");
  clef.setAttribute("x", "24");
  clef.setAttribute("y", "230");
  clef.setAttribute("font-size", "145");
  clef.textContent = "𝄞";
  svg.append(clef);

  for (let i = 0; i < 5; i += 1) {
    const line = document.createElementNS(ns, "line");
    const y = 140 + i * 20;
    line.setAttribute("x1", "100");
    line.setAttribute("x2", String(totalWidth - 40));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "#222");
    line.setAttribute("stroke-width", "2");
    svg.append(line);
  }

  tokens.forEach((_, tokenIndex) => {
    const x = columns[tokenIndex].centerX;

    stringData.forEach((s, idx) => {
      const transposed = transposePitch(s.note, s.octave, transpose);
      const y = pitchToStaffY(transposed.note, transposed.octave);
      const color = STRING_COLORS[idx % STRING_COLORS.length];

      const accidental = transposed.note.includes("#") ? "#" : transposed.note.includes("b") ? "b" : "";
      if (accidental) {
        const acc = document.createElementNS(ns, "text");
        acc.setAttribute("x", String(x - 20));
        acc.setAttribute("y", String(y + 6));
        acc.setAttribute("font-size", "16");
        acc.setAttribute("fill", color);
        acc.textContent = accidental;
        svg.append(acc);
      }

      const note = document.createElementNS(ns, "ellipse");
      note.setAttribute("cx", String(x));
      note.setAttribute("cy", String(y));
      note.setAttribute("rx", "10");
      note.setAttribute("ry", "7");
      note.setAttribute("fill", color);
      svg.append(note);

      const stem = document.createElementNS(ns, "line");
      stem.setAttribute("x1", String(x + 9));
      stem.setAttribute("x2", String(x + 9));
      stem.setAttribute("y1", String(y));
      stem.setAttribute("y2", String(y - 35));
      stem.setAttribute("stroke", color);
      stem.setAttribute("stroke-width", "2");
      svg.append(stem);
    });
  });

  stringData.forEach((s, idx) => {
    const transposed = transposePitch(s.note, s.octave, transpose);
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", String(130 + idx * 110));
    text.setAttribute("y", "285");
    text.setAttribute("font-size", "12");
    text.setAttribute("fill", STRING_COLORS[idx % STRING_COLORS.length]);
    text.textContent = `${s.type}: ${transposed.note}${transposed.octave}`;
    svg.append(text);
  });
}

function renderCurrentPreview() {
  const shiftedTokens = currentTokens.map((t) => ({ lyric: t.lyric.toUpperCase(), chord: transposeChord(t.chord, transpose) }));
  linePreview.textContent = shiftedTokens.length ? formatTokenLines(shiftedTokens) : "(sin contenido)";
  drawStaff(staffPreview, shiftedTokens, strings);
  updateTonalityView();
}

function renderStringControls() {
  stringsContainer.innerHTML = "";
  strings.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "string-row";
    row.style.borderLeftColor = STRING_COLORS[idx % STRING_COLORS.length];

    const label = document.createElement("strong");
    label.textContent = `Cuerda ${idx + 1}`;
    label.style.color = STRING_COLORS[idx % STRING_COLORS.length];

    const type = document.createElement("select");
    STRING_TYPES.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      if (s.type === v) o.selected = true;
      type.append(o);
    });

    const note = document.createElement("select");
    NOTE_SEQUENCE.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      if (s.note === v) o.selected = true;
      note.append(o);
    });

    const octave = document.createElement("select");
    [3, 4, 5].forEach((v) => {
      const o = document.createElement("option");
      o.value = String(v);
      o.textContent = `Oct ${v}`;
      if (s.octave === v) o.selected = true;
      octave.append(o);
    });

    type.addEventListener("change", () => { s.type = type.value; renderCurrentPreview(); });
    note.addEventListener("change", () => { s.note = note.value; renderCurrentPreview(); });
    octave.addEventListener("change", () => { s.octave = Number(octave.value); renderCurrentPreview(); });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Quitar";
    remove.className = "muted";
    remove.addEventListener("click", () => {
      strings = strings.filter((x) => x.id !== s.id);
      renderStringControls();
      renderCurrentPreview();
    });

    row.append(label, type, note, octave, remove);
    stringsContainer.append(row);
  });
}

function renderBlocks() {
  blocksList.innerHTML = "";
  blocks.forEach((b, idx) => {
    const el = document.createElement("article");
    el.className = "block-item";

    const head = document.createElement("div");
    head.className = "block-head";
    const meta = document.createElement("div");
    meta.className = "block-meta";
    meta.textContent = `Bloque ${idx + 1} · ${b.songType} · ${b.comments || "sin comentario"}`;
    head.append(meta);

    const text = document.createElement("pre");
    text.className = "block-text";
    const shiftedTokens = b.tokens.map((t) => ({ lyric: t.lyric.toUpperCase(), chord: transposeChord(t.chord, transpose) }));
    text.textContent = formatTokenLines(shiftedTokens);

    const svgWrap = document.createElement("div");
    svgWrap.className = "staff-scroll";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("block-staff");
    drawStaff(svg, shiftedTokens, b.strings);
    svgWrap.append(svg);

    const actions = document.createElement("div");
    actions.className = "block-actions";

    const edit = document.createElement("button");
    edit.textContent = "Editar";
    edit.addEventListener("click", () => {
      editingIndex = idx;
      currentTokens = b.tokens.map((t) => ({ ...t }));
      strings = b.strings.map((s) => ({ id: ++stringId, ...s }));
      commentsInput.value = b.comments;
      document.getElementById("song-type").value = b.songType;
      renderStringControls();
      renderCurrentPreview();
    });

    const up = document.createElement("button");
    up.textContent = "↑";
    up.className = "muted";
    up.addEventListener("click", () => {
      if (idx === 0) return;
      [blocks[idx - 1], blocks[idx]] = [blocks[idx], blocks[idx - 1]];
      renderBlocks();
    });

    const down = document.createElement("button");
    down.textContent = "↓";
    down.className = "muted";
    down.addEventListener("click", () => {
      if (idx === blocks.length - 1) return;
      [blocks[idx + 1], blocks[idx]] = [blocks[idx], blocks[idx + 1]];
      renderBlocks();
    });

    const del = document.createElement("button");
    del.textContent = "Eliminar";
    del.className = "muted";
    del.addEventListener("click", () => {
      blocks.splice(idx, 1);
      renderBlocks();
    });

    actions.append(edit, up, down, del);
    el.append(head, text, svgWrap, actions);
    blocksList.append(el);
  });
}

function resetEditor() {
  currentTokens = [];
  commentsInput.value = "";
  editingIndex = null;
  renderCurrentPreview();
}

function saveBlock() {
  if (!currentTokens.length) return;
  const block = {
    tokens: currentTokens.map((t) => ({ ...t })),
    strings: strings.map((s) => ({ type: s.type, note: s.note, octave: s.octave })),
    comments: commentsInput.value.trim(),
    songType: document.getElementById("song-type").value
  };

  if (editingIndex === null) blocks.push(block);
  else blocks[editingIndex] = block;

  renderBlocks();
  resetEditor();
}

function applyPhraseToTokens(phrase) {
  const syllables = phrase
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÜÑ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  currentTokens = syllables.map((syllable, index) => {
    let chord = "";
    if (index === 0) chord = "Am";
    else if (index === 3) chord = "C";
    else if (index === syllables.length - 1) chord = "B7";
    return { chord, lyric: syllable };
  });

  renderCurrentPreview();
}

function loadExample() {
  const examplePhrase = "Don de es ta raaan, en la en se na da el vie jo cei baaaaaaal";
  phraseInput.value = examplePhrase;
  applyPhraseToTokens(examplePhrase);
}

function seedStrings() {
  strings = [];
  const base = [
    { type: "Prime", note: "C", octave: 4 },
    { type: "Prime alte", note: "E", octave: 4 },
    { type: "Segundo", note: "G", octave: 4 },
    { type: "Tercia", note: "B", octave: 4 }
  ];
  base.forEach((s) => strings.push({ id: ++stringId, ...s }));
}

KEY_OPTIONS.forEach((k) => {
  const o = document.createElement("option");
  o.value = k;
  o.textContent = k;
  if (k === "C") o.selected = true;
  baseKey.append(o);
});

baseKey.addEventListener("change", () => { renderCurrentPreview(); renderBlocks(); });
document.getElementById("transpose-up").addEventListener("click", () => { transpose += 1; renderCurrentPreview(); renderBlocks(); });
document.getElementById("transpose-down").addEventListener("click", () => { transpose -= 1; renderCurrentPreview(); renderBlocks(); });

document.getElementById("token-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const lyric = document.getElementById("token-lyric");
  const chord = document.getElementById("token-chord");
  currentTokens.push({ lyric: lyric.value.trim(), chord: chord.value.trim() });
  lyric.value = "";
  chord.value = "";
  renderCurrentPreview();
  lyric.focus();
});

document.getElementById("clear-tokens").addEventListener("click", () => { currentTokens = []; renderCurrentPreview(); });
document.getElementById("load-example").addEventListener("click", loadExample);
document.getElementById("apply-phrase").addEventListener("click", () => applyPhraseToTokens(phraseInput.value));
document.getElementById("add-string").addEventListener("click", () => {
  strings.push({ id: ++stringId, type: "Prime", note: "C", octave: 4 });
  renderStringControls();
  renderCurrentPreview();
});
document.getElementById("save-block").addEventListener("click", saveBlock);
document.getElementById("new-block").addEventListener("click", resetEditor);

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && document.activeElement?.id === "save-block") {
    e.preventDefault();
    saveBlock();
  }
});

seedStrings();
renderStringControls();
loadExample();
renderBlocks();
