const fs = require("fs");
const path = require("path");
const { blurSymbol, blurSymbolPreview, resizeImagePercent, resizeImagePixel, getImageSize, getAlphaBounds, cropToRect } = require("../lib/imaging.js");

let webUtils = null;
try { webUtils = require("electron").webUtils; } catch (e) { /* fallback file.path */ }

function getFilePath(file) {
  if (webUtils && webUtils.getPathForFile) return webUtils.getPathForFile(file);
  return file.path;
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ============================================================
// TOOLS metadata + sidebar / tab switching
// ============================================================

const TOOLS = {
  atlas: { label: "Merge Atlas", group: "SPINE / SYMBOLS", desc: "Giữ lại File PNG duy nhất, và cập nhật lại tên trong atlas." },
  blur: { label: "Blur Symbols", group: "SPINE / SYMBOLS", desc: "Blur Static Symbol và Tăng sáng hoặc tối, save đè file gốc." },
  rename: { label: "Rename", group: "XỬ LÝ ẢNH", desc: "Đổi tên hàng loạt (hậu tố ## để tự đánh số), hoặc tìm và thay thế chữ trong tên file." },
  resize: { label: "Resize", group: "XỬ LÝ ẢNH", desc: "Scale hàng loạt PNG theo % hoặc theo pixel, ghi đè trực tiếp lên file gốc." },
  frames: { label: "FBF Viewer", group: "ANIMATION", desc: "Xem trước chuỗi hình frame by frame." },
  cropfbf: { label: "Crop FBF", group: "XỬ LÝ ẢNH", desc: "Tự cắt phần trong suốt thừa (chung cả chuỗi hoặc riêng từng ảnh), hoặc crop theo kích thước W×H. Ghi đè file gốc." },
};

const eyebrowEl = document.getElementById("eyebrow");
const titleEl = document.getElementById("pageTitle");
const descEl = document.getElementById("pageDesc");

function selectTab(key) {
  document.querySelectorAll("[data-tab]").forEach((el) => el.classList.toggle("active", el.dataset.tab === key));
  document.querySelectorAll(".tab-panel").forEach((el) => { el.hidden = el.dataset.panel !== key; });
  const info = TOOLS[key];
  eyebrowEl.textContent = info.group;
  titleEl.textContent = info.label;
  descEl.textContent = info.desc;
}

document.querySelectorAll("[data-tab]").forEach((el) => {
  el.addEventListener("click", () => selectTab(el.dataset.tab));
});
selectTab("atlas");

// sidebar collapse/expand
const sidebarShell = document.getElementById("sidebarShell");
const railToggle = document.getElementById("railToggle");
railToggle.addEventListener("click", () => {
  sidebarShell.classList.toggle("collapsed");
  railToggle.textContent = sidebarShell.classList.contains("collapsed") ? "›" : "‹";
});

// sidebar search filter
document.getElementById("searchInput").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll(".nav .nav-item").forEach((row) => {
    const label = row.querySelector("span").textContent.toLowerCase();
    row.style.display = q === "" || label.includes(q) ? "" : "none";
  });
});

// To mau do phan da keo cua moi thanh truot (ke ca khi gia tri doi tu code, vd luc dang play).
(function paintRangeFill() {
  document.querySelectorAll('input[type=range]').forEach((r) => {
    const min = parseFloat(r.min) || 0;
    const max = parseFloat(r.max) || 100;
    const p = max > min ? ((parseFloat(r.value) - min) / (max - min)) * 100 : 0;
    r.style.setProperty("--fill", p + "%");
  });
  requestAnimationFrame(paintRangeFill);
})();

function setupDropzoneVisuals(el) {
  el.addEventListener("dragenter", (e) => { e.preventDefault(); el.classList.add("dragover"); });
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("dragleave", () => el.classList.remove("dragover"));
  el.addEventListener("drop", () => el.classList.remove("dragover"));
}

// Khung xem truoc dung chung (cot phai cua Merge Atlas / Blur / Resize): anh vua khit stage, giu ti le.
function makePreviewPane(prefix) {
  const stageEl = document.getElementById(prefix + "Stage");
  const canvasEl = document.getElementById(prefix + "Canvas");
  const imgEl = document.getElementById(prefix + "Img");
  const emptyEl = document.getElementById(prefix + "Empty");
  const infoEl = document.getElementById(prefix + "SizeInfo");
  const statusEl = document.getElementById(prefix + "Status");
  let last = null; // { url, w, h, ghost }
  let ghostEl = null;

  function fit() {
    if (!last || stageEl.clientWidth === 0) return;
    const { w, h, ghost } = last;
    const bw = Math.max(w, ghost ? ghost.w : 0), bh = Math.max(h, ghost ? ghost.h : 0);
    const scale = Math.min((stageEl.clientWidth - 24) / bw, (stageEl.clientHeight - 24) / bh, 4);
    canvasEl.style.width = w * scale + "px";
    canvasEl.style.height = h * scale + "px";
    if (ghost) {
      if (!ghostEl) { ghostEl = document.createElement("div"); ghostEl.className = "resize-ghost"; stageEl.appendChild(ghostEl); }
      ghostEl.hidden = false;
      ghostEl.style.width = ghost.w * scale + "px";
      ghostEl.style.height = ghost.h * scale + "px";
      ghostEl.style.left = (stageEl.clientWidth - ghost.w * scale) / 2 + "px";
      ghostEl.style.top = (stageEl.clientHeight - ghost.h * scale) / 2 + "px";
    } else if (ghostEl) ghostEl.hidden = true;
  }
  new ResizeObserver(fit).observe(stageEl);

  return {
    /** url: anh can hien; w,h: kich thuoc hien thi (px that); ghost: {w,h} khung so sanh (vd kich thuoc goc) */
    show(url, w, h, ghost) {
      last = { url, w, h, ghost: ghost || null };
      canvasEl.hidden = false;
      emptyEl.hidden = true;
      if (imgEl.dataset.src !== url) { imgEl.src = url; imgEl.dataset.src = url; }
      fit();
    },
    clear(text) {
      last = null;
      canvasEl.hidden = true;
      emptyEl.hidden = false;
      emptyEl.textContent = text || "Chưa có hình";
      if (ghostEl) ghostEl.hidden = true;
      infoEl.innerHTML = "";
    },
    info(html) { infoEl.innerHTML = html || ""; },
    status(text, warn) { statusEl.textContent = text || ""; statusEl.classList.toggle("warn", !!warn); },
  };
}

const fileUrlOf = (p, v) => require("url").pathToFileURL(p).href + (v ? "?v=" + v : "");
const sizeCache = new Map(); // filePath -> { width, height } (xoa khi file bi sua)
async function cachedSize(p) {
  if (!sizeCache.has(p)) sizeCache.set(p, await getImageSize(p));
  return sizeCache.get(p);
}

