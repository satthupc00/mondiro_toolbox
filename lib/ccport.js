// Particle CC Porting — chuyen goi particle (prefab + anim + anh + meta) qua lai giua Cocos Creator 2.1.3 va 3.6.3.
// Dinh dang lay theo cap mau that cua Mondiro (VFX_Particle_Coin_WinAmount ban 2.1.3 / 3.6.3).
const crypto = require("crypto");

const V2 = "2.1.3", V3 = "3.6.3";
const LAYER_UI_2D = 33554432;
const MAT_2D = "eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432"; // builtin-2d-sprite cua 2.x (particle/sprite deu dung)
const TEX = "6c48a", SF = "f9941"; // id subMeta texture / spriteFrame co dinh cua 3.x

// GL blend (2.x) <-> BlendFactor (3.x)
const BLEND_2TO3 = { 0: 0, 1: 1, 770: 2, 772: 3, 771: 4, 773: 5, 768: 6, 774: 7, 769: 8, 775: 9, 776: 10 };
const BLEND_3TO2 = Object.fromEntries(Object.entries(BLEND_2TO3).map(([k, v]) => [v, +k]));

const COMP_2TO3 = { "cc.ParticleSystem": "cc.ParticleSystem2D" };
const COMP_3TO2 = { "cc.ParticleSystem2D": "cc.ParticleSystem" };

const json = (s) => JSON.parse(typeof s === "string" ? s : Buffer.from(s).toString("utf-8"));
const dump = (o) => JSON.stringify(o, null, 2);
const vec3 = (x = 0, y = 0, z = 0) => ({ __type__: "cc.Vec3", x, y, z });
const white = () => ({ __type__: "cc.Color", r: 255, g: 255, b: 255, a: 255 });
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

// fileId kieu Cocos (22 ky tu base64)
function newFileId() {
  return crypto.randomBytes(17).toString("base64").replace(/=+$/, "").slice(0, 22);
}

