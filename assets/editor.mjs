import {
  deepClone,
  isPlainObject,
  pathKey,
  getAtPath,
  setAtPath,
  deleteAtPath,
  renameKey,
  moveArrayItem,
  inferType,
  coerceFromString,
  validatePaulipediaData,
} from "./json_ops.mjs";

const el = (sel, root=document) => root.querySelector(sel);

function toast(msg){
  const t = el("#toast");
  if(!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.hidden = true; }, 2200);
}

function setTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  try{ localStorage.setItem("theme", theme); }catch(_){ }
  const btn = el("#toggleTheme");
  if(btn){
    const pressed = theme === "dark";
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    btn.textContent = pressed ? "Toggle light mode" : "Toggle dark mode";
  }
}

function pretty(value){
  return JSON.stringify(value, null, 2);
}

function supportsFileSystemAccess(){
  return typeof window !== "undefined" && !!window.showSaveFilePicker;
}

const state = {
  data: null,
  original: null,
  dirty: false,
  open: new Set([""]),
  addTargetPath: null,
  addTargetKind: null, // "object" | "array"
  fileHandle: null,
};

function setStatus(text){
  const s = el("#editorStatus");
  if(s) s.textContent = text;
}

function setDirty(flag){
  state.dirty = !!flag;
  const hint = el("#dirtyHint");
  if(hint){
    hint.textContent = state.dirty ? "Unsaved changes." : " ";
  }
  el("#resetChanges")?.toggleAttribute("disabled", !state.dirty);
}

function enableControls(enabled){
  for(const id of ["downloadJson","saveToFile","validate","copyJson"]){
    const btn = el(`#${id}`);
    if(btn) btn.toggleAttribute("disabled", !enabled);
  }
  if(el("#saveToFile")){
    el("#saveToFile").toggleAttribute("disabled", !(enabled && supportsFileSystemAccess()));
  }
}

function updatePreview(){
  const out = el("#jsonPreview");
  if(out && state.data != null){
    out.value = pretty(state.data);
  }
}

function updateValidationSummary(result){
  const wrap = el("#validationSummary");
  if(!wrap) return;
  if(!result){
    wrap.textContent = "Load data to begin.";
    return;
  }
  if(result.ok && result.warnings.length === 0){
    wrap.textContent = "OK.";
    return;
  }
  const parts = [];
  if(!result.ok) parts.push(`${result.errors.length} error(s)`);
  if(result.warnings.length) parts.push(`${result.warnings.length} warning(s)`);
  wrap.textContent = parts.join(" • ") || "OK.";
}

function showNotice(text){
  const n = el("#editorNotice");
  if(!n) return;
  n.textContent = text;
  n.hidden = !text;
}

function initTheme(){
  const saved = (() => { try { return localStorage.getItem("theme"); } catch(_) { return null; } })();
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(saved || (prefersDark ? "dark" : "light"));
  el("#toggleTheme")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current === "dark" ? "light" : "dark");
    toast("Theme updated.");
  });
}