// ============================================================
// MERGE ATLAS
// ============================================================
(function initAtlas() {
  const { shell } = require("electron");
  const dropEl = document.getElementById("atlasDrop");
  const dropEmptyEl = document.getElementById("atlasDropEmpty");
  const pickedEl = document.getElementById("atlasPicked");
  const labelEl = document.getElementById("atlasDropLabel");
  const pickedDirEl = document.getElementById("atlasPickedDir");
  const planEl = document.getElementById("atlasPlan");
  const planListEl = document.getElementById("atlasPlanList");
  const trashEl = document.getElementById("atlasTrash");
  const mergeBtn = document.getElementById("atlasMergeBtn");
  const clearBtn = document.getElementById("atlasClearBtn");
  const pane = makePreviewPane("atlas");
  let selectedFile = null;
  let version = 0;

  /** Doc thu muc cua PNG duoc giu: PNG se xoa, file .atlas va dong .png dau tien se doi ten. */
  function plan() {
    const folder = path.dirname(selectedFile);
    const pngName = path.basename(selectedFile);
    const names = fs.readdirSync(folder);
    const toDelete = names.filter((f) => f.toLowerCase().endsWith(".png") && f !== pngName);
    const atlases = names.filter((f) => f.toLowerCase().endsWith(".atlas")).map((f) => {
      const lines = fs.readFileSync(path.join(folder, f), "utf-8").split("\n");
      const pngLines = lines.map((l, i) => ({ l: l.trim(), i })).filter((x) => x.l.toLowerCase().endsWith(".png"));
      return { name: f, lines, first: pngLines[0] || null, pages: pngLines.length };
    });
    return { folder, pngName, toDelete, atlases };
  }

  function row(tag, cls, name) {
    const r = document.createElement("div");
    r.className = "plan-row " + cls;
    const t = document.createElement("span");
    t.className = "tag " + cls;
    t.textContent = tag;
    const n = document.createElement("span");
    n.className = "name";
    n.textContent = name;
    r.append(t, n);
    return r;
  }

  async function refresh() {
    const has = !!selectedFile;
    dropEmptyEl.hidden = has;
    pickedEl.hidden = !has;
    planEl.hidden = !has;
    if (!has) { pane.clear(); pane.status(""); return; }
    labelEl.textContent = path.basename(selectedFile);
    pickedDirEl.textContent = path.dirname(selectedFile);
    let p;
    try { p = plan(); } catch (e) { pane.status("Không đọc được thư mục: " + e.message, true); return; }
    planListEl.innerHTML = "";
    planListEl.appendChild(row("GIỮ", "keep", p.pngName));
    p.toDelete.forEach((f) => planListEl.appendChild(row("XÓA", "del", f)));
    const notes = [];
    p.atlases.forEach((a) => {
      if (a.first && a.first.l !== p.pngName) planListEl.appendChild(row("ATLAS", "edit", `${a.name}: ${a.first.l} → ${p.pngName}`));
      if (a.pages > 1) notes.push(`${a.name} có ${a.pages} trang PNG — chỉ trang đầu được đổi tên.`);
    });
    if (!p.atlases.length) notes.push("Không thấy file .atlas trong thư mục này.");
    planListEl.querySelectorAll(".plan-note").forEach((n) => n.remove());
    notes.forEach((t) => { const n = document.createElement("div"); n.className = "plan-note"; n.textContent = "⚠ " + t; planListEl.appendChild(n); });
    try {
      const sz = await cachedSize(selectedFile);
      pane.show(fileUrlOf(selectedFile, version), sz.width, sz.height);
      pane.info(`<b>${sz.width}×${sz.height}</b>`);
    } catch (e) { pane.clear("Không đọc được ảnh"); }
    const nothing = !p.toDelete.length && !p.atlases.some((a) => a.first && a.first.l !== p.pngName);
    pane.status(nothing ? "Thư mục đã gọn, không còn gì để merge." : `Sẽ xóa ${p.toDelete.length} PNG thừa${p.atlases.length ? ` và cập nhật ${p.atlases.length} file .atlas` : ""}.`);
  }

  function setSelected(p) {
    selectedFile = p;
    sizeCache.delete(p);
    refresh();
  }

  setupDropzoneVisuals(dropEl);
  dropEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const filePath = getFilePath(files[0]);
    if (!filePath || !filePath.toLowerCase().endsWith(".png")) { toast("Chỉ nhận file PNG"); return; }
    setSelected(filePath);
  });
  clearBtn.addEventListener("click", () => setSelected(null));

  async function runMerge() {
    if (!selectedFile) { toast("Chưa chọn file PNG"); return false; }
    try {
      const p = plan();
      for (const f of p.toDelete) {
        const fp = path.join(p.folder, f);
        try {
          if (trashEl.checked) await shell.trashItem(fp);
          else fs.unlinkSync(fp);
        } catch (e) { console.error(fp, e); }
      }
      for (const a of p.atlases) {
        if (!a.first) continue;
        try {
          a.lines[a.first.i] = p.pngName;
          fs.writeFileSync(path.join(p.folder, a.name), a.lines.join("\n"));
        } catch (e) { console.error(a.name, e); }
      }
      toast(trashEl.checked ? "Đã merge xong (PNG thừa nằm trong Thùng rác)." : "Đã merge xong");
      version++;
      refresh();
      return true;
    } catch (e) {
      toast("Lỗi: " + e.message);
      return false;
    }
  }

  mergeBtn.addEventListener("click", runMerge);
  refresh();
  window.__atlasTest = {
    setSelectedFile: (p) => setSelected(p),
    run: runMerge,
    trashEl,
  };
})();

// ============================================================
// Helper: mot danh sach file dung chung cho Blur / Crop / Resize
// (drop + hien thi + chon + xoa bang Delete)
// ============================================================
function makeSimpleFileList(listEl, { acceptExt = [".png"], onChange } = {}) {
  const files = [];
  let selectedIdx = new Set();

  function render() {
    listEl.innerHTML = "";
    files.forEach((f, i) => {
      const row = document.createElement("div");
      row.className = "filerow" + (selectedIdx.has(i) ? " selected" : "");
      row.textContent = path.basename(f);
      row.addEventListener("click", (e) => {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) selectedIdx.clear();
        if (selectedIdx.has(i)) selectedIdx.delete(i); else selectedIdx.add(i);
        render();
      });
      const x = document.createElement("span");
      x.className = "remove-x";
      x.textContent = "✕";
      x.addEventListener("click", (e) => { e.stopPropagation(); removeAt(i); });
      row.appendChild(x);
      listEl.appendChild(row);
    });
    if (onChange) onChange();
  }

  function add(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (acceptExt.length && !acceptExt.includes(ext)) return;
    if (!files.includes(filePath)) { files.push(filePath); render(); }
  }

  function removeAt(i) {
    files.splice(i, 1);
    selectedIdx.clear();
    render();
  }

  function clear() {
    files.length = 0;
    selectedIdx.clear();
    render();
  }

  listEl.tabIndex = 0;
  listEl.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      const toRemove = [...selectedIdx].sort((a, b) => b - a);
      toRemove.forEach((i) => files.splice(i, 1));
      selectedIdx.clear();
      render();
    }
  });

  // vi tri dong dang chon dau tien (de xem truoc), -1 neu chua chon
  function selected() {
    return selectedIdx.size ? Math.min(...selectedIdx) : -1;
  }

  return { files, add, render, removeAt, clear, selected };
}

// A dropzone whose empty-state placeholder (icon+text) swaps for an inline
// file list once files are dropped in — used by Blur / Crop / Resize so the
// drop target and the queue are the same box (per Mondiro's unified-look request).
function makeDropzoneFileList(dropEl, { acceptExt = [".png"], onChange } = {}) {
  const emptyEl = dropEl.querySelector(".dz-empty");
  const listEl = dropEl.querySelector(".dz-list");

  const fl = makeSimpleFileList(listEl, {
    acceptExt,
    onChange: () => {
      const has = fl.files.length > 0;
      emptyEl.hidden = has;
      listEl.hidden = !has;
      if (onChange) onChange();
    },
  });
  emptyEl.hidden = false;
  listEl.hidden = true;

  setupDropzoneVisuals(dropEl);
  dropEl.addEventListener("drop", (e) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files || []).forEach((f) => fl.add(getFilePath(f)));
  });

  return fl;
}