// uuid spriteFrame cho 2.x khi di tu 3.x: co dinh theo uuid anh + ten (chuyen nhieu lan van ra cung 1 uuid)
function subUuid(texUuid, name) {
  const h = crypto.createHash("sha1").update("mondiro-ccport:" + texUuid + "/" + name).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

// Quat.fromEuler cua Cocos 3 (do)
function quatFromEuler(x, y, z) {
  const k = Math.PI / 360;
  x *= k; y *= k; z *= k;
  const sx = Math.sin(x), cx = Math.cos(x), sy = Math.sin(y), cy = Math.cos(y), sz = Math.sin(z), cz = Math.cos(z);
  return {
    __type__: "cc.Quat",
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz,
  };
}
const round6 = (v) => Math.round(v * 1e6) / 1e6;

// ---------------------------------------------------------------------------
// Nhan dien ban cua tung file
// ---------------------------------------------------------------------------
function fileVersion(path, text) {
  if (path.endsWith(".meta")) {
    try { return json(text).importer !== undefined ? V3 : V2; } catch (e) { return null; }
  }
  if (path.endsWith(".prefab")) return /"cc\.UITransform"|"_lpos"/.test(text) ? V3 : V2;
  if (path.endsWith(".anim")) return /"_tracks"/.test(text) ? V3 : V2;
  return null;
}

/** entries: { path: Uint8Array } (tu fflate.unzipSync). Tra ve { version, counts, total } */
function detect(entries) {
  const counts = { [V2]: 0, [V3]: 0 };
  for (const [p, data] of Object.entries(entries)) {
    if (!/\.(meta|prefab|anim)$/.test(p)) continue;
    const v = fileVersion(p, Buffer.from(data).toString("utf-8"));
    if (v) counts[v]++;
  }
  const total = counts[V2] + counts[V3];
  const version = !total ? null : counts[V2] >= counts[V3] ? V2 : V3;
  return { version, counts, mixed: counts[V2] > 0 && counts[V3] > 0 };
}

// ---------------------------------------------------------------------------
// META
// ---------------------------------------------------------------------------
const WRAP_2TO3 = { clamp: "clamp-to-edge", repeat: "repeat" };
const WRAP_3TO2 = { "clamp-to-edge": "clamp", repeat: "repeat", "mirrored-repeat": "repeat" };

function dirMeta2to3(m) {
  return { ver: "1.1.0", importer: "directory", imported: true, uuid: m.uuid, files: [], subMetas: {}, userData: { compressionType: {}, isRemoteBundle: {} } };
}
function dirMeta3to2(m) {
  return { ver: "1.0.1", uuid: m.uuid, isSubpackage: false, subpackageName: "", subMetas: {} };
}

function spriteVertices(s) {
  const w = s.width, h = s.height, rw = s.rawWidth || w, rh = s.rawHeight || h, tx = s.trimX || 0, ty = s.trimY || 0;
  return {
    rawPosition: [-w / 2, -h / 2, 0, w / 2, -h / 2, 0, -w / 2, h / 2, 0, w / 2, h / 2, 0],
    indexes: [0, 1, 2, 2, 1, 3],
    uv: [tx, ty + h, tx + w, ty + h, tx, ty, tx + w, ty],
    nuv: [tx / rw, 1 - (ty + h) / rh, (tx + w) / rw, 1 - (ty + h) / rh, tx / rw, 1 - ty / rh, (tx + w) / rw, 1 - ty / rh].map((v) => round6(v) + 0),
    minPos: [-w / 2, -h / 2, 0],
    maxPos: [w / 2, h / 2, 0],
  };
}

function imageMeta2to3(m, name, ext) {
  const u = m.uuid;
  const filter = m.filterMode || "bilinear";
  const texUser = {
    wrapModeS: WRAP_2TO3[m.wrapMode] || "clamp-to-edge",
    wrapModeT: WRAP_2TO3[m.wrapMode] || "clamp-to-edge",
    imageUuidOrDatabaseUri: u,
    isUuid: true,
    visible: false,
    minfilter: filter === "point" ? "nearest" : "linear",
    magfilter: filter === "point" ? "nearest" : "linear",
    mipfilter: filter === "trilinear" ? "linear" : "none",
    anisotropy: 0,
  };
  const subMetas = {
    [TEX]: { importer: "texture", uuid: `${u}@${TEX}`, displayName: name, id: TEX, name: "texture", userData: texUser, ver: "1.0.22", imported: true, files: [".json"], subMetas: {} },
  };
  const subs = Object.values(m.subMetas || {});
  const isSprite = (m.type || "sprite") === "sprite" && subs.length > 0;
  if (isSprite) {
    const s = subs[0];
    subMetas[SF] = {
      importer: "sprite-frame", uuid: `${u}@${SF}`, displayName: name, id: SF, name: "spriteFrame",
      userData: {
        trimType: s.trimType || "auto", trimThreshold: s.trimThreshold || 0, rotated: !!s.rotated,
        offsetX: s.offsetX || 0, offsetY: s.offsetY || 0, trimX: s.trimX || 0, trimY: s.trimY || 0,
        width: s.width, height: s.height, rawWidth: s.rawWidth, rawHeight: s.rawHeight,
        borderTop: s.borderTop || 0, borderBottom: s.borderBottom || 0, borderLeft: s.borderLeft || 0, borderRight: s.borderRight || 0,
        packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
        vertices: spriteVertices(s),
        isUuid: true, imageUuidOrDatabaseUri: `${u}@${TEX}`, atlasUuid: "",
      },
      ver: "1.0.11", imported: true, files: [".json"], subMetas: {},
    };
  }
  return {
    ver: "1.0.25", importer: "image", imported: true, uuid: u, files: [".json", ext], subMetas,
    userData: {
      type: isSprite ? "sprite-frame" : "texture",
      fixAlphaTransparencyArtifacts: true,
      hasAlpha: ext !== ".jpg" && ext !== ".jpeg",
      redirect: `${u}@${isSprite ? SF : TEX}`,
    },
  };
}

function imageMeta3to2(m, name) {
  const u = m.uuid;
  const tex = (m.subMetas || {})[TEX] || {};
  const sf = (m.subMetas || {})[SF];
  const tu = tex.userData || {};
  const filter = tu.minfilter === "nearest" ? "point" : tu.mipfilter && tu.mipfilter !== "none" ? "trilinear" : "bilinear";
  const out = {
    ver: "2.2.0", uuid: u, type: sf ? "sprite" : "raw",
    wrapMode: WRAP_3TO2[tu.wrapModeS] || "clamp", filterMode: filter, premultiplyAlpha: false, subMetas: {},
  };
  if (sf) {
    const s = sf.userData || {};
    out.subMetas[name] = {
      ver: "1.0.3", uuid: subUuid(u, name), rawTextureUuid: u,
      trimType: s.trimType || "auto", trimThreshold: s.trimThreshold || 0, rotated: !!s.rotated,
      offsetX: s.offsetX || 0, offsetY: s.offsetY || 0, trimX: s.trimX || 0, trimY: s.trimY || 0,
      width: s.width, height: s.height, rawWidth: s.rawWidth, rawHeight: s.rawHeight,
      borderTop: s.borderTop || 0, borderBottom: s.borderBottom || 0, borderLeft: s.borderLeft || 0, borderRight: s.borderRight || 0,
      subMetas: {},
    };
  }
  return out;
}

function animMeta2to3(m, name) {
  return { ver: "2.0.3", importer: "animation-clip", imported: true, uuid: m.uuid, files: [".cconb"], subMetas: {}, userData: { name } };
}
function animMeta3to2(m) {
  return { ver: "2.1.0", uuid: m.uuid, subMetas: {} };
}
function prefabMeta2to3(m, rootName) {
  return { ver: "1.1.40", importer: "prefab", imported: true, uuid: m.uuid, files: [".json"], subMetas: {}, userData: { syncNodeName: rootName } };
}
function prefabMeta3to2(m) {
  return { ver: "1.0.0", uuid: m.uuid, optimizationPolicy: "AUTO", asyncLoadAssets: false, readonly: false, subMetas: {} };
}

// ---------------------------------------------------------------------------
// PREFAB 2.1.3 -> 3.6.3
// ---------------------------------------------------------------------------
function prefab2to3(src, ctx) {
  const outArr = [];
  const head = src[0];
  const rootIdx = head.data.__id__;
  outArr.push({
    __type__: "cc.Prefab", _name: src[rootIdx]._name, _objFlags: 0, _native: "", data: { __id__: 1 },
    optimizationPolicy: head.optimizationPolicy || 0, persistent: false, asyncLoadAssets: !!head.asyncLoadAssets,
  });

  function emitNode(idx, parentId, isRoot) {
    const n = src[idx];
    const id = outArr.length;
    let pos = n._position, scl = n._scale, eul = n._eulerAngles;
    if (n._trs && n._trs.array) { // 2.x cu luu TRS dang mang
      const a = n._trs.array;
      pos = vec3(a[0], a[1], a[2]); scl = vec3(a[7], a[8], a[9]);
    }
    pos = pos || vec3(); scl = scl || vec3(1, 1, 1); eul = eul || vec3();
    const node = { __type__: "cc.Node", _name: n._name, _objFlags: n._objFlags || 0 };
    if (isRoot) node.__editorExtras__ = {};
    Object.assign(node, {
      _parent: parentId === null ? null : { __id__: parentId },
      _children: [], _active: n._active !== false, _components: [], _prefab: null,
      _lpos: vec3(pos.x, pos.y, pos.z || 0),
      _lrot: quatFromEuler(eul.x || 0, eul.y || 0, eul.z || 0),
      _lscale: vec3(scl.x, scl.y, scl.z === undefined ? 1 : scl.z),
      _layer: LAYER_UI_2D,
      _euler: vec3(eul.x || 0, eul.y || 0, eul.z || 0),
      _id: "",
    });
    outArr.push(node);
    for (const c of n._children || []) node._children.push({ __id__: emitNode(c.__id__, id, false) });

    const color = n._color ? clone(n._color) : white();
    const addComp = (obj) => {
      const cid = outArr.length;
      outArr.push(obj);
      const pid = outArr.length;
      outArr.push({ __type__: "cc.CompPrefabInfo", fileId: newFileId() });
      obj.__prefab = { __id__: pid };
      node._components.push({ __id__: cid });
    };
    const base = (type, c) => ({ __type__: type, _name: (c && c._name) || "", _objFlags: (c && c._objFlags) || 0, node: { __id__: id }, _enabled: c ? c._enabled !== false : true, __prefab: null });

    // node cua 2.x co san size/anchor -> UITransform rieng o 3.x (nam truoc cac component khac, root thi nam cuoi)
    const uiT = Object.assign(base("cc.UITransform"), {
      _contentSize: clone(n._contentSize) || { __type__: "cc.Size", width: 100, height: 100 },
      _anchorPoint: clone(n._anchorPoint) || { __type__: "cc.Vec2", x: 0.5, y: 0.5 },
      _id: "",
    });
    addComp(uiT);
    for (const ref of n._components || []) {
      const c = src[ref.__id__];
      addComp(component2to3(c, base, color, ctx));
    }
    if (n._opacity !== undefined && n._opacity !== 255) {
      addComp(Object.assign(base("cc.UIOpacity"), { _opacity: n._opacity, _id: "" }));
    }
    const pinfo = n._prefab ? src[n._prefab.__id__] : null;
    if (pinfo && pinfo.asset && pinfo.asset.__uuid__ && ctx.prefabUuid && pinfo.asset.__uuid__ !== ctx.prefabUuid) {
      ctx.warn(`Node "${n._name}" là prefab lồng (nested), đã chuyển thành node thường.`);
    }
    const pid = outArr.length;
    outArr.push({ __type__: "cc.PrefabInfo", root: { __id__: 1 }, asset: { __id__: 0 }, fileId: (pinfo && pinfo.fileId) || newFileId() });
    node._prefab = { __id__: pid };
    return id;
  }
  emitNode(rootIdx, null, true);
  return outArr;
}

function component2to3(c, base, color, ctx) {
  const t = c.__type__;
  if (t === "cc.ParticleSystem") {
    if (c._file) ctx.warn("Particle có dùng file .plist: đã giữ liên kết, nên kiểm tra lại trong Cocos.");
    return Object.assign(base("cc.ParticleSystem2D", c), {
      _customMaterial: null,
      _srcBlendFactor: BLEND_2TO3[c._srcBlendFactor] ?? 2,
      _dstBlendFactor: BLEND_2TO3[c._dstBlendFactor] ?? 4,
      _color: clone(color),
      duration: c.duration, emissionRate: c.emissionRate, life: c.life, lifeVar: c.lifeVar,
      angle: c.angle, angleVar: c.angleVar,
      startSize: c.startSize, startSizeVar: c.startSizeVar, endSize: c.endSize, endSizeVar: c.endSizeVar,
      startSpin: c.startSpin, startSpinVar: c.startSpinVar, endSpin: c.endSpin, endSpinVar: c.endSpinVar,
      sourcePos: clone(c.sourcePos), posVar: clone(c.posVar), emitterMode: c.emitterMode, gravity: clone(c.gravity),
      speed: c.speed, speedVar: c.speedVar, tangentialAccel: c.tangentialAccel, tangentialAccelVar: c.tangentialAccelVar,
      radialAccel: c.radialAccel, radialAccelVar: c.radialAccelVar, rotationIsDir: c.rotationIsDir,
      startRadius: c.startRadius, startRadiusVar: c.startRadiusVar, endRadius: c.endRadius, endRadiusVar: c.endRadiusVar,
      rotatePerS: c.rotatePerS, rotatePerSVar: c.rotatePerSVar,
      playOnLoad: c.playOnLoad, autoRemoveOnFinish: c.autoRemoveOnFinish,
      _preview: c._N$preview !== undefined ? c._N$preview : true,
      preview: c._N$preview !== undefined ? c._N$preview : true,
      _custom: c._custom,
      _file: c._file ? { __uuid__: c._file.__uuid__, __expectedType__: "cc.ParticleAsset" } : null,
      _spriteFrame: ctx.ref2to3(c._spriteFrame, "cc.SpriteFrame"),
      _totalParticles: c.totalParticles,
      _startColor: clone(c._startColor), _startColorVar: clone(c._startColorVar),
      _endColor: clone(c._endColor), _endColorVar: clone(c._endColorVar),
      _positionType: c._positionType !== undefined ? c._positionType : c.positionType || 0,
      _id: "",
    });
  }
  if (t === "cc.Animation") {
    return Object.assign(base("cc.Animation", c), {
      playOnLoad: !!c.playOnLoad,
      _clips: (c._clips || []).map((r) => ctx.ref2to3(r, "cc.AnimationClip")),
      _defaultClip: ctx.ref2to3(c._defaultClip, "cc.AnimationClip"),
      _id: "",
    });
  }
  if (t === "cc.Sprite") {
    return Object.assign(base("cc.Sprite", c), {
      _customMaterial: null,
      _srcBlendFactor: BLEND_2TO3[c._srcBlendFactor] ?? 2,
      _dstBlendFactor: BLEND_2TO3[c._dstBlendFactor] ?? 4,
      _color: clone(color),
      _spriteFrame: ctx.ref2to3(c._spriteFrame, "cc.SpriteFrame"),
      _type: c._type || 0, _fillType: c._fillType || 0, _sizeMode: c._sizeMode === undefined ? 1 : c._sizeMode,
      _fillCenter: clone(c._fillCenter) || { __type__: "cc.Vec2", x: 0, y: 0 },
      _fillStart: c._fillStart || 0, _fillRange: c._fillRange || 0, _isTrimmedMode: c._isTrimmedMode !== false,
      _useGrayscale: false, _atlas: null, _id: "",
    });
  }
  ctx.warn(`Component ${t} chưa hỗ trợ, đã giữ nguyên (có thể lỗi trong Cocos 3.6.3).`);
  const o = clone(c);
  delete o._materials;
  return Object.assign(base(t, c), o, { node: base(t, c).node, __prefab: null });
}

// ---------------------------------------------------------------------------
// PREFAB 3.6.3 -> 2.1.3
// ---------------------------------------------------------------------------
function prefab3to2(src, ctx) {
  const outArr = [];
  const head = src[0];
  outArr.push({
    __type__: "cc.Prefab", _name: "", _objFlags: 0, _native: "", data: { __id__: 1 },
    optimizationPolicy: head.optimizationPolicy || 0, asyncLoadAssets: !!head.asyncLoadAssets,
  });

  function emitNode(idx, parentId, level) {
    const n = src[idx];
    const id = outArr.length;
    const comps = (n._components || []).map((r) => src[r.__id__]);
    const uiT = comps.find((c) => c.__type__ === "cc.UITransform");
    const uiO = comps.find((c) => c.__type__ === "cc.UIOpacity");
    const colored = comps.find((c) => c._color && c.__type__ !== "cc.UITransform");
    let eul = n._euler;
    if (!eul && n._lrot) eul = vec3(0, 0, (Math.atan2(n._lrot.z, n._lrot.w) * 360) / Math.PI);
    eul = eul || vec3();
    const pos = n._lpos || vec3(), scl = n._lscale || vec3(1, 1, 1);
    const node = {
      __type__: "cc.Node", _name: n._name, _objFlags: n._objFlags || 0,
      _parent: parentId === null ? null : { __id__: parentId },
      _children: [], _active: n._active !== false, _level: level, _components: [], _prefab: null,
      _opacity: uiO ? uiO._opacity : 255,
      _color: colored ? clone(colored._color) : white(),
      _contentSize: uiT ? clone(uiT._contentSize) : { __type__: "cc.Size", width: 0, height: 0 },
      _anchorPoint: uiT ? clone(uiT._anchorPoint) : { __type__: "cc.Vec2", x: 0.5, y: 0.5 },
      _position: vec3(pos.x, pos.y, pos.z || 0),
      _scale: vec3(scl.x, scl.y, scl.z === undefined ? 1 : scl.z),
      _eulerAngles: vec3(eul.x || 0, eul.y || 0, eul.z || 0),
      _skewX: 0, _skewY: 0, _is3DNode: false, groupIndex: 0, _id: "",
    };
    outArr.push(node);
    for (const c of n._children || []) node._children.push({ __id__: emitNode(c.__id__, id, level + 1) });
    for (const c of comps) {
      if (c.__type__ === "cc.UITransform" || c.__type__ === "cc.UIOpacity") continue;
      const cid = outArr.length;
      outArr.push(component3to2(c, id, ctx));
      node._components.push({ __id__: cid });
    }
    const pinfo = n._prefab ? src[n._prefab.__id__] : null;
    if (pinfo && pinfo.instance) ctx.warn(`Node "${n._name}" là prefab lồng (nested), đã chuyển thành node thường.`);
    const pid = outArr.length;
    outArr.push({
      __type__: "cc.PrefabInfo", root: { __id__: 1 }, asset: { __uuid__: ctx.prefabUuid },
      fileId: (pinfo && pinfo.fileId) || newFileId(), sync: false,
    });
    node._prefab = { __id__: pid };
    return id;
  }
  emitNode(head.data.__id__, null, 1);
  return outArr;
}

function component3to2(c, nodeId, ctx) {
  const t = c.__type__;
  const base = (type) => ({ __type__: type, _name: c._name || "", _objFlags: c._objFlags || 0, node: { __id__: nodeId }, _enabled: c._enabled !== false });
  if (t === "cc.ParticleSystem2D") {
    return Object.assign(base("cc.ParticleSystem"), {
      _materials: [{ __uuid__: MAT_2D }],
      _srcBlendFactor: BLEND_3TO2[c._srcBlendFactor] ?? 770,
      _dstBlendFactor: BLEND_3TO2[c._dstBlendFactor] ?? 771,
      _custom: c._custom,
      _file: c._file ? { __uuid__: c._file.__uuid__ } : null,
      _spriteFrame: ctx.ref3to2(c._spriteFrame),
      _texture: null, _stopped: true,
      playOnLoad: c.playOnLoad, autoRemoveOnFinish: c.autoRemoveOnFinish,
      totalParticles: c._totalParticles,
      duration: c.duration, emissionRate: c.emissionRate, life: c.life, lifeVar: c.lifeVar,
      _startColor: clone(c._startColor), _startColorVar: clone(c._startColorVar),
      _endColor: clone(c._endColor), _endColorVar: clone(c._endColorVar),
      angle: c.angle, angleVar: c.angleVar,
      startSize: c.startSize, startSizeVar: c.startSizeVar, endSize: c.endSize, endSizeVar: c.endSizeVar,
      startSpin: c.startSpin, startSpinVar: c.startSpinVar, endSpin: c.endSpin, endSpinVar: c.endSpinVar,
      sourcePos: clone(c.sourcePos),
      _positionType: c._positionType || 0, positionType: c._positionType || 0,
      posVar: clone(c.posVar), emitterMode: c.emitterMode, gravity: clone(c.gravity),
      speed: c.speed, speedVar: c.speedVar, tangentialAccel: c.tangentialAccel, tangentialAccelVar: c.tangentialAccelVar,
      radialAccel: c.radialAccel, radialAccelVar: c.radialAccelVar, rotationIsDir: c.rotationIsDir,
      startRadius: c.startRadius, startRadiusVar: c.startRadiusVar, endRadius: c.endRadius, endRadiusVar: c.endRadiusVar,
      rotatePerS: c.rotatePerS, rotatePerSVar: c.rotatePerSVar,
      _N$preview: c._preview !== undefined ? c._preview : true,
      _id: "",
    });
  }
  if (t === "cc.Animation") {
    return Object.assign(base("cc.Animation"), {
      _defaultClip: ctx.ref3to2(c._defaultClip),
      _clips: (c._clips || []).map((r) => ctx.ref3to2(r)),
      playOnLoad: !!c.playOnLoad,
      _id: "",
    });
  }
  if (t === "cc.Sprite") {
    return Object.assign(base("cc.Sprite"), {
      _materials: [{ __uuid__: MAT_2D }],
      _srcBlendFactor: BLEND_3TO2[c._srcBlendFactor] ?? 770,
      _dstBlendFactor: BLEND_3TO2[c._dstBlendFactor] ?? 771,
      _spriteFrame: ctx.ref3to2(c._spriteFrame),
      _type: c._type || 0, _sizeMode: c._sizeMode === undefined ? 1 : c._sizeMode, _fillType: c._fillType || 0,
      _fillCenter: clone(c._fillCenter) || { __type__: "cc.Vec2", x: 0, y: 0 },
      _fillStart: c._fillStart || 0, _fillRange: c._fillRange || 0, _isTrimmedMode: c._isTrimmedMode !== false,
      _atlas: null, _id: "",
    });
  }
  ctx.warn(`Component ${t} chưa hỗ trợ, đã giữ nguyên (có thể lỗi trong Cocos 2.1.3).`);
  const o = clone(c);
  delete o.__prefab;
  return Object.assign(o, { node: { __id__: nodeId } });
}

// ---------------------------------------------------------------------------
// ANIMATION CLIP
// ---------------------------------------------------------------------------
function anim2to3(src, ctx) {
  const clip = src[0];
  const out = [null];
  const tracks = [];
  const add = (o) => { out.push(o); return out.length - 1; };

  function addCompTracks(comps, hierPath) {
    for (const [compName, props] of Object.entries(comps || {})) {
      for (const [prop, keys] of Object.entries(props)) {
        if (!Array.isArray(keys) || !keys.length) continue;
        const isObj = keys.every((k) => k.value && typeof k.value === "object" && "__uuid__" in k.value);
        if (!isObj) { ctx.warn(`Anim: track ${compName}.${prop} (số) chưa hỗ trợ, đã bỏ qua.`); continue; }
        const trackId = add(null);
        const pathId = add(null);
        const paths = [];
        if (hierPath) paths.push({ __id__: add({ __type__: "cc.animation.HierarchyPath", path: hierPath }) });
        paths.push({ __id__: add({ __type__: "cc.animation.ComponentPath", component: COMP_2TO3[compName] || compName }) });
        paths.push(prop);
        out[pathId] = { __type__: "cc.animation.TrackPath", _paths: paths };
        const curveId = add(null);
        const chId = add({ __type__: "cc.animation.Channel", _curve: { __id__: curveId } });
        out[curveId] = {
          __type__: "cc.ObjectCurve",
          _times: keys.map((k) => k.frame),
          _values: keys.map((k) => ctx.ref2to3(k.value, prop === "spriteFrame" ? "cc.SpriteFrame" : undefined)),
        };
        // cuc Channel nam sau curve trong mau that: TrackPath, ComponentPath, Channel, Curve
        out[trackId] = { __type__: "cc.animation.ObjectTrack", _binding: { __type__: "cc.animation.TrackBinding", path: { __id__: pathId } }, _channel: { __id__: chId } };
        tracks.push({ __id__: trackId });
      }
    }
  }
  const cd = clip.curveData || {};
  if (cd.props && Object.keys(cd.props).length) ctx.warn("Anim: track của node (vị trí, scale, xoay, màu...) chưa hỗ trợ, đã bỏ qua.");
  addCompTracks(cd.comps, "");
  for (const [p, sub] of Object.entries(cd.paths || {})) {
    if (sub.props && Object.keys(sub.props).length) ctx.warn(`Anim: track node con "${p}" chưa hỗ trợ, đã bỏ qua.`);
    addCompTracks(sub.comps, p);
  }
  out[0] = {
    __type__: "cc.AnimationClip", _name: clip._name, _objFlags: 0,
    __editorExtras__: { embeddedPlayerGroups: [] },
    _native: "", sample: clip.sample, speed: clip.speed, wrapMode: clip.wrapMode, enableTrsBlending: false,
    _duration: clip._duration, _hash: 0,
    _tracks: tracks, _exoticAnimation: null, _events: clone(clip.events) || [], _embeddedPlayers: [],
  };
  out[0]._hash = hashStr(dump(out.slice(1))) || 1;
  return reorderAnim3(out);
}

// Sap lai thu tu object giong mau 3.6.3: clip, track, path, component path, channel, curve
function reorderAnim3(arr) {
  const order = [0];
  const seen = new Set([0]);
  const visit = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(visit); return; }
    if (typeof o.__id__ === "number") {
      if (!seen.has(o.__id__)) { seen.add(o.__id__); order.push(o.__id__); visit(arr[o.__id__]); }
      return;
    }
    for (const v of Object.values(o)) visit(v);
  };
  visit(arr[0]);
  const remap = new Map(order.map((old, i) => [old, i]));
  const fix = (o) => {
    if (!o || typeof o !== "object") return o;
    if (Array.isArray(o)) return o.map(fix);
    if (typeof o.__id__ === "number" && Object.keys(o).length === 1) return { __id__: remap.get(o.__id__) };
    const r = {};
    for (const [k, v] of Object.entries(o)) r[k] = fix(v);
    return r;
  };
  return order.map((i) => fix(arr[i]));
}