async function loadFromSite(){
  setStatus("Loading ./data/data.json …");
  showNotice("");
  try{
    const res = await fetch("./data/data.json", {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.original = deepClone(data);
    state.data = deepClone(data);
    state.fileHandle = null;
    setDirty(false);
    enableControls(true);
    setStatus("Loaded site data.json.");
    render();
    updatePreview();
    updateValidationSummary(null);
    toast("Loaded data.json");
  }catch(err){
    console.error(err);
    setStatus("Failed to load site data.json.");
    showNotice("Failed to load ./data/data.json. If you are running this from the filesystem (file://), serve the folder with a local web server.");
    toast("Load failed.");
  }
}

function loadFromObject(obj, statusLabel){
  state.original = deepClone(obj);
  state.data = deepClone(obj);
  setDirty(false);
  enableControls(true);
  setStatus(statusLabel);
  render();
  updatePreview();
  updateValidationSummary(null);
}

async function importFile(file){
  if(!file) return;
  showNotice("");
  try{
    const text = await file.text();
    const obj = JSON.parse(text);
    state.fileHandle = null;
    loadFromObject(obj, `Imported ${file.name}.`);
    toast("Imported JSON");
  }catch(err){
    console.error(err);
    toast("Import failed.");
    showNotice("Import failed: the selected file is not valid JSON.");
  }
}

function downloadJson(){
  if(state.data == null) return;
  const blob = new Blob([pretty(state.data)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Downloaded data.json");
}

async function saveToFile(){
  if(state.data == null) return;
  if(!supportsFileSystemAccess()){
    toast("Save not supported in this browser.");
    return;
  }

  try{
    const handle = state.fileHandle || await window.showSaveFilePicker({
      suggestedName: "data.json",
      types: [{
        description: "JSON",
        accept: {"application/json": [".json"]}
      }]
    });

    const writable = await handle.createWritable();
    await writable.write(pretty(state.data));
    await writable.close();

    state.fileHandle = handle;
    toast("Saved to file.");
    setDirty(false);
  }catch(err){
    // User cancel is not an error.
    if(err && (err.name === "AbortError")) return;
    console.error(err);
    toast("Save failed.");
  }
}

async function copyJson(){
  if(state.data == null) return;
  try{
    await navigator.clipboard.writeText(pretty(state.data));
    toast("Copied JSON");
  }catch(_){
    toast("Copy failed.");
  }
}

function resetChanges(){
  if(state.original == null) return;
  state.data = deepClone(state.original);
  setDirty(false);
  render();
  updatePreview();
  toast("Reset.");
}

function validate(){
  if(state.data == null) return;
  const result = validatePaulipediaData(state.data);
  updateValidationSummary(result);

  if(result.ok && result.warnings.length === 0){
    toast("Validation OK.");
    showNotice("");
    return;
  }

  const lines = [];
  if(result.errors.length){
    lines.push("Errors:");
    for(const e of result.errors) lines.push(`- ${e}`);
  }
  if(result.warnings.length){
    lines.push("Warnings:");
    for(const w of result.warnings) lines.push(`- ${w}`);
  }
  showNotice(lines.join("\n"));
  toast(result.ok ? "Validation warnings." : "Validation failed.");
}

function markChanged(){
  setDirty(true);
  updatePreview();
}

function makeIconButton(label, title, onClick){
  const b = document.createElement("button");
  b.type = "button";
  b.className = "iconbtn";
  b.textContent = label;
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

function renderPrimitiveEditor(value, path){
  const type = inferType(value);
  const wrap = document.createElement("div");
  wrap.className = "node__value";

  const controls = document.createElement("div");
  controls.style.display = "grid";
  controls.style.gridTemplateColumns = "minmax(0, 1fr) 120px";
  controls.style.gap = "8px";

  const typeSel = document.createElement("select");
  typeSel.className = "editor-input";
  typeSel.style.padding = "8px 10px";
  for(const t of ["string","number","boolean","null","object","array"]){
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    if(t === type) opt.selected = true;
    typeSel.appendChild(opt);
  }

  const valueHost = document.createElement("div");

  function renderValueInput(currentType, currentValue){
    valueHost.innerHTML = "";
    let input;
    if(currentType === "string"){
      const isMulti = String(currentValue || "").includes("\n") || String(currentValue || "").length > 60;
      if(isMulti){
        input = document.createElement("textarea");
        input.rows = 2;
        input.className = "editor-input editor-input--textarea";
        input.value = String(currentValue ?? "");
      }else{
        input = document.createElement("input");
        input.type = "text";
        input.className = "editor-input";
        input.value = String(currentValue ?? "");
      }
      input.addEventListener("change", () => {
        setAtPath(state.data, path, input.value);
        markChanged();
      });
      valueHost.appendChild(input);
      return;
    }

    if(currentType === "number"){
      input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.className = "editor-input";
      input.value = Number.isFinite(currentValue) ? String(currentValue) : "0";
      input.addEventListener("change", () => {
        const n = Number(input.value);
        setAtPath(state.data, path, Number.isFinite(n) ? n : 0);
        markChanged();
      });
      valueHost.appendChild(input);
      return;
    }

    if(currentType === "boolean"){
      input = document.createElement("select");
      input.className = "editor-input";
      const t = document.createElement("option");
      t.value = "true";
      t.textContent = "true";
      const f = document.createElement("option");
      f.value = "false";
      f.textContent = "false";
      input.appendChild(t);
      input.appendChild(f);
      input.value = currentValue ? "true" : "false";
      input.addEventListener("change", () => {
        setAtPath(state.data, path, input.value === "true");
        markChanged();
      });
      valueHost.appendChild(input);
      return;
    }

    // null/object/array have no value input
    const span = document.createElement("div");
    span.className = "node__meta";
    span.textContent = currentType === "null" ? "null" : (currentType === "object" ? "{}" : "[]");
    valueHost.appendChild(span);
  }

  typeSel.addEventListener("change", () => {
    const nextType = typeSel.value;
    const next = coerceFromString(nextType, "");
    setAtPath(state.data, path, next);
    setDirty(true);
    render();
    updatePreview();
  });

  renderValueInput(type, value);

  controls.appendChild(valueHost);
  controls.appendChild(typeSel);
  wrap.appendChild(controls);
  return wrap;
}

function renderNode(key, value, path, parentKind){
  const type = inferType(value);
  const container = document.createElement("div");
  container.className = "node";

  const actions = document.createElement("div");
  actions.className = "node__actions";

  const canDelete = path.length > 0;
  const canMove = parentKind === "array";

  if(canMove){
    actions.appendChild(makeIconButton("↑", "Move up", () => {
      moveArrayItem(state.data, path, "up");
      markChanged();
      render();
    }));
    actions.appendChild(makeIconButton("↓", "Move down", () => {
      moveArrayItem(state.data, path, "down");
      markChanged();
      render();
    }));
  }

  if(type === "object" || type === "array"){
    actions.appendChild(makeIconButton("＋", type === "object" ? "Add key" : "Add item", () => {
      openAddDialog(path, type);
    }));
  }

  if(canDelete){
    actions.appendChild(makeIconButton("🗑", "Delete", () => {
      const ok = window.confirm("Delete this item?");
      if(!ok) return;
      deleteAtPath(state.data, path);
      markChanged();
      render();
    }));
  }

  if(type === "object" || type === "array"){
    const details = document.createElement("details");
    details.dataset.path = pathKey(path);
    details.open = state.open.has(details.dataset.path) || path.length < 2;
    details.addEventListener("toggle", () => {
      const pk = details.dataset.path;
      if(details.open) state.open.add(pk);
      else state.open.delete(pk);
    });

    const summary = document.createElement("summary");
    const sumRow = document.createElement("div");
    sumRow.className = "node__summary";

    const keyCell = document.createElement("div");
    keyCell.className = "node__key";
    const twisty = document.createElement("span");
    twisty.className = "node__twisty";
    twisty.textContent = "▸";
    keyCell.appendChild(twisty);

    if(parentKind === "object" && path.length > 0){
      const keyInput = document.createElement("input");
      keyInput.type = "text";
      keyInput.className = "editor-input";
      keyInput.value = String(key);
      keyInput.addEventListener("change", () => {
        const nk = keyInput.value;
        if(String(nk) === String(key)) return;
        try{
          renameKey(state.data, path, nk);
          markChanged();
          render();
        }catch(err){
          toast(err?.message || "Rename failed.");
          keyInput.value = String(key);
        }
      });
      keyCell.appendChild(keyInput);
    }else{
      const code = document.createElement("code");
      code.textContent = path.length === 0 ? "root" : String(key);
      keyCell.appendChild(code);
    }

    const valCell = document.createElement("div");
    valCell.className = "node__meta";
    if(type === "object"){
      const keys = Object.keys(value || {});
      valCell.textContent = `{ ${keys.length} key${keys.length === 1 ? "" : "s"} }`;
    }else{
      const len = Array.isArray(value) ? value.length : 0;
      valCell.textContent = `[ ${len} item${len === 1 ? "" : "s"} ]`;
    }

    sumRow.appendChild(keyCell);
    sumRow.appendChild(valCell);
    sumRow.appendChild(actions);
    summary.appendChild(sumRow);
    details.appendChild(summary);

    const childrenWrap = document.createElement("div");
    childrenWrap.className = "node__children";

    if(type === "object"){
      const keys = Object.keys(value || {});
      keys.sort((a,b) => a.localeCompare(b));
      for(const k of keys){
        childrenWrap.appendChild(renderNode(k, value[k], [...path, k], "object"));
      }
    }else{
      for(let i=0; i<(value || []).length; i++){
        childrenWrap.appendChild(renderNode(i, value[i], [...path, i], "array"));
      }
    }

    details.appendChild(childrenWrap);
    container.appendChild(details);
    return container;
  }

  // Primitive
  const row = document.createElement("div");
  row.className = "node__row";

  const keyCell = document.createElement("div");
  keyCell.className = "node__key";

  if(parentKind === "object" && path.length > 0){
    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.className = "editor-input";
    keyInput.value = String(key);
    keyInput.addEventListener("change", () => {
      const nk = keyInput.value;
      if(String(nk) === String(key)) return;
      try{
        renameKey(state.data, path, nk);
        markChanged();
        render();
      }catch(err){
        toast(err?.message || "Rename failed.");
        keyInput.value = String(key);
      }
    });
    keyCell.appendChild(keyInput);
  }else{
    const code = document.createElement("code");
    code.textContent = path.length === 0 ? "root" : String(key);
    keyCell.appendChild(code);
  }

  row.appendChild(keyCell);
  row.appendChild(renderPrimitiveEditor(value, path));
  row.appendChild(actions);

  container.appendChild(row);
  return container;
}

function render(){
  const tree = el("#tree");
  if(!tree) return;
  tree.innerHTML = "";
  if(state.data == null){
    tree.textContent = "No data loaded.";
    return;
  }

  tree.appendChild(renderNode("root", state.data, [], "root"));
}

function openAddDialog(targetPath, kind){
  state.addTargetPath = targetPath;
  state.addTargetKind = kind;

  const dlg = el("#addDialog");
  const title = el("#addDialogTitle");
  const keyRow = el("#addKeyRow");
  const keyInput = el("#addKey");
  const typeSel = el("#addType");
  const valueRow = el("#addValueRow");
  const valueInput = el("#addValue");

  if(!dlg || !title || !keyRow || !keyInput || !typeSel || !valueRow || !valueInput) return;

  title.textContent = kind === "object" ? "Add key" : "Add item";
  keyRow.hidden = kind !== "object";
  keyInput.value = "";
  typeSel.value = "string";
  valueInput.value = "";
  valueRow.hidden = false;

  typeSel.onchange = () => {
    const t = typeSel.value;
    valueRow.hidden = (t === "object" || t === "array" || t === "null");
  };

  dlg.showModal();
  (kind === "object" ? keyInput : typeSel)?.focus();
}

function closeAddDialog(){
  const dlg = el("#addDialog");
  if(dlg?.open) dlg.close();
  state.addTargetPath = null;
  state.addTargetKind = null;
}

function commitAddDialog(){
  if(state.data == null) return;
  const kind = state.addTargetKind;
  const targetPath = state.addTargetPath;
  if(!kind || !targetPath) return;

  const keyInput = el("#addKey");
  const typeSel = el("#addType");
  const valueInput = el("#addValue");
  const type = typeSel?.value || "string";
  const raw = valueInput?.value || "";
  const nextVal = coerceFromString(type, raw);

  try{
    const target = getAtPath(state.data, targetPath);
    if(kind === "object"){
      if(!isPlainObject(target)) throw new Error("Target is not an object");
      const k = String(keyInput?.value || "").trim();
      if(!k) throw new Error("Key is required");
      if(Object.prototype.hasOwnProperty.call(target, k)) throw new Error(`Key already exists: ${k}`);
      target[k] = nextVal;
    }else{
      if(!Array.isArray(target)) throw new Error("Target is not an array");
      target.push(nextVal);
    }

    markChanged();
    render();
    closeAddDialog();
    toast("Added.");
  }catch(err){
    toast(err?.message || "Add failed.");
  }
}

function wireDialog(){
  el("#addCancel")?.addEventListener("click", () => closeAddDialog());
  el("#addDialogForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    commitAddDialog();
  });
}

function wireControls(){
  el("#loadSiteData")?.addEventListener("click", () => loadFromSite());
  el("#importFile")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    importFile(file);
    // allow selecting same file again
    e.target.value = "";
  });
  el("#downloadJson")?.addEventListener("click", () => downloadJson());
  el("#saveToFile")?.addEventListener("click", () => saveToFile());
  el("#copyJson")?.addEventListener("click", () => copyJson());
  el("#resetChanges")?.addEventListener("click", () => resetChanges());
  el("#validate")?.addEventListener("click", () => validate());
}

function init(){
  initTheme();
  wireControls();
  wireDialog();
  enableControls(false);
  updateValidationSummary(null);
  updatePreview();

  // Attempt to load automatically.
  loadFromSite();
}

init();