// ============================================================
// BLUR SYMBOLS
// ============================================================
(function initBlur() {
  const dropEl = document.getElementById("blurDrop");
  const applyBtn = document.getElementById("blurApplyBtn");
  const clearBtn = document.getElementById("blurClearBtn");
  const amountEl = document.getElementById("blurAmount");
  const lightEl = document.getElementById("blurLightness");
  const amountRangeEl = document.getElementById("blurAmountRange");
  const lightRangeEl = document.getElementById("blurLightnessRange");
  const baEl = document.getElementById("blurBeforeAfter");
  const pane = makePreviewPane("blurPv");
  let view = "after"; // "before" | "after"
  let version = 0;
  let previewToken = 0;
  let previewTimer = null;
  const previewCache = new Map(); // "path|blur|light|version" -> { dataUrl, width, height }

  const fl = makeDropzoneFileList(dropEl, { onChange: () => schedulePreview(0) });
  clearBtn.addEventListener("click", () => fl.clear());

  // thanh truot va o so luon khop nhau
  function link(rangeEl, inputEl) {
    rangeEl.addEventListener("input", () => { inputEl.value = rangeEl.value; schedulePreview(); });
    inputEl.addEventListener("input", () => {
      const v = parseFloat(inputEl.value);
      if (Number.isFinite(v)) rangeEl.value = v;
      schedulePreview();
    });
  }
  link(amountRangeEl, amountEl);
  link(lightRangeEl, lightEl);

  baEl.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => {
    view = b.dataset.view;
    baEl.querySelectorAll(".mode-btn").forEach((x) => x.classList.toggle("active", x === b));
    schedulePreview(0);
  }));

  function previewFile() {
    if (!fl.files.length) return null;
    const i = fl.selected();
    return fl.files[i >= 0 ? i : 0];
  }

  function schedulePreview(delay = 160) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, delay);
  }

  async function renderPreview() {
    const p = previewFile();
    if (!p) { pane.clear(); pane.status(""); return; }
    const token = ++previewToken;
    const blur = parseFloat(amountEl.value) || 0;
    const light = parseInt(lightEl.value, 10) || 0;
    try {
      const sz = await cachedSize(p);
      if (token !== previewToken) return;
      pane.info(`<b>${sz.width}×${sz.height}</b>`);
      if (view === "before") {
        pane.show(fileUrlOf(p, version), sz.width, sz.height);
      } else {
        const key = [p, blur, light, version].join("|");
        if (!previewCache.has(key)) {
          pane.status("Đang tạo xem trước...");
          previewCache.set(key, await blurSymbolPreview(p, blur, light));
          if (previewCache.size > 40) previewCache.delete(previewCache.keys().next().value);
        }
        if (token !== previewToken) return;
        pane.show(previewCache.get(key).dataUrl, sz.width, sz.height);
      }
      pane.status(`${view === "before" ? "Ảnh gốc" : "Kết quả"}: ${path.basename(p)}${fl.files.length > 1 ? " · click tên file để xem file khác" : ""}`);
    } catch (e) {
      if (token === previewToken) pane.status("Không xem trước được: " + e.message, true);
    }
  }

  async function runApply() {
    if (!fl.files.length) { toast("Hãy thêm PNG trước."); return; }
    const blur = parseFloat(amountEl.value);
    const lightness = parseInt(lightEl.value, 10);
    if (Number.isNaN(blur) || Number.isNaN(lightness)) { toast("Giá trị không hợp lệ."); return; }

    applyBtn.disabled = true;
    const failed = [];
    for (let i = 0; i < fl.files.length; i++) {
      pane.status(`Đang xử lý ${i + 1}/${fl.files.length}...`);
      try {
        await blurSymbol(fl.files[i], blur, lightness);
        sizeCache.delete(fl.files[i]);
      } catch (e) {
        failed.push(`${path.basename(fl.files[i])}: ${e.message}`);
      }
    }
    applyBtn.disabled = false;
    version++;
    // file goc da doi: chuyen sang xem anh that (Truoc = ban vua ghi de)
    view = "before";
    baEl.querySelectorAll(".mode-btn").forEach((x) => x.classList.toggle("active", x.dataset.view === "before"));
    await renderPreview();
    pane.status(failed.length ? `Xong, lỗi ${failed.length} file.` : `Đã xử lý ${fl.files.length} file — đang hiện ảnh sau khi ghi đè.`, !!failed.length);
    if (failed.length) toast(`Xong với ${failed.length} lỗi — xem console.`);
    else toast(`Đã xử lý ${fl.files.length} file.`);
    if (failed.length) console.error("Blur errors:\n" + failed.join("\n"));
    return { failed };
  }

  applyBtn.addEventListener("click", runApply);
  window.__blurTest = { fl, run: runApply, amountEl, lightEl, renderPreview };
})();

// ============================================================
// RENAME
// ============================================================
(function initRename() {
  const dropEl = document.getElementById("renameDrop");
  const emptyEl = dropEl.querySelector(".dz-empty");
  const listEl = document.getElementById("renameList");
  const runBtn = document.getElementById("renameRunBtn");
  const clearBtn = document.getElementById("renameClearBtn");
  const templateEl = document.getElementById("renameTemplate");
  const findEl = document.getElementById("renameFind");
  const replaceEl = document.getElementById("renameReplace");
  const modeToggleEl = document.getElementById("renameModeToggle");
  const templateFieldsEl = document.getElementById("renameTemplateFields");
  const replaceFieldsEl = document.getElementById("renameReplaceFields");

  let files = [];
  let mode = "template"; // "template" (dat ten moi ##) | "replace" (tim va thay the)

  function generateNewName(template, index, ext, oldName) {
    template = (template || "").trim();
    if (!template) return oldName;
    const m = template.match(/(#+)$/);
    let base = template;
    if (m) {
      const digits = m[1].length;
      const num = String(index + 1).padStart(digits, "0");
      base = template.slice(0, -digits) + num;
    }
    return base + ext;
  }

  // Tim va thay the: chi sua phan ten (khong dung duoi file), khong phan biet hoa/thuong.
  // O "Thay bang" de trong = xoa chu can tim, va gon dau noi (cach/_/-) ngay tai cho vua xoa:
  // "walk_noct_00" -> "walk_00", "noct_walk" -> "walk", "Up noCT noRSZ" -> "Up noRSZ".
  function findReplace(oldName, find, replacement) {
    if (!find || !find.trim()) return oldName;
    const ext = path.extname(oldName);
    const base = path.basename(oldName, ext);
    const lowerBase = base.toLowerCase();
    const lowerFind = find.toLowerCase();
    const isSep = (c) => c === " " || c === "_" || c === "-";
    let out = "";
    let i = 0;
    let found = false;
    for (let at = lowerBase.indexOf(lowerFind); at !== -1; at = lowerBase.indexOf(lowerFind, i)) {
      found = true;
      out += base.slice(i, at);
      i = at + find.length;
      if (replacement) { out += replacement; continue; }
      // xoa: neu ben trai la dau dau ten hoac dau noi, bo dau noi ngay ben phai
      if ((out === "" || isSep(out[out.length - 1])) && isSep(base[i])) i++;
    }
    if (!found) return oldName;
    out += base.slice(i);
    if (!replacement) {
      while (out && isSep(out[out.length - 1]) && i >= base.length) out = out.slice(0, -1);
    }
    return out + ext;
  }

  function newNameFor(p, i) {
    const oldName = path.basename(p);
    if (mode === "replace") return findReplace(oldName, findEl.value, replaceEl.value);
    return generateNewName(templateEl.value, i, path.extname(oldName), oldName);
  }

  // Ly do khong doi ten duoc (de hien ngay trong danh sach truoc khi bam), null = OK.
  function problemFor(p, newName, allNew) {
    const oldName = path.basename(p);
    if (newName === oldName) return null;
    if (!path.basename(newName, path.extname(newName))) return "tên trống";
    if (/[\\/:*?"<>|]/.test(newName)) return "ký tự không hợp lệ";
    if (allNew.filter((n) => n.toLowerCase() === (path.dirname(p) + "/" + newName).toLowerCase()).length > 1) return "trùng tên";
    const target = path.join(path.dirname(p), newName);
    if (target.toLowerCase() !== p.toLowerCase() && fs.existsSync(target)) return "đã có file này";
    return null;
  }

  function plan() {
    const names = files.map((p, i) => newNameFor(p, i));
    const keys = names.map((n, i) => (path.dirname(files[i]) + "/" + n));
    return files.map((p, i) => ({ p, oldName: path.basename(p), newName: names[i], problem: problemFor(p, names[i], keys) }));
  }

  function render() {
    listEl.innerHTML = "";
    for (const it of plan()) {
      const row = document.createElement("div");
      const same = it.newName === it.oldName;
      row.className = "filerow" + (same ? " unchanged" : "");
      const oldSpan = document.createElement("span");
      oldSpan.textContent = it.oldName;
      row.appendChild(oldSpan);
      if (!same) {
        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = "→";
        const newSpan = document.createElement("span");
        newSpan.className = "new";
        newSpan.textContent = it.newName;
        row.append(arrow, newSpan);
      }
      if (it.problem) {
        const err = document.createElement("span");
        err.className = "err";
        err.textContent = it.problem;
        row.appendChild(err);
      }
      listEl.appendChild(row);
    }
    const has = files.length > 0;
    emptyEl.hidden = has;
    listEl.hidden = !has;
  }

  function setMode(m) {
    mode = m;
    modeToggleEl.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    templateFieldsEl.hidden = m !== "template";
    replaceFieldsEl.hidden = m !== "replace";
    render();
  }
  modeToggleEl.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));


  templateEl.addEventListener("input", render);
  findEl.addEventListener("input", render);
  replaceEl.addEventListener("input", render);

  setupDropzoneVisuals(dropEl);
  dropEl.addEventListener("drop", (e) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files || []).forEach((f) => {
      const p = getFilePath(f);
      if (p && fs.existsSync(p) && fs.statSync(p).isFile() && !files.includes(p)) files.push(p);
    });
    render();
  });

  clearBtn.addEventListener("click", () => { files = []; render(); });

  render();

  function runRename() {
    if (!files.length) { toast("Chưa có file nào"); return { success: 0, failed: [] }; }
    const items = plan();
    const todo = items.filter((it) => it.newName !== it.oldName);
    if (!todo.length) {
      toast(mode === "replace" ? "Không file nào chứa chữ cần tìm." : "Chưa nhập tên mới.");
      return { success: 0, failed: [] };
    }
    let success = 0;
    const failed = [];
    const renamed = new Map();
    for (const it of todo) {
      if (it.problem) { failed.push(`${it.oldName}: ${it.problem}`); continue; }
      const newPath = path.join(path.dirname(it.p), it.newName);
      try { fs.renameSync(it.p, newPath); success++; renamed.set(it.p, newPath); }
      catch (e) { failed.push(`${it.oldName}: ${e.message}`); }
    }
    files = files.map((p) => renamed.get(p) || p);
    render();
    if (failed.length) { toast(`Đổi tên ${success} file, bỏ qua ${failed.length} file (trùng tên / lỗi).`); console.error(failed.join("\n")); }
    else toast(`Đã đổi tên ${success} file`);
    return { success, failed };
  }

  runBtn.addEventListener("click", runRename);
  window.__renameTest = {
    addFile: (p) => { if (!files.includes(p)) files.push(p); render(); },
    run: runRename,
    templateEl,
    findEl,
    replaceEl,
    setMode,
    getFiles: () => files,
  };
})();