function anim3to2(src, ctx) {
  const clip = src[0];
  const curveData = {};
  const get = (r) => (r && typeof r.__id__ === "number" ? src[r.__id__] : r);
  for (const tr of clip._tracks || []) {
    const track = get(tr);
    if (!track) continue;
    if (track.__type__ !== "cc.animation.ObjectTrack") { ctx.warn(`Anim: track ${track.__type__} chưa hỗ trợ, đã bỏ qua.`); continue; }
    const tpath = get(track._binding && track._binding.path);
    let hier = "", comp = null, prop = null;
    for (const p of (tpath && tpath._paths) || []) {
      if (typeof p === "string") prop = p;
      else {
        const o = get(p);
        if (o.__type__ === "cc.animation.HierarchyPath") hier = o.path;
        else if (o.__type__ === "cc.animation.ComponentPath") comp = o.component;
      }
    }
    if (!comp || !prop) { ctx.warn("Anim: track của node chưa hỗ trợ, đã bỏ qua."); continue; }
    const curve = get(get(track._channel)._curve);
    const keys = (curve._times || []).map((t, i) => ({ frame: t, value: ctx.ref3to2(curve._values[i]) }));
    const holder = hier ? ((curveData.paths = curveData.paths || {})[hier] = curveData.paths[hier] || {}) : curveData;
    const comps = (holder.comps = holder.comps || {});
    const name = COMP_3TO2[comp] || comp;
    (comps[name] = comps[name] || {})[prop] = keys;
  }
  return [{
    __type__: "cc.AnimationClip", _name: clip._name, _objFlags: 0, _native: "",
    _duration: clip._duration, sample: clip.sample, speed: clip.speed, wrapMode: clip.wrapMode,
    curveData, events: clone(clip._events) || [],
  }];
}

