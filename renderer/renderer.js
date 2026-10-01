const fs = require("fs");
const path = require("path");
const { blurSymbol, smartCrop, resizeImagePercent, resizeImagePixel, getImageSize } = require("../lib/imaging.js");

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
  crop: { label: "Smart Crop", group: "XỬ LÝ ẢNH", desc: "Tự động crop theo alpha, giữ đối xứng tâm ảnh — không lệch pivot." },
  rename: { label: "Rename", group: "XỬ LÝ ẢNH", desc: "Đổi tên hàng loạt, thêm hậu tố ## để tự đánh số thứ tự." },
  resize: { label: "Resize", group: "XỬ LÝ ẢNH", desc: "Scale hàng loạt PNG theo % hoặc theo pixel, ghi đè trực tiếp lên file gốc." },
  frames: { label: "FBF Viewer", group: "ANIMATION", desc: "Xem trước chuỗi hình frame by frame." },
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

function setupDropzoneVisuals(el) {
  el.addEventListener("dragenter", (e) => { e.preventDefault(); el.classList.add("dragover"); });
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("dragleave", () => el.classList.remove("dragover"));
  el.addEventListener("drop", () => el.classList.remove("dragover"));
}

// ============================================================
// MERGE ATLAS
// ============================================================
(function initAtlas() {
  const dropEl = document.getElementById("atlasDrop");
  const labelEl = document.getElementById("atlasDropLabel");
  const mergeBtn = document.getElementById("atlasMergeBtn");
  let selectedFile = null;

  setupDropzoneVisuals(dropEl);
  dropEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const filePath = getFilePath(files[0]);
    if (!filePath || !filePath.toLowerCase().endsWith(".png")) {
      toast("Chỉ nhận file PNG");
      return;
    }
    selectedFile = filePath;
    labelEl.textContent = "File: " + path.basename(filePath);
  });

  function runMerge() {
    if (!selectedFile) {
      toast("Chưa chọn file PNG");
      return false;
    }
    try {
      const folder = path.dirname(selectedFile);
      const pngName = path.basename(selectedFile);

      for (const f of fs.readdirSync(folder)) {
        if (f.toLowerCase().endsWith(".png") && f !== pngName) {
          try { fs.unlinkSync(path.join(folder, f)); } catch (e) {}
        }
      }
      for (const f of fs.readdirSync(folder)) {
        if (f.toLowerCase().endsWith(".atlas")) {
          const atlasPath = path.join(folder, f);
          try {
            const lines = fs.readFileSync(atlasPath, "utf-8").split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(".png")) { lines[i] = pngName; break; }
            }
            fs.writeFileSync(atlasPath, lines.join("\n"));
          } catch (e) {}
        }
      }
      toast("Đã merge xong");
      return true;
    } catch (e) {
      toast("Lỗi: " + e.message);
      return false;
    }
  }

  mergeBtn.addEventListener("click", runMerge);
  window.__atlasTest = {
    setSelectedFile: (p) => { selectedFile = p; labelEl.textContent = "File: " + path.basename(p); },
    run: runMerge,
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

  return { files, add, render, removeAt, clear };
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
  const statusEl = document.getElementById("blurStatus");
  const amountEl = document.getElementById("blurAmount");
  const lightEl = document.getElementById("blurLightness");
  const fl = makeDropzoneFileList(dropEl);

  clearBtn.addEventListener("click", () => { fl.clear(); statusEl.textContent = ""; });

  async function runApply() {
    if (!fl.files.length) { toast("Hãy thêm PNG trước."); return; }
    const blur = parseFloat(amountEl.value);
    const lightness = parseInt(lightEl.value, 10);
    if (Number.isNaN(blur) || Number.isNaN(lightness)) { toast("Giá trị không hợp lệ."); return; }

    applyBtn.disabled = true;
    const failed = [];
    for (let i = 0; i < fl.files.length; i++) {
      statusEl.textContent = `Processing ${i + 1}/${fl.files.length}`;
      try {
        await blurSymbol(fl.files[i], blur, lightness);
      } catch (e) {
        failed.push(`${path.basename(fl.files[i])}: ${e.message}`);
      }
    }
    statusEl.textContent = "Done!";
    applyBtn.disabled = false;
    if (failed.length) toast(`Xong với ${failed.length} lỗi — xem console.`);
    else toast(`Đã xử lý ${fl.files.length} file.`);
    if (failed.length) console.error("Blur errors:\n" + failed.join("\n"));
    return { failed };
  }

  applyBtn.addEventListener("click", runApply);
  window.__blurTest = { fl, run: runApply, amountEl, lightEl };
})();