// ============================================================
// RESIZE
// ============================================================
(function initResize() {
  const dropEl = document.getElementById("resizeDrop");
  const runBtn = document.getElementById("resizeRunBtn");
  const clearBtn = document.getElementById("resizeClearBtn");
  const pctEl = document.getElementById("resizePercent");
  const widthEl = document.getElementById("resizeWidth");
  const heightEl = document.getElementById("resizeHeight");
  const modeToggleEl = document.getElementById("resizeModeToggle");
  const percentFieldsEl = document.getElementById("resizePercentFields");
  const pixelFieldsEl = document.getElementById("resizePixelFields");
  const warningEl = document.getElementById("resizeSizeWarning");
  const pctRangeEl = document.getElementById("resizePercentRange");
  const presetsEl = document.getElementById("resizePresets");
  const pane = makePreviewPane("resizePv");
  let version = 0;
  let previewToken = 0;

  let mode = "percent"; // "percent" | "pixel"
  let refW = null, refH = null; // kich thuoc file dau tien — dung de preview ti le truc tiep tren UI
  let sizesMismatched = false; // cac file trong chuoi khong cung 1 kich thuoc -> khong cho resize theo pixel
  // "width" | "height" | null — o nguoi dung VUA tu tay go; o con lai chi la preview theo ti le
  // cua file dau tien. Luc resize that, chi o nay duoc dung nhu gia tri that (chieu con lai
  // se duoc tinh RIENG cho tung file theo dung ti le cua chinh file do).
  let lastDriver = null;
  let pendingRefresh = Promise.resolve();

  const fl = makeDropzoneFileList(dropEl, {
    onChange: () => { pendingRefresh = refreshReferenceDims().then(renderPreview); },
  });

  function setSizeWarning(show) {
    warningEl.style.display = show ? "" : "none";
  }

  function setPixelInputsEnabled(enabled) {
    widthEl.disabled = !enabled;
    heightEl.disabled = !enabled;
  }

  async function refreshReferenceDims() {
    lastDriver = null;
    refW = null; refH = null;
    sizesMismatched = false;

    if (!fl.files.length) {
      widthEl.value = "";
      heightEl.value = "";
      setSizeWarning(false);
      setPixelInputsEnabled(true);
      return;
    }

    let sizes;
    try {
      sizes = await Promise.all(fl.files.map((p) => getImageSize(p)));
    } catch (e) {
      console.error(e);
      return;
    }

    const first = sizes[0];
    const allSame = sizes.every((s) => s.width === first.width && s.height === first.height);

    if (!allSame) {
      sizesMismatched = true;
      widthEl.value = "";
      heightEl.value = "";
      setSizeWarning(true);
      setPixelInputsEnabled(false);
      return;
    }

    setSizeWarning(false);
    setPixelInputsEnabled(true);
    refW = first.width;
    refH = first.height;
    widthEl.value = refW;
    heightEl.value = refH;
  }

  // ---- xem truoc: kich thuoc cu -> moi (tinh y het luc resize that) ----
  function targetSize(sz) {
    if (mode === "percent") {
      const s = (parseFloat(pctEl.value) || 0) / 100;
      if (!(s > 0)) return null;
      return { w: Math.max(1, Math.round(sz.width * s)), h: Math.max(1, Math.round(sz.height * s)) };
    }
    if (sizesMismatched) return null;
    let w = parsePositiveIntOrNull(widthEl.value), h = parsePositiveIntOrNull(heightEl.value);
    if (lastDriver === "width") h = null;
    if (lastDriver === "height") w = null;
    if (!w && !h) return null;
    if (w && !h) h = Math.round(sz.height * (w / sz.width));
    else if (h && !w) w = Math.round(sz.width * (h / sz.height));
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  async function renderPreview() {
    if (!fl.files.length) { pane.clear(); pane.status(""); return; }
    const token = ++previewToken;
    const i = fl.selected();
    const p = fl.files[i >= 0 ? i : 0];
    try {
      const sizes = await Promise.all(fl.files.map(cachedSize));
      if (token !== previewToken) return;
      const sz = sizes[fl.files.indexOf(p)];
      const t = targetSize(sz);
      if (!t) {
        pane.show(fileUrlOf(p, version), sz.width, sz.height);
        pane.info(`${sz.width}×${sz.height}`);
        pane.status(mode === "pixel" && sizesMismatched ? "Chuỗi ảnh có nhiều size khác nhau — dùng chế độ Theo %." : "Nhập kích thước hợp lệ.", true);
        return;
      }
      pane.show(fileUrlOf(p, version), t.w, t.h, { w: sz.width, h: sz.height });
      pane.info(`${sz.width}×${sz.height} → <b>${t.w}×${t.h}</b>`);
      const mixed = sizes.some((x) => x.width !== sizes[0].width || x.height !== sizes[0].height);
      const same = t.w === sz.width && t.h === sz.height;
      pane.status(same ? "Kích thước giữ nguyên." :
        `${fl.files.length} file sẽ được resize${mixed ? " (mỗi file theo tỉ lệ riêng vì size khác nhau)" : ` về ${t.w}×${t.h}`}. Khung nét đứt = kích thước cũ.`);
    } catch (e) {
      if (token === previewToken) pane.status("Không đọc được ảnh: " + e.message, true);
    }
  }

  pctRangeEl.addEventListener("input", () => { pctEl.value = pctRangeEl.value; renderPreview(); });
  pctEl.addEventListener("input", () => {
    const v = parseFloat(pctEl.value);
    if (Number.isFinite(v)) pctRangeEl.value = v;
    renderPreview();
  });
  presetsEl.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => {
    pctEl.value = b.dataset.pct;
    pctRangeEl.value = b.dataset.pct;
    renderPreview();
  }));

  widthEl.addEventListener("input", () => {
    lastDriver = "width";
    const w = parseFloat(widthEl.value);
    if (refW && refH && Number.isFinite(w) && w > 0) {
      heightEl.value = Math.max(1, Math.round(w * (refH / refW)));
    }
    renderPreview();
  });
  heightEl.addEventListener("input", () => {
    lastDriver = "height";
    const h = parseFloat(heightEl.value);
    if (refW && refH && Number.isFinite(h) && h > 0) {
      widthEl.value = Math.max(1, Math.round(h * (refW / refH)));
    }
    renderPreview();
  });

  function setMode(m) {
    mode = m === "pixel" ? "pixel" : "percent";
    modeToggleEl.querySelectorAll(".mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    percentFieldsEl.style.display = mode === "percent" ? "" : "none";
    pixelFieldsEl.style.display = mode === "pixel" ? "" : "none";
    if (mode === "pixel") pendingRefresh = refreshReferenceDims().then(renderPreview);
    else renderPreview();
  }

  modeToggleEl.querySelectorAll(".mode-btn").forEach((b) => {
    b.addEventListener("click", () => setMode(b.dataset.mode));
  });

  clearBtn.addEventListener("click", () => fl.clear());

  function parsePositiveIntOrNull(raw) {
    const v = parseInt(String(raw || "").trim(), 10);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  async function runResize() {
    if (!fl.files.length) { toast("Chưa có file PNG nào."); return { success: 0 }; }

    if (mode === "percent") {
      const percent = parseFloat(pctEl.value);
      if (Number.isNaN(percent) || percent <= 0) { toast("Nhập % hợp lệ (vd: 50, 100, 150)."); return { success: 0 }; }
      let success = 0;
      for (const p of fl.files) {
        try { await resizeImagePercent(p, percent); success++; }
        catch (e) { console.error(p, e); }
      }
      toast(`Đã resize đè ${success} file (${percent}%).`);
      afterRun();
      return { success };
    }

    // mode === "pixel"
    if (sizesMismatched) {
      toast("Chuỗi ảnh có nhiều size khác nhau nên không hợp lệ để resize theo pixel.");
      return { success: 0 };
    }

    let success = 0;
    if (lastDriver === "width") {
      // nguoi dung go Rong — Cao chi la preview, tinh rieng theo ti le tung file luc resize that
      const width = parsePositiveIntOrNull(widthEl.value);
      if (!width) { toast("Nhập Rộng hợp lệ."); return { success: 0 }; }
      for (const p of fl.files) {
        try { await resizeImagePixel(p, { width, height: null }); success++; }
        catch (e) { console.error(p, e); }
      }
    } else if (lastDriver === "height") {
      const height = parsePositiveIntOrNull(heightEl.value);
      if (!height) { toast("Nhập Cao hợp lệ."); return { success: 0 }; }
      for (const p of fl.files) {
        try { await resizeImagePixel(p, { width: null, height }); success++; }
        catch (e) { console.error(p, e); }
      }
    } else {
      // nguoi dung chua tu go o nao — dung dung 2 so dang hien (mac dinh = kich thuoc anh hien tai)
      const width = parsePositiveIntOrNull(widthEl.value);
      const height = parsePositiveIntOrNull(heightEl.value);
      if (!width && !height) { toast("Nhập ít nhất 1 chiều (Rộng hoặc Cao) hợp lệ."); return { success: 0 }; }
      for (const p of fl.files) {
        try { await resizeImagePixel(p, { width, height }); success++; }
        catch (e) { console.error(p, e); }
      }
    }
    toast(`Đã resize đè ${success} file theo pixel.`);
    afterRun();
    return { success };
  }

  // file da doi kich thuoc: doc lai size, hien anh moi
  function afterRun() {
    fl.files.forEach((p) => sizeCache.delete(p));
    version++;
    pendingRefresh = refreshReferenceDims().then(renderPreview);
  }

  runBtn.addEventListener("click", runResize);
  window.__resizeTest = {
    fl, run: runResize, pctEl, widthEl, heightEl, setMode, renderPreview,
    get mode() { return mode; },
    get lastDriver() { return lastDriver; },
    get refW() { return refW; },
    get refH() { return refH; },
    get sizesMismatched() { return sizesMismatched; },
    get pendingRefresh() { return pendingRefresh; },
  };
})();

// ============================================================
// CROP FBF — crop ca chuoi hinh ve cung 1 khung (Auto Crop theo alpha cua ca chuoi, hoac W×H + diem neo)
// ============================================================
(function initCropFbf() {
  const IMG_EXT = [".png", ".jpg", ".jpeg"];
  const dropEl = document.getElementById("cfDrop");
  const emptyEl = dropEl.querySelector(".dz-empty");
  const listEl = document.getElementById("cfList");
  const modeToggleEl = document.getElementById("cfModeToggle");
  const autoFieldsEl = document.getElementById("cfAutoFields");
  const sizeFieldsEl = document.getElementById("cfSizeFields");
  const paddingEl = document.getElementById("cfPadding");
  const keepCenterEl = document.getElementById("cfKeepCenter");
  const scopeToggleEl = document.getElementById("cfScopeToggle");
  const autoHintEl = document.getElementById("cfAutoHint");
  const widthEl = document.getElementById("cfWidth");
  const heightEl = document.getElementById("cfHeight");
  const anchorEl = document.getElementById("cfAnchor");
  const runBtn = document.getElementById("cfRunBtn");
  const clearBtn = document.getElementById("cfClearBtn");
  const canvasEl = document.getElementById("cfCanvas");
  const stageEl = document.getElementById("cfStage");
  const imgEl = document.getElementById("cfImg");
  const rectEl = document.getElementById("cfRect");
  const emptyStageEl = document.getElementById("cfEmpty");
  const sizeInfoEl = document.getElementById("cfSizeInfo");
  const frameEl = document.getElementById("cfFrame");
  const frameLabelEl = document.getElementById("cfFrameLabel");
  const statusEl = document.getElementById("cfStatus");

  let mode = "auto"; // "auto" | "size"
  let anchor = { ax: 0.5, ay: 0.5 };
  let scope = "shared"; // Auto Crop: "shared" (chung 1 khung cho ca chuoi) | "each" (rieng tung anh)
  const bounds = new Map(); // filePath -> { width, height, bbox }
  let scanToken = 0;
  let busy = false;
  let cacheBust = 0; // tang sau moi lan crop de anh xem truoc nap lai file moi

  const fl = makeSimpleFileList(listEl, {
    acceptExt: IMG_EXT,
    onChange: () => {
      const has = fl.files.length > 0;
      emptyEl.hidden = has;
      listEl.hidden = !has;
      frameEl.max = Math.max(0, fl.files.length - 1);
      if (+frameEl.value > +frameEl.max) frameEl.value = frameEl.max;
      scan();
    },
  });
  emptyEl.hidden = false;
  listEl.hidden = true;

  function collect(p, out, depth = 0) {
    let st;
    try { st = fs.statSync(p); } catch (e) { return; }
    if (st.isDirectory()) {
      if (depth > 4) return;
      for (const n of fs.readdirSync(p)) collect(path.join(p, n), out, depth + 1);
    } else if (IMG_EXT.includes(path.extname(p).toLowerCase())) out.push(p);
  }

  function addPaths(paths) {
    const found = [];
    for (const p of paths) collect(p, found);
    found.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const before = fl.files.length;
    for (const p of found) if (!fl.files.includes(p)) fl.files.push(p);
    fl.files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!found.length) toast("Không tìm thấy file PNG/JPG hợp lệ.");
    if (fl.files.length !== before) fl.render();
  }

  setupDropzoneVisuals(dropEl);
  dropEl.addEventListener("drop", (e) => {
    e.preventDefault();
    addPaths(Array.from(e.dataTransfer.files || []).map(getFilePath).filter(Boolean));
  });
  clearBtn.addEventListener("click", () => { fl.clear(); bounds.clear(); });

  // ---- quet alpha cua ca chuoi (chi doc file, cache theo duong dan) ----
  async function scan() {
    const token = ++scanToken;
    const todo = fl.files.filter((p) => !bounds.has(p));
    for (let i = 0; i < todo.length; i++) {
      if (token !== scanToken) return;
      setStatus(`Đang quét ${i + 1}/${todo.length}...`);
      try { bounds.set(todo[i], await getAlphaBounds(todo[i])); }
      catch (e) { bounds.set(todo[i], { error: e.message }); }
    }
    if (token !== scanToken) return;
    update();
  }

  function setStatus(text, warn) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("warn", !!warn);
  }

  function infos() {
    return fl.files.map((p) => ({ p, b: bounds.get(p) })).filter((it) => it.b && !it.b.error);
  }

  /** Tinh khung crop cho tung frame: [{ p, width, height, rect: {x,y,w,h} }], hoac { error }. */
  function plan() {
    const list = infos();
    if (!list.length) return { error: "" };
    const sizes = new Set(list.map((it) => it.b.width + "x" + it.b.height));
    const mixed = sizes.size > 1;
    if (mode === "auto") {
      const pad = Math.max(0, parseInt(paddingEl.value, 10) || 0);
      // khung tu bbox (x0..x1, y0..y1) cua anh W×H: giu tam neu can, roi chua le
      const rectFrom = (x0, y0, x1, y1, W, H) => {
        if (keepCenterEl.checked) {
          const cx = Math.min(x0, W - x1), cy = Math.min(y0, H - y1);
          x0 = cx; x1 = W - cx; y0 = cy; y1 = H - cy;
        }
        return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
      };
      if (scope === "each") {
        // nhu Smart Crop cu: moi anh crop theo vung ve cua chinh no (anh trong suot hoan toan thi giu nguyen)
        if (!list.some((it) => it.b.bbox)) return { error: "Các ảnh đều trong suốt, không có gì để crop." };
        return {
          mixed: false, each: true,
          frames: list.map((it) => ({
            p: it.p, width: it.b.width, height: it.b.height,
            rect: it.b.bbox
              ? rectFrom(it.b.bbox.x0, it.b.bbox.y0, it.b.bbox.x1, it.b.bbox.y1, it.b.width, it.b.height)
              : { x: 0, y: 0, w: it.b.width, h: it.b.height },
          })),
        };
      }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const { b } of list) {
        if (!b.bbox) continue;
        x0 = Math.min(x0, b.bbox.x0); y0 = Math.min(y0, b.bbox.y0);
        x1 = Math.max(x1, b.bbox.x1); y1 = Math.max(y1, b.bbox.y1);
      }
      if (x1 < 0) return { error: "Cả chuỗi đều trong suốt, không có gì để crop." };
      // giu tam tinh theo frame dau, de pivot ca chuoi khong lech
      const rect = rectFrom(x0, y0, x1, y1, list[0].b.width, list[0].b.height);
      return { mixed, frames: list.map((it) => ({ p: it.p, width: it.b.width, height: it.b.height, rect })) };
    }
    const w = parseInt(widthEl.value, 10), h = parseInt(heightEl.value, 10);
    if (!(w > 0) || !(h > 0)) return { error: "Nhập Rộng và Cao (px) hợp lệ." };
    return {
      mixed,
      frames: list.map((it) => ({
        p: it.p, width: it.b.width, height: it.b.height,
        rect: { x: Math.round((it.b.width - w) * anchor.ax), y: Math.round((it.b.height - h) * anchor.ay), w, h },
      })),
    };
  }

  function update() {
    const has = fl.files.length > 0;
    canvasEl.hidden = !has;
    emptyStageEl.hidden = has;
    frameEl.parentElement.hidden = !has;
    if (!has) { sizeInfoEl.textContent = ""; frameLabelEl.textContent = ""; setStatus(""); return; }

    const idx = Math.min(+frameEl.value, fl.files.length - 1);
    const p = fl.files[idx];
    const b = bounds.get(p);
    frameLabelEl.textContent = `${idx + 1}/${fl.files.length} · ${path.basename(p)}`;
    const url = require("url").pathToFileURL(p).href + "?v=" + cacheBust;
    if (imgEl.dataset.src !== url) { imgEl.src = url; imgEl.dataset.src = url; }
    if (!b || b.error) { rectEl.hidden = true; return; }

    // khung hien thi vua stage, giu dung ti le anh
    const sw = stageEl.clientWidth - 24, sh = stageEl.clientHeight - 24;
    const scale = Math.min(sw / b.width, sh / b.height, 4);
    canvasEl.style.width = b.width * scale + "px";
    canvasEl.style.height = b.height * scale + "px";

    const res = plan();
    if (res.error !== undefined) {
      rectEl.hidden = true;
      sizeInfoEl.textContent = `${b.width}×${b.height}`;
      setStatus(res.error, !!res.error);
      return;
    }
    const f = res.frames.find((it) => it.p === p) || res.frames[0];
    rectEl.hidden = false;
    rectEl.style.left = f.rect.x * scale + "px";
    rectEl.style.top = f.rect.y * scale + "px";
    rectEl.style.width = f.rect.w * scale + "px";
    rectEl.style.height = f.rect.h * scale + "px";
    sizeInfoEl.innerHTML = `${b.width}×${b.height} → <b>${f.rect.w}×${f.rect.h}</b>`;
    const same = res.frames.every((it) => it.rect.x === 0 && it.rect.y === 0 && it.rect.w === it.width && it.rect.h === it.height);
    if (res.each) {
      const n = res.frames.filter((it) => !(it.rect.x === 0 && it.rect.y === 0 && it.rect.w === it.width && it.rect.h === it.height)).length;
      setStatus(n ? `${n}/${res.frames.length} ảnh sẽ được crop, mỗi ảnh theo vùng vẽ của riêng nó (kích thước khác nhau).` : "Các ảnh đã vừa khít, không còn phần thừa để crop.");
    } else if (res.mixed) setStatus("Các frame trong chuỗi không cùng kích thước — vẫn crop được nhưng nên kiểm tra lại.", true);
    else if (same) setStatus("Chuỗi đã vừa khít, không còn phần thừa để crop.");
    else setStatus(`${res.frames.length} frame sẽ ra cùng kích thước ${f.rect.w}×${f.rect.h}.`);
  }

  // ---- dieu khien ----
  function setMode(m) {
    mode = m;
    modeToggleEl.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    autoFieldsEl.hidden = m !== "auto";
    sizeFieldsEl.hidden = m !== "size";
    // mac dinh W×H = vung Auto Crop hien tai, de chinh tiep cho nhanh
    if (m === "size" && !widthEl.value && !heightEl.value) {
      const prev = mode; mode = "auto";
      const r = plan(); mode = prev;
      if (r.frames) { widthEl.value = r.frames[0].rect.w; heightEl.value = r.frames[0].rect.h; }
    }
    update();
  }
  modeToggleEl.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  const AUTO_HINT = {
    shared: "Tự tìm điểm xa nhất có pixel được vẽ trong <b>cả chuỗi</b>, cắt bỏ phần trong suốt thừa. Mọi frame ra cùng 1 kích thước, không lệch vị trí.",
    each: "Mỗi ảnh tự cắt theo vùng vẽ của <b>chính nó</b>, kích thước ra khác nhau — dùng cho các symbol rời. Bật Giữ tâm ảnh là giống Smart Crop cũ.",
  };
  function setScope(v) {
    scope = v;
    scopeToggleEl.querySelectorAll(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.scope === v));
    autoHintEl.innerHTML = AUTO_HINT[v];
    update();
  }
  scopeToggleEl.querySelectorAll(".mode-btn").forEach((b) => b.addEventListener("click", () => setScope(b.dataset.scope)));
  autoHintEl.innerHTML = AUTO_HINT.shared;
  anchorEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    anchor = { ax: parseFloat(b.dataset.ax), ay: parseFloat(b.dataset.ay) };
    anchorEl.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    update();
  }));
  [paddingEl, widthEl, heightEl].forEach((el) => el.addEventListener("input", update));
  keepCenterEl.addEventListener("change", update);
  frameEl.addEventListener("input", update);
  new ResizeObserver(() => { if (!document.querySelector('.tab-panel[data-panel="cropfbf"]').hidden) update(); }).observe(stageEl);

  async function runCropFbf() {
    if (busy) return { success: 0, failed: [] };
    if (!fl.files.length) { toast("Hãy thêm chuỗi hình trước."); return { success: 0, failed: [] }; }
    await scan();
    const res = plan();
    if (res.error !== undefined) { toast(res.error || "Chưa quét xong chuỗi hình."); return { success: 0, failed: [] }; }
    const todo = res.frames.filter((it) => !(it.rect.x === 0 && it.rect.y === 0 && it.rect.w === it.width && it.rect.h === it.height));
    if (!todo.length) { toast("Không có gì để crop."); return { success: 0, failed: [] }; }
    busy = true;
    runBtn.disabled = true;
    let success = 0;
    const failed = [];
    for (let i = 0; i < todo.length; i++) {
      setStatus(`Đang crop ${i + 1}/${todo.length}...`);
      try { await cropToRect(todo[i].p, todo[i].rect); success++; }
      catch (e) { failed.push(`${path.basename(todo[i].p)}: ${e.message}`); }
      bounds.delete(todo[i].p);
    }
    busy = false;
    runBtn.disabled = false;
    cacheBust++; // anh da doi, nap lai
    if (failed.length) { toast(`Crop ${success} file, lỗi ${failed.length}.`); console.error(failed.join("\n")); }
    else toast(res.each ? `Đã crop ${success} ảnh.` : `Đã crop ${success} file về ${todo[0].rect.w}×${todo[0].rect.h}.`);
    await scan();
    return { success, failed };
  }
  runBtn.addEventListener("click", runCropFbf);

  update();
  window.__cropFbfTest = { addPaths, run: runCropFbf, setMode, setScope, plan, scan, paddingEl, keepCenterEl, widthEl, heightEl, frameEl, get files() { return fl.files; } };
})();