// ---------------------------------------------------------------------------
// Chuyen ca goi
// ---------------------------------------------------------------------------
const VER_SUFFIX = /([_-])(2\.1\.3|213|3\.6\.3|363)$/;
function renameSeg(seg, target) {
  return seg.replace(VER_SUFFIX, (m, sep, v) => sep + (v.includes(".") ? target : target.replace(/\./g, "")));
}

/**
 * entries: { path: Uint8Array }. target: "2.1.3" | "3.6.3".
 * Tra ve { files: { path: Uint8Array }, report: { converted: {prefab, anim, image, dir, other}, copied, warnings } }
 */
function convertPackage(entries, target) {
  const to3 = target === V3;
  const warnings = [];
  const report = { prefab: 0, anim: 0, image: 0, dir: 0, metaOther: 0, copied: 0, already: 0, warnings };
  const text = (p) => Buffer.from(entries[p]).toString("utf-8");
  const paths = Object.keys(entries);
  const dirs = new Set();
  for (const p of paths) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
    if (p.endsWith("/")) dirs.add(p.slice(0, -1));
  }

  // bang doi uuid tu cac meta anh trong goi
  const map = new Map();
  for (const p of paths) {
    if (!/\.(png|jpe?g)\.meta$/i.test(p)) continue;
    let m;
    try { m = json(text(p)); } catch (e) { continue; }
    const name = p.split("/").pop().replace(/\.(png|jpe?g)\.meta$/i, "");
    if (m.importer === undefined) {
      for (const s of Object.values(m.subMetas || {})) map.set(s.uuid, `${m.uuid}@${SF}`);
      map.set(m.uuid, `${m.uuid}@${TEX}`); // tham chieu texture
    } else {
      map.set(`${m.uuid}@${SF}`, subUuid(m.uuid, name));
      map.set(`${m.uuid}@${TEX}`, m.uuid);
    }
  }
  const missing = new Set();
  const ctx = {
    prefabUuid: null,
    warn: (msg) => { if (!warnings.includes(msg)) warnings.push(msg); },
    ref2to3(r, type) {
      if (!r || !r.__uuid__) return r ? clone(r) : null;
      let u = r.__uuid__;
      if (type === "cc.SpriteFrame" || type === "cc.Texture2D" || !type) {
        if (map.has(u)) u = map.get(u);
        else if (type === "cc.SpriteFrame") missing.add(u);
      }
      return type ? { __uuid__: u, __expectedType__: type } : { __uuid__: u };
    },
    ref3to2(r) {
      if (!r || !r.__uuid__) return r ? clone(r) : null;
      let u = r.__uuid__;
      if (map.has(u)) u = map.get(u);
      else if (u.includes("@")) { missing.add(u); u = u.split("@")[0]; }
      return { __uuid__: u };
    },
  };

  // uuid prefab lay tu meta di kem
  const metaOf = (p) => (entries[p + ".meta"] ? json(text(p + ".meta")) : null);

  const files = {};
  const outPath = (p) => {
    const parts = p.split("/");
    const last = parts.length - 1;
    for (let i = 0; i < parts.length; i++) {
      const isDirSeg = i < last || p.endsWith("/");
      const isDirMeta = i === last && parts[i].endsWith(".meta") && dirs.has(parts.slice(0, i).concat(parts[i].slice(0, -5)).join("/"));
      if (isDirSeg) parts[i] = renameSeg(parts[i], target);
      else if (isDirMeta) parts[i] = renameSeg(parts[i].slice(0, -5), target) + ".meta";
    }
    return parts.join("/");
  };
  const put = (p, data) => { files[outPath(p)] = typeof data === "string" ? new Uint8Array(Buffer.from(data, "utf-8")) : data; };

  for (const p of paths) {
    const data = entries[p];
    if (p.endsWith("/")) { put(p, data); continue; }
    const ver = /\.(meta|prefab|anim)$/.test(p) ? fileVersion(p, text(p)) : null;
    if (ver === target) { put(p, data); report.already++; continue; }
    try {
      if (p.endsWith(".prefab")) {
        const m = metaOf(p);
        ctx.prefabUuid = m ? m.uuid : null;
        const src = json(text(p));
        put(p, dump(to3 ? prefab2to3(src, ctx) : prefab3to2(src, ctx)));
        report.prefab++;
      } else if (p.endsWith(".anim")) {
        const src = json(text(p));
        put(p, dump(to3 ? anim2to3(src, ctx) : anim3to2(src, ctx)));
        report.anim++;
      } else if (p.endsWith(".meta")) {
        const m = json(text(p));
        const assetPath = p.slice(0, -5);
        const fname = assetPath.split("/").pop();
        let o;
        if (dirs.has(assetPath) || m.importer === "directory") { o = to3 ? dirMeta2to3(m) : dirMeta3to2(m); report.dir++; }
        else if (/\.(png|jpe?g)$/i.test(fname)) {
          const name = fname.replace(/\.(png|jpe?g)$/i, "");
          const ext = "." + fname.split(".").pop().toLowerCase();
          o = to3 ? imageMeta2to3(m, name, ext) : imageMeta3to2(m, name);
          report.image++;
        } else if (fname.endsWith(".anim")) o = to3 ? animMeta2to3(m, fname.slice(0, -5)) : animMeta3to2(m);
        else if (fname.endsWith(".prefab")) {
          let rootName = fname.slice(0, -7);
          try { const pf = json(text(assetPath)); rootName = pf[pf[0].data.__id__]._name || rootName; } catch (e) { /* dung ten file */ }
          o = to3 ? prefabMeta2to3(m, rootName) : prefabMeta3to2(m);
        } else {
          ctx.warn(`File ${fname}: loại này chưa hỗ trợ, đã giữ nguyên meta.`);
          put(p, data); report.metaOther++; continue;
        }
        put(p, dump(o));
      } else {
        put(p, data); report.copied++;
      }
    } catch (e) {
      ctx.warn(`Lỗi khi chuyển ${p.split("/").pop()}: ${e.message}`);
      put(p, data);
    }
  }
  if (missing.size) ctx.warn(`${missing.size} hình được tham chiếu nhưng không có trong file zip (ảnh dùng chung của project?). Cần gắn lại trong Cocos.`);
  return { files, report };
}

module.exports = { V2, V3, detect, convertPackage, quatFromEuler, subUuid };