// ============================================================
// SMART CROP
// ============================================================
(function initCrop() {
  const dropEl = document.getElementById("cropDrop");
  const runBtn = document.getElementById("cropRunBtn");
  const clearBtn = document.getElementById("cropClearBtn");
  const fl = makeDropzoneFileList(dropEl);

  clearBtn.addEventListener("click", () => fl.clear());

  async function runCrop() {
    if (!fl.files.length) { toast("Hãy thêm PNG trước."); return { success: 0, failed: [] }; }
    let success = 0;
    const failed = [];
    for (const p of fl.files) {
      try { await smartCrop(p); success++; }
      catch (e) { failed.push(`${path.basename(p)}: ${e.message}`); }
    }
    if (failed.length) { toast(`Crop thành công ${success}, lỗi ${failed.length}.`); console.error(failed.join("\n")); }
    else toast(`Đã crop ${success} file.`);
    return { success, failed };
  }

  runBtn.addEventListener("click", runCrop);
  window.__cropTest = { fl, run: runCrop };
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

  let files = [];

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

  function render() {
    listEl.innerHTML = "";
    files.forEach((p, i) => {
      const oldName = path.basename(p);
      const ext = path.extname(oldName);
      const newName = generateNewName(templateEl.value, i, ext, oldName);
      const row = document.createElement("div");
      row.className = "filerow";
      row.innerHTML = `<span>${oldName}</span><span class="arrow">→</span><span class="new">${newName}</span>`;
      listEl.appendChild(row);
    });
    const has = files.length > 0;
    emptyEl.hidden = has;
    listEl.hidden = !has;
  }

  templateEl.addEventListener("input", render);

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
    let success = 0;
    const failed = [];
    files = files.map((p, i) => {
      const folder = path.dirname(p);
      const oldName = path.basename(p);
      const ext = path.extname(oldName);
      const newName = generateNewName(templateEl.value, i, ext, oldName);
      const newPath = path.join(folder, newName);
      try { fs.renameSync(p, newPath); success++; return newPath; }
      catch (e) { failed.push(`${oldName}: ${e.message}`); return p; }
    });
    render();
    if (failed.length) { toast(`Đổi tên thất bại ${failed.length} file.`); console.error(failed.join("\n")); }
    else toast(`Đã đổi tên ${success} file`);
    return { success, failed };
  }

  runBtn.addEventListener("click", runRename);
  window.__renameTest = {
    addFile: (p) => { if (!files.includes(p)) files.push(p); render(); },
    run: runRename,
    templateEl,
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

  let mode = "percent"; // "percent" | "pixel"
  let refW = null, refH = null; // kich thuoc file dau tien — dung de preview ti le truc tiep tren UI
  let sizesMismatched = false; // cac file trong chuoi khong cung 1 kich thuoc -> khong cho resize theo pixel
  // "width" | "height" | null — o nguoi dung VUA tu tay go; o con lai chi la preview theo ti le
  // cua file dau tien. Luc resize that, chi o nay duoc dung nhu gia tri that (chieu con lai
  // se duoc tinh RIENG cho tung file theo dung ti le cua chinh file do).
  let lastDriver = null;
  let pendingRefresh = Promise.resolve();

  const fl = makeDropzoneFileList(dropEl, {
    onChange: () => { pendingRefresh = refreshReferenceDims(); },
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

  widthEl.addEventListener("input", () => {
    lastDriver = "width";
    const w = parseFloat(widthEl.value);
    if (refW && refH && Number.isFinite(w) && w > 0) {
      heightEl.value = Math.max(1, Math.round(w * (refH / refW)));
    }
  });
  heightEl.addEventListener("input", () => {
    lastDriver = "height";
    const h = parseFloat(heightEl.value);
    if (refW && refH && Number.isFinite(h) && h > 0) {
      widthEl.value = Math.max(1, Math.round(h * (refW / refH)));
    }
  });

  function setMode(m) {
    mode = m === "pixel" ? "pixel" : "percent";
    modeToggleEl.querySelectorAll(".mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    percentFieldsEl.style.display = mode === "percent" ? "" : "none";
    pixelFieldsEl.style.display = mode === "pixel" ? "" : "none";
    if (mode === "pixel") pendingRefresh = refreshReferenceDims();
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
    return { success };
  }

  runBtn.addEventListener("click", runResize);
  window.__resizeTest = {
    fl, run: runResize, pctEl, widthEl, heightEl, setMode,
    get mode() { return mode; },
    get lastDriver() { return lastDriver; },
    get refW() { return refW; },
    get refH() { return refH; },
    get sizesMismatched() { return sizesMismatched; },
    get pendingRefresh() { return pendingRefresh; },
  };
})();

// ============================================================
// FBF VIEWER — xem 1 chuoi anh duy nhat tai 1 thoi diem (don gian hoa theo yeu cau Mondiro)
// ============================================================
(function initFrames() {
  const VALID_EXT = [".png", ".jpg", ".jpeg"];
  let current = null; // { group, dir, frames: [{filePath, num, fileName}] } | null
  let currentIndex = 0;
  let playing = false;
  let timer = null;

  const stageEl = document.getElementById("fvStage");
  const stageContentEl = document.getElementById("fvStageContent");
  const fpsPresetsEl = document.getElementById("fvFpsPresets");
  const speedPresetsEl = document.getElementById("fvSpeedPresets");
  const playBtn = document.getElementById("fvPlayBtn");
  const scrubEl = document.getElementById("fvScrub");
  const fpsEl = document.getElementById("fvFps");
  const metaEl = document.getElementById("fvMeta");
  const pingPongBtn = document.getElementById("fvPingPongBtn");
  let pingPong = false;
  let speed = 1; // 1x/2x/3x/4x — nhan voi toc do play, khong doi FPS hien thi

  const EMPTY_HTML = `
    <div class="fv-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v12M12 3l-4 4M12 3l4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
      <span>Kéo thả chuỗi hình vào đây</span>
    </div>`;

  function splitName(base) {
    const m = base.match(/^(.*?)[-_\s]?(\d+)$/);
    if (m) return { group: m[1], num: parseInt(m[2], 10) };
    return { group: base, num: 0 };
  }

  setupDropzoneVisuals(stageEl);
  stageEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    handleDropped(files);
  });

  function handleDropped(files) {
    const raw = [];
    for (const f of files) {
      const filePath = getFilePath(f);
      if (!filePath) continue;
      raw.push({ name: f.name, filePath });
    }
    handleDroppedRaw(raw);
  }

  /** Cot loi khong phu thuoc DOM File — nhan [{name, filePath}], de test headless goi truc tiep. */
  function handleDroppedRaw(rawItems) {
    const items = [];
    for (const r of rawItems) {
      const ext = path.extname(r.name).toLowerCase();
      if (!VALID_EXT.includes(ext)) continue;
      const base = path.basename(r.name, ext);
      const { group, num } = splitName(base);
      if (!r.filePath) continue;
      items.push({ group, num, fileName: r.name, filePath: r.filePath, dir: path.dirname(r.filePath) });
    }
    if (!items.length) { toast("Không tìm thấy file PNG/JPG hợp lệ."); return; }

    const groupsInDrop = [...new Set(items.map((i) => i.group))];
    if (groupsInDrop.length > 1) {
      toast(`Lượt thả này lẫn ${groupsInDrop.length} tên khác nhau. Vui lòng chỉ thả 1 chuỗi ảnh cùng tên gốc mỗi lần.`);
      return;
    }

    const groupName = groupsInDrop[0];
    const dirCounts = {};
    items.forEach((i) => { dirCounts[i.dir] = (dirCounts[i.dir] || 0) + 1; });
    const dir = Object.keys(dirCounts).sort((a, b) => dirCounts[b] - dirCounts[a])[0];

    const frames = items
      .map((it) => ({ filePath: it.filePath, num: it.num, fileName: it.fileName }))
      .sort((a, b) => a.num - b.num || a.fileName.localeCompare(b.fileName));

    // FBF Viewer chi xem 1 chuoi tai 1 thoi diem — thả chuỗi mới sẽ thay thế chuỗi cũ.
    stopPlaying();
    current = { group: groupName, dir, frames };
    currentIndex = 0;
    scrubEl.max = Math.max(0, frames.length - 1);
    scrubEl.value = 0;
    renderFrame();
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

    stageContentEl.innerHTML = "";
    const img = document.createElement("img");
    img.src = "file://" + f.filePath;
    stageContentEl.appendChild(img);

    metaEl.textContent = `${current.group} · ${frames.length} khung · ${f.fileName}`;
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
    const startTime = performance.now() - (currentIndex / virtualLen) * cycleMs;
    timer = setInterval(() => {
      const elapsed = (performance.now() - startTime) % cycleMs;
      const vIdx = Math.floor((elapsed / cycleMs) * virtualLen) % virtualLen;
      currentIndex = virtualIndexToFrameIndex(vIdx, frameCount);
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
    if ((e.key === "Delete" || e.key === "Backspace") && current) {
      current = null;
      currentIndex = 0;
      stopPlaying();
      renderFrame();
    }
  });

  renderFrame();

  // expose for internal test harness (headless smoke test)
  window.__fbfViewer = {
    handleDropped, handleDroppedRaw, startPlaying, stopPlaying, setFps,
    setPingPong, computeVirtualLength, virtualIndexToFrameIndex, setSpeed,
    get playing() { return playing; },
    get currentIndex() { return currentIndex; },
    get current() { return current; },
    get pingPong() { return pingPong; },
    get speed() { return speed; },
  };
})();