// ============================================================
// FBF VIEWER — playlist nhieu chuoi anh: tha 1 hoac nhieu folder (hoac file anh) vao,
// app quet ra tung chuoi va liet ke ben phai; click ten nao thi play chuoi do.
// ============================================================
(function initFrames() {
  const VALID_EXT = [".png", ".jpg", ".jpeg"];
  const MAX_SCAN_DEPTH = 6; // folder con long nhau toi da bao nhieu cap
  let playlist = []; // [{ id, label, group, dir, frames: [{filePath, num, fileName}] }]
  let current = null; // phan tu dang xem trong playlist | null
  let preloaded = []; // Image da tai san cua chuoi dang xem (cung thu tu voi current.frames)
  let stageImg = null; // 1 the <img> co dinh tren stage, chi doi src khi chuyen khung
  let currentIndex = 0;
  let playing = false;
  let timer = null;

  const stageEl = document.getElementById("fvStage");
  const stageContentEl = document.getElementById("fvStageContent");
  const playlistEl = document.getElementById("fvPlaylist");
  const playlistItemsEl = document.getElementById("fvPlaylistItems");
  const playlistCountEl = document.getElementById("fvPlaylistCount");
  const playlistClearBtn = document.getElementById("fvPlaylistClear");
  const fpsPresetsEl = document.getElementById("fvFpsPresets");
  const speedPresetsEl = document.getElementById("fvSpeedPresets");
  const playBtn = document.getElementById("fvPlayBtn");
  const scrubEl = document.getElementById("fvScrub");
  const fpsEl = document.getElementById("fvFps");
  const metaEl = document.getElementById("fvMeta");
  const pingPongBtn = document.getElementById("fvPingPongBtn");
  const reverseBtn = document.getElementById("fvReverseBtn");
  let pingPong = false;
  let reverse = false; // tua nguoc: play tu khung cuoi ve khung dau
  let speed = 1; // 1x/2x/3x/4x — nhan voi toc do play, khong doi FPS hien thi

  const EMPTY_HTML = `
    <div class="fv-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v12M12 3l-4 4M12 3l4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
      <span>Kéo thả 1 hoặc nhiều folder chuỗi hình vào đây<br>(hoặc kéo thẳng các file ảnh)</span>
    </div>`;

  // pathToFileURL ma hoa dung dau cach, #, % ... trong duong dan Windows.
  const fileUrl = (p) => require("url").pathToFileURL(p).href;

  function splitName(base) {
    const m = base.match(/^(.*?)[-_\s]?(\d+)$/);
    if (m) return { group: m[1], num: parseInt(m[2], 10) };
    return { group: base, num: 0 };
  }

  for (const el of [stageEl, playlistEl]) {
    setupDropzoneVisuals(el);
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      handleDropped(Array.from(e.dataTransfer.files || []));
    });
  }

  function handleDropped(files) {
    const paths = [];
    for (const f of files) {
      const filePath = getFilePath(f);
      if (filePath) paths.push(filePath);
    }
    return handleDroppedPaths(paths);
  }

  /** Quet cac duong dan duoc tha vao (folder hoac file) thanh danh sach file anh [{name, filePath}]. */
  async function collectImages(paths) {
    const out = [];
    async function walk(p, depth) {
      let st;
      try { st = await fs.promises.stat(p); } catch (e) { return; }
      if (st.isDirectory()) {
        if (depth > MAX_SCAN_DEPTH) return;
        let names = [];
        try { names = await fs.promises.readdir(p); } catch (e) { return; }
        for (const n of names) await walk(path.join(p, n), depth + 1);
      } else if (VALID_EXT.includes(path.extname(p).toLowerCase())) {
        out.push({ name: path.basename(p), filePath: p });
      }
    }
    for (const p of paths) await walk(p, 0);
    return out;
  }

  async function handleDroppedPaths(paths) {
    if (!paths.length) return;
    metaEl.textContent = "Đang quét...";
    const raw = await collectImages(paths);
    metaEl.textContent = "";
    handleDroppedRaw(raw);
  }

  /**
   * Cot loi khong phu thuoc DOM File — nhan [{name, filePath}], de test headless goi truc tiep.
   * Moi cap (folder, ten goc) la 1 chuoi trong playlist. Tha them se noi vao playlist,
   * chuoi da co (cung folder + ten goc) thi cap nhat lai khung hinh.
   */
  function handleDroppedRaw(rawItems) {
    const seqs = new Map();
    for (const r of rawItems) {
      const ext = path.extname(r.name).toLowerCase();
      if (!VALID_EXT.includes(ext) || !r.filePath) continue;
      const { group, num } = splitName(path.basename(r.name, ext));
      const dir = path.dirname(r.filePath);
      const id = dir + "|" + group;
      if (!seqs.has(id)) seqs.set(id, { id, group, dir, frames: [] });
      seqs.get(id).frames.push({ filePath: r.filePath, num, fileName: r.name });
    }
    if (!seqs.size) { toast("Không tìm thấy file PNG/JPG hợp lệ."); return; }

    // Folder chi co 1 chuoi thi hien ten folder; folder co nhieu chuoi thi them ten goc cho de phan biet.
    const perDir = {};
    for (const sq of seqs.values()) perDir[sq.dir] = (perDir[sq.dir] || 0) + 1;

    for (const sq of seqs.values()) {
      sq.frames.sort((a, b) => a.num - b.num || a.fileName.localeCompare(b.fileName));
      const folder = path.basename(sq.dir);
      sq.label = perDir[sq.dir] > 1 ? `${folder} / ${sq.group || "(không tên)"}` : folder;
      const idx = playlist.findIndex((p) => p.id === sq.id);
      if (idx >= 0) playlist[idx] = sq; else playlist.push(sq);
    }
    playlist.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    const firstNew = playlist.find((p) => seqs.has(p.id));
    if (seqs.size > 1) toast(`Đã thêm ${seqs.size} chuỗi hình vào playlist.`);
    selectSequence(firstNew.id);
  }

  function selectSequence(id, autoPlay) {
    const sq = playlist.find((p) => p.id === id);
    if (!sq) return;
    stopPlaying();
    current = sq;
    currentIndex = 0;
    // Tai truoc ca chuoi: anh FX lon ma doi tai luc dang play thi khung xem bi trong.
    preloaded = sq.frames.map((f) => { const im = new Image(); im.src = fileUrl(f.filePath); return im; });
    scrubEl.max = Math.max(0, sq.frames.length - 1);
    scrubEl.value = 0;
    renderPlaylist();
    renderFrame();
    if (autoPlay) startPlaying();
  }

  function removeSequence(id) {
    const idx = playlist.findIndex((p) => p.id === id);
    if (idx < 0) return;
    playlist.splice(idx, 1);
    if (current && current.id === id) {
      stopPlaying();
      current = null;
      preloaded = [];
      const next = playlist[Math.min(idx, playlist.length - 1)];
      if (next) { selectSequence(next.id); return; }
      renderFrame();
    }
    renderPlaylist();
  }

  function clearPlaylist() {
    stopPlaying();
    playlist = [];
    current = null;
    preloaded = [];
    currentIndex = 0;
    renderPlaylist();
    renderFrame();
  }
  playlistClearBtn.addEventListener("click", clearPlaylist);

  function renderPlaylist() {
    playlistCountEl.textContent = playlist.length;
    playlistClearBtn.disabled = playlist.length === 0;
    playlistItemsEl.innerHTML = "";
    if (!playlist.length) {
      const empty = document.createElement("div");
      empty.className = "fv-pl-empty";
      empty.textContent = "Kéo thả 1 hoặc nhiều folder ảnh vào đây";
      playlistItemsEl.appendChild(empty);
      return;
    }
    for (const sq of playlist) {
      const row = document.createElement("div");
      row.className = "fv-pl-item" + (current && current.id === sq.id ? " active" : "");
      row.title = `${sq.label}\n${sq.dir}`;
      const name = document.createElement("span");
      name.className = "fv-pl-name";
      name.textContent = sq.label;
      const count = document.createElement("span");
      count.className = "fv-pl-count";
      count.textContent = sq.frames.length;
      const del = document.createElement("button");
      del.className = "fv-pl-del";
      del.type = "button";
      del.textContent = "✕";
      del.title = "Bỏ khỏi playlist";
      del.addEventListener("click", (e) => { e.stopPropagation(); removeSequence(sq.id); });
      row.append(name, count, del);
      row.addEventListener("click", () => selectSequence(sq.id, true));
      playlistItemsEl.appendChild(row);
    }
    const activeRow = playlistItemsEl.querySelector(".fv-pl-item.active");
    if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
  }

  function renderFrame() {
    if (!current || !current.frames.length) {
      stageEl.classList.add("empty");
      stageContentEl.innerHTML = EMPTY_HTML;
      metaEl.textContent = "";
      return;
    }
    stageEl.classList.remove("empty");
    const frames = current.frames;
    currentIndex = Math.max(0, Math.min(currentIndex, frames.length - 1));
    const f = frames[currentIndex];

    if (!stageImg || !stageContentEl.contains(stageImg)) {
      stageContentEl.innerHTML = "";
      stageImg = document.createElement("img");
      stageContentEl.appendChild(stageImg);
    }
    // Khung chua tai xong thi giu khung dang hien, khong de stage bi trong.
    const pre = preloaded[currentIndex];
    const url = fileUrl(f.filePath);
    if (stageImg.dataset.src !== url && (!stageImg.dataset.src || !pre || pre.complete)) {
      stageImg.src = url;
      stageImg.dataset.src = url;
    }

    metaEl.textContent = `${current.label} · ${frames.length} khung · ${f.fileName}`;
  }

  scrubEl.addEventListener("input", () => {
    stopPlaying();
    currentIndex = parseInt(scrubEl.value, 10);
    renderFrame();
  });

  playBtn.addEventListener("click", () => { playing ? stopPlaying() : startPlaying(); });

  // Playback: tong thoi luong 1 vong luon co dinh theo NATIVE_FPS (gia dinh chuoi anh
  // duoc xuat o 30fps). Chon FPS thap hon (15/12) khong lam CHAM di — no van xoay
  // dung 1 vong trong cung khoang thoi gian do, chi la hien thi it khung hinh hon
  // trong khoang do nen trong giat/khong muot hon, dung nhu preview FPS thuc te trong Cocos/Spine.
  const NATIVE_FPS = 30;

  // Ping-pong: "chieu dai ao" cua 1 vong la 2*(n-1) — di het xuoi (0..n-1) roi
  // nguoc lai (n-2..1) truoc khi lap lai tu 0, giu nguyen tong thoi luong 1 vong
  // (chu ky se dai gap doi so voi khong bat ping-pong, dung nhu choi ca 2 chieu).
  function computeVirtualLength(n) {
    return pingPong ? Math.max(1, 2 * (n - 1)) : n;
  }

  function virtualIndexToFrameIndex(vIdx, n) {
    if (!pingPong || n < 2) return vIdx % n;
    const period = 2 * (n - 1);
    let m = vIdx % period;
    if (m < 0) m += period;
    return m < n ? m : period - m;
  }

  function startPlaying() {
    if (!current || current.frames.length < 2) return;
    playing = true;
    playBtn.textContent = "❚❚";
    const frameCount = current.frames.length;
    const virtualLen = computeVirtualLength(frameCount);
    // Speed (x1/x2/x3/x4) chia thang vao tong thoi luong 1 vong — vong xoay nhanh hon
    // dung theo boi so, khong dung lam thay doi FPS hien thi (van dung 1 co che voi ping-pong/FPS).
    const cycleMs = (virtualLen / NATIVE_FPS) * 1000 / speed;
    const fps = Math.max(1, parseInt(fpsEl.value, 10) || 30);
    const tickMs = 1000 / fps;
    // Tua nguoc = doi chieu chi so khung (n-1-i); van dung chung voi ping-pong/FPS/speed.
    const flip = (i) => (reverse ? frameCount - 1 - i : i);
    const startTime = performance.now() - (flip(currentIndex) / virtualLen) * cycleMs;
    timer = setInterval(() => {
      const elapsed = (performance.now() - startTime) % cycleMs;
      const vIdx = Math.floor((elapsed / cycleMs) * virtualLen) % virtualLen;
      currentIndex = flip(virtualIndexToFrameIndex(vIdx, frameCount));
      scrubEl.value = currentIndex;
      renderFrame();
    }, tickMs);
  }

  function stopPlaying() {
    playing = false;
    playBtn.textContent = "▶";
    if (timer) clearInterval(timer);
    timer = null;
  }

  function setFps(v) {
    fpsEl.value = v;
    updateActivePreset();
    if (playing) { stopPlaying(); startPlaying(); }
  }

  function updateActivePreset() {
    const v = String(parseInt(fpsEl.value, 10));
    fpsPresetsEl.querySelectorAll(".fv-fps-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.fps === v);
    });
  }

  fpsPresetsEl.querySelectorAll(".fv-fps-btn").forEach((b) => {
    b.addEventListener("click", () => setFps(b.dataset.fps));
  });
  fpsEl.addEventListener("change", () => {
    updateActivePreset();
    if (playing) { stopPlaying(); startPlaying(); }
  });
  updateActivePreset();

  function setSpeed(v) {
    speed = Math.max(1, parseInt(v, 10) || 1);
    updateActiveSpeedPreset();
    if (playing) { stopPlaying(); startPlaying(); }
  }

  function updateActiveSpeedPreset() {
    const v = String(speed);
    speedPresetsEl.querySelectorAll(".fv-fps-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.speed === v);
    });
  }

  speedPresetsEl.querySelectorAll(".fv-fps-btn").forEach((b) => {
    b.addEventListener("click", () => setSpeed(b.dataset.speed));
  });
  updateActiveSpeedPreset();

  function setPingPong(v) {
    pingPong = !!v;
    pingPongBtn.classList.toggle("active", pingPong);
    if (playing) { stopPlaying(); startPlaying(); }
  }

  pingPongBtn.addEventListener("click", () => setPingPong(!pingPong));

  function setReverse(v) {
    reverse = !!v;
    reverseBtn.classList.toggle("active", reverse);
    if (playing) { stopPlaying(); startPlaying(); }
  }

  reverseBtn.addEventListener("click", () => setReverse(!reverse));

  document.addEventListener("keydown", (e) => {
    if (document.querySelector('.tab-panel[data-panel="frames"]').hidden) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (e.code === "Space") {
      e.preventDefault();
      if (!current) return;
      playing ? stopPlaying() : startPlaying();
      return;
    }
    if (e.key === "p" || e.key === "P") {
      setPingPong(!pingPong);
      return;
    }
    if (e.key === "r" || e.key === "R") {
      setReverse(!reverse);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && current) {
      removeSequence(current.id);
      return;
    }
    // Mui ten len/xuong: chuyen sang chuoi truoc/sau trong playlist, giu trang thai dang play.
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && playlist.length) {
      e.preventDefault();
      const idx = current ? playlist.indexOf(current) : -1;
      const next = playlist[Math.max(0, Math.min(playlist.length - 1, idx + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next && next !== current) selectSequence(next.id, playing);
    }
  });

  renderPlaylist();
  renderFrame();

  // expose for internal test harness (headless smoke test)
  window.__fbfViewer = {
    handleDropped, handleDroppedRaw, handleDroppedPaths, selectSequence, removeSequence, clearPlaylist, startPlaying, stopPlaying, setFps,
    setPingPong, setReverse, computeVirtualLength, virtualIndexToFrameIndex, setSpeed,
    get playing() { return playing; },
    get currentIndex() { return currentIndex; },
    get current() { return current; },
    get playlist() { return playlist; },
    get pingPong() { return pingPong; },
    get reverse() { return reverse; },
    get speed() { return speed; },
  };
})();
