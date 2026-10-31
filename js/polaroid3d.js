// Realistic 3D instant camera for the normal-mode footer (three.js, PBR materials).
// Modelled in centimetres on the white Polaroid Now+: rounded ABS housing with a sloped
// upper front, a separate film compartment (real seam), a multi-ring lens with convex
// glass, smoky flash, tinted viewfinder, glossy red shutter, sensor and "+" icon.
// It plugs into js/polaroid.js through window.PolaroidCam.view (flash / eject / clear);
// if WebGL or the CDN isn't available, the CSS camera stays.
(async () => {
  'use strict';
  const api = window.PolaroidCam;
  const stage = document.getElementById('pol-stage');
  if (!api || !stage) return;
  let THREE, RoundedBoxGeometry, RoomEnvironment;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
    THREE = await import('three');
    ({ RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js'));
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (e) { return; }                                   // keep the CSS camera
  await document.fonts.load('800 40px Nunito').catch(() => {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── renderer / scene ────────────────────────────────────────────────────
  const wrap = Object.assign(document.createElement('div'), { className: 'pol-3d' });
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  wrap.appendChild(renderer.domElement);
  const live = Object.assign(document.createElement('p'), { className: 'sr-only' });
  live.setAttribute('aria-live', 'polite');
  wrap.appendChild(live);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const view = new THREE.PerspectiveCamera(20, 1, 1, 400);

  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(5, 28, 26);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 8;
  key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 0.2));

  // ── materials ───────────────────────────────────────────────────────────
  // extremely fine molded grain (tiny bump noise)
  const grain = (() => {
    const n = 128, d = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) { const v = 118 + Math.random() * 20; d.set([v, v, v, 255], i * 4); }
    const t = new THREE.DataTexture(d, n, n); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.needsUpdate = true;
    return t;
  })();
  const M = {
    abs: new THREE.MeshPhysicalMaterial({ color: 0xf2f2ef, roughness: 0.32, envMapIntensity: 0.55, specularIntensity: 0.55, clearcoat: 0.08, clearcoatRoughness: 0.5, bumpMap: grain, bumpScale: 0.0035 }),
    absShade: new THREE.MeshPhysicalMaterial({ color: 0xe9e9e5, roughness: 0.38, envMapIntensity: 0.55, specularIntensity: 0.5 }),
    matteBlack: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.62 }),
    semiBlack: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
    trim: new THREE.MeshPhysicalMaterial({ color: 0x080808, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 }),
    lensGlass: new THREE.MeshPhysicalMaterial({ color: 0x0a1028, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02,
      iridescence: 0.75, iridescenceIOR: 1.35, iridescenceThicknessRange: [250, 520], envMapIntensity: 1.6 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xe0392a, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 }),
    smoke: new THREE.MeshPhysicalMaterial({ color: 0xf6f6f4, roughness: 0.08, transmission: 0.92, thickness: 0.15, ior: 1.49 }),
    tint: new THREE.MeshPhysicalMaterial({ color: 0x2c2f33, roughness: 0.04, transmission: 0.55, thickness: 0.15, ior: 1.5, clearcoat: 1, transparent: true }),
    slot: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }),
  };
  const canvasTex = (w, h, draw) => {
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const decal = (tex, w, h, extra = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, ...extra }));
  const rrShape = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  // lathe a (radius, height) profile so it faces +Z
  const lathe = (pts, mat) => {
    const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), 128);
    g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
  };
  const mesh = (g, mat) => { const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m; };

  // ── 1. body ─────────────────────────────────────────────────────────────
  const rig = new THREE.Group(); scene.add(rig);
  const W = 15.0, D = 9.4;
  // film compartment (bottom) and logo band, two parts → a real horizontal seam
  const door = mesh(new RoundedBoxGeometry(14.75, 4.2, D, 6, 0.85), M.abs); door.position.set(0, 2.1, 0);
  const band = mesh(new RoundedBoxGeometry(W, 3.5, D, 6, 0.55), M.abs); band.position.set(0, 4.25 + 1.75, 0);
  rig.add(door, band);
  // upper housing: side profile with a slightly sloped front, extruded across the width
  const zf = y => 4.5 - 0.094 * (y - 7.7);                     // front surface z at height y
  const bev = 0.55;
  const prof = new THREE.Shape();
  const P = (z, y) => [-z, y];                                  // shape x = -z (see rotateY below)
  prof.moveTo(...P(-4.65 + bev, 7.4));
  prof.lineTo(...P(zf(7.4) - bev, 7.4));
  prof.lineTo(...P(zf(13.8) - bev, 13.8 - bev));
  prof.quadraticCurveTo(...P(zf(14.8) - bev, 14.8 - bev), ...P(zf(14.8) - 1.3, 14.8 - bev));
  prof.lineTo(...P(-3.6, 14.8 - bev));
  prof.quadraticCurveTo(...P(-4.65 + bev, 14.8 - bev), ...P(-4.65 + bev, 13.8 - bev));
  prof.closePath();
  const upperW = 14.75;
  const ug = new THREE.ExtrudeGeometry(prof, { depth: upperW - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 8, curveSegments: 24 });
  ug.rotateY(Math.PI / 2); ug.translate(-(upperW - 2 * bev) / 2, 0, 0);
  rig.add(mesh(ug, M.abs));
  // raised hump on the back of the top
  const hump = mesh(new RoundedBoxGeometry(9.74, 1.3, 5.0, 5, 0.45), M.absShade); hump.position.set(2.6, 14.6, -1.9); rig.add(hump);

  // front face frame (sloped): local x/y on the face, +z out of it
  const tilt = Math.atan(0.094);
  const face = new THREE.Group();
  const FY = 11.3; face.position.set(0, FY, zf(FY)); face.rotation.x = -tilt; rig.add(face);

  // ── 3. lens assembly ────────────────────────────────────────────────────
  const lens = new THREE.Group(); lens.position.set(0.39, -0.25, 0); face.add(lens);
  lens.add(lathe([[2.66, 0], [3.04, 0], [3.1, 0.22], [3.04, 0.46], [2.9, 0.58], [2.7, 0.6]], M.abs));          // white collar
  const grooves = [[2.72, 0.58]];
  for (let r = 2.70, k = 0; r > 1.97; r -= 0.045, k++) grooves.push([r, k % 2 ? 0.6 : 0.635]);                 // fine concentric grooves
  grooves.push([1.96, 0.635], [1.95, 0.42]);
  lens.add(lathe(grooves, M.matteBlack));
  lens.add(lathe([[1.95, 0.42], [1.8, 0.41], [1.78, 0.32], [1.62, 0.31], [1.6, 0.23], [1.43, 0.22], [1.41, 0.1]], M.semiBlack)); // stepped inner ring
  const markings = canvasTex(1024, 1024, (x, w) => {
    const c = w / 2, R = 2.68, px = v => v / R * (w / 2);
    x.fillStyle = '#d2d2d2'; x.font = '800 34px Nunito, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center';
    const arc = (text, center, rad, outward) => {
      const step = 0.065, total = step * (text.length - 1);
      [...text].forEach((ch, i) => {
        const a = outward ? center - total / 2 + i * step : center + total / 2 - i * step;
        x.save(); x.translate(c + Math.cos(a) * px(rad), c + Math.sin(a) * px(rad));
        x.rotate(outward ? a + Math.PI / 2 : a - Math.PI / 2); x.fillText(ch, 0, 0); x.restore();
      });
    };
    arc('POLAROID', -Math.PI / 2, 2.34, true); arc('AUTOFOCUS', 0, 2.34, true);
    arc('35-40mm 1:11', Math.PI, 2.34, true); arc('FILTER SENSOR', Math.PI / 2, 2.2, false);
  });
  const ring = decal(markings, 5.36, 5.36, { roughness: 0.5 }); ring.geometry = new THREE.RingGeometry(1.98, 2.68, 128); ring.position.z = 0.638; lens.add(ring);
  const Rg = 3.82, cap = 1.42;                                                                                   // convex glass
  const gg = new THREE.SphereGeometry(Rg, 96, 32, 0, Math.PI * 2, 0, Math.asin(cap / Rg));
  gg.rotateX(Math.PI / 2); gg.translate(0, 0, 0.12 - (Rg - (Rg - Math.sqrt(Rg * Rg - cap * cap))));
  lens.add(mesh(gg, M.lensGlass));
  const inner = mesh(new THREE.CircleGeometry(1.42, 64), new THREE.MeshStandardMaterial({ color: 0x050812, roughness: 0.3 })); inner.position.z = 0.1; lens.add(inner);
  const dot = lathe([[0.2, 0], [0.2, 0.06], [0.16, 0.12], [0, 0.12]], M.trim); dot.position.set(0, -2.48, 0.6); lens.add(dot);  // sensor dot on the ring

  // ── 4. flash and viewfinder ─────────────────────────────────────────────
  const frame = (w, h, r, inset, depth) => {
    const s = rrShape(w, h, r); s.holes.push(rrShape(w - inset * 2, h - inset * 2, Math.max(0.05, r - inset)));
    return mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 16 }), M.trim);
  };
  const flash = new THREE.Group(); flash.position.set(-4.87, 1.13, 0); face.add(flash);
  flash.add(frame(3.42, 3.2, 0.75, 0.2, 0.2));
  const fresnel = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#dededb'; x.fillRect(0, 0, w, h);
    for (let r = 12; r < 600; r += 30) {                       // fresnel ridges: dark groove, bright crest
      x.beginPath(); x.arc(w / 2, h * 0.2, r, 0, Math.PI * 2); x.strokeStyle = '#8c8c8a'; x.lineWidth = 7; x.stroke();
      x.beginPath(); x.arc(w / 2, h * 0.2, r + 11, 0, Math.PI * 2); x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.stroke();
    }
    const v = x.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);   // darker toward the frame
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.28)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, h * 0.5, 0, h * 0.74);                 // reflector tube band
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.35, 'rgba(255,255,255,.9)'); g.addColorStop(.6, 'rgba(190,190,190,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, h * 0.5, w, h * 0.24);
    const v2 = x.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
    v2.addColorStop(0, 'rgba(0,0,0,0)'); v2.addColorStop(1, 'rgba(0,0,0,.28)'); x.fillStyle = v2; x.fillRect(0, 0, w, h);
  });
  const diffMat = new THREE.MeshStandardMaterial({ map: fresnel, bumpMap: fresnel, bumpScale: 0.02, roughness: 0.35, envMapIntensity: 0.4, emissive: 0xffffff, emissiveIntensity: 0 });
  const diff = mesh(new THREE.ShapeGeometry(rrShape(3.0, 2.78, 0.55)), diffMat); diffMat.bumpScale = 0.05;
  const fUv = diff.geometry.attributes.uv; for (let i = 0; i < fUv.count; i++) fUv.setXY(i, (fUv.getX(i) + 1.5) / 3.0, (fUv.getY(i) + 1.39) / 2.78);
  diff.position.z = 0.04; flash.add(diff);
  const tube = mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 24), M.smoke); tube.rotation.z = Math.PI / 2; tube.position.set(0, -0.42, 0.14); flash.add(tube);
  const cover = mesh(new RoundedBoxGeometry(3.04, 2.82, 0.12, 4, 0.05), M.smoke); cover.position.z = 0.22; flash.add(cover);

  const vf = new THREE.Group(); vf.position.set(5.2, 1.33, 0); face.add(vf);
  vf.add(frame(2.94, 2.8, 0.62, 0.22, 0.22));
  const vfBack = mesh(new THREE.ShapeGeometry(rrShape(2.52, 2.38, 0.42)), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.5 })); vfBack.position.z = 0.02; vf.add(vfBack);
  const ocular = new THREE.SphereGeometry(1.2, 48, 16, 0, Math.PI * 2, 0, 0.5); ocular.rotateX(Math.PI / 2); ocular.translate(0, -0.15, -0.9);
  vf.add(mesh(ocular, M.lensGlass));
  const mark = mesh(new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 })); mark.position.set(-0.05, 0.82, 0.05); vf.add(mark);
  const vfGlass = mesh(new RoundedBoxGeometry(2.56, 2.42, 0.1, 4, 0.04), M.tint); vfGlass.position.z = 0.21; vf.add(vfGlass);

  // ── 5. buttons and small parts ──────────────────────────────────────────
  const shutter = new THREE.Group(); shutter.position.set(-4.87, -2.0, 0); face.add(shutter);
  shutter.add(lathe([[0.9, 0], [0.97, 0], [0.97, 0.05], [0.9, 0.05]], M.matteBlack));                         // recessed gap ring
  const dome = lathe([[0.88, 0], [0.88, 0.12], [0.8, 0.24], [0.62, 0.34], [0.35, 0.4], [0, 0.42]], M.red); shutter.add(dome);

  const sensor = mesh(new RoundedBoxGeometry(1.71, 0.61, 0.16, 4, 0.28), M.semiBlack); sensor.position.set(5.15, -1.26, 0.02); face.add(sensor);
  [[-0.42, 0.09], [-0.12, 0.09], [0.32, 0.13]].forEach(([x, r]) => {
    const d = lathe([[r, 0], [r, 0.02], [0, 0.02]], x > 0 ? M.lensGlass : M.matteBlack); d.position.set(5.15 + x, -1.26, 0.1); face.add(d);
  });
  const plusTex = canvasTex(128, 128, (x, w) => {
    x.fillStyle = '#fafaf8'; x.fillRect(0, 0, w, w);
    x.strokeStyle = '#bdbdbd'; x.lineWidth = 7; x.strokeRect(5, 5, w - 10, w - 10);
    x.strokeStyle = '#3a8de0'; x.lineWidth = 11; x.lineCap = 'round';
    x.beginPath(); x.moveTo(w / 2, 34); x.lineTo(w / 2, w - 34); x.moveTo(34, w / 2); x.lineTo(w - 34, w / 2); x.stroke();
  });
  const plus = new THREE.Group(); plus.position.set(5.15, -2.46, 0); face.add(plus);
  plus.add(mesh(new RoundedBoxGeometry(0.83, 0.83, 0.1, 3, 0.1), M.abs));
  const plusFace = decal(plusTex, 0.74, 0.74); plusFace.position.z = 0.052; plus.add(plusFace);

  // rainbow stripe: under the lens, down the logo band
  const stripeCols = [0xe8432e, 0xf39a1f, 0xf6c912, 0x7cc243, 0x3f95e5];
  stripeCols.forEach((c, i) => {
    const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.2, polygonOffset: true, polygonOffsetFactor: -2 });
    const x = 0.37 - 0.775 + 0.155 + i * 0.31;
    const a = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 3.45), m); a.position.set(x, 6.0, D / 2 + 0.002); rig.add(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.6), m); b.position.set(x, 7.95 - FY, 0.002); face.add(b);
  });
  // wordmarks + embossed film label
  const word = (text, size, color, w, h) => canvasTex(512, 128, (x, cw, ch) => {
    x.fillStyle = color; x.font = `800 ${size}px Nunito, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cw / 2, ch / 2 + 4);
  });
  const brand = decal(word('polaroid', 92, '#8d8d8d'), 3.9, 0.98); brand.position.set(-4.39, 5.72, D / 2 + 0.003); rig.add(brand);
  const model = decal(word('NOW+', 84, '#8d8d8d'), 3.4, 0.86); model.position.set(5.18, 5.72, D / 2 + 0.003); rig.add(model);
  const film = decal(word('i-Type film', 70, 'rgba(205,205,200,.55)'), 2.6, 0.65); film.position.set(-4.75, 3.82, D / 2 + 0.003); rig.add(film);

  // film exit slot: soft recessed rim + dark opening
  const rimTex = canvasTex(1024, 96, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfcfcb'); g.addColorStop(0.35, '#ebebe7'); g.addColorStop(1, '#f2f2ef');
    x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, w, h, 18); x.fill();
  });
  const rim = decal(rimTex, 13.25, 1.14, { roughness: 0.4 }); rim.position.set(0.35, 2.89, D / 2 + 0.002); rig.add(rim);
  const slotTex = canvasTex(1024, 48, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#000'); g.addColorStop(0.7, '#141414'); g.addColorStop(1, '#3a3a3a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const slotY = 2.96;
  const slot = decal(slotTex, 12.46, 0.48, { roughness: 0.9 }); slot.position.set(0.35, slotY, D / 2 + 0.004); rig.add(slot);

  // soft contact shadow on an invisible floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.08, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; rig.add(floor);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
    map: canvasTex(256, 256, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }) }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; rig.add(blob);

  // flash light (only lit while firing)
  const flashLight = new THREE.PointLight(0xffffff, 0, 60, 1.6);
  flashLight.position.set(-4.87, 12.4, 6); rig.add(flashLight);

  // ── framing: one fixed stage (camera on top, room below for the card) ────
  // Sized once and on resize only, never during the animation, so nothing jumps.
  const STAGE_RATIO = 1.62, TOP_Y = 16.4;
  function layout() {
    const cssW = Math.min(560, stage.clientWidth || 560);
    const ppc = (cssW * 0.6) / W;                             // pixels per cm
    const cssH = Math.round(cssW * STAGE_RATIO);
    wrap.style.width = cssW + 'px'; wrap.style.height = cssH + 'px';
    renderer.setSize(cssW, cssH, false);
    const dist = 95, visH = cssH / ppc, cy = TOP_Y - visH / 2;
    view.fov = THREE.MathUtils.radToDeg(2 * Math.atan(visH / 2 / dist));
    view.aspect = cssW / cssH;
    view.position.set(0, cy + 14, dist);                     // straight on, slightly above
    view.lookAt(0, cy + 1.5, 0);
    view.updateProjectionMatrix();
  }

  // ── tap targets on the model (shutter, "+") ─────────────────────────────
  let t = 0, last = performance.now(), visible = true;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hitTargets = [dome, plusFace];
  const cardHit = e => {
    if (!card) return false;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, view);
    const h = ray.intersectObject(card, false)[0];
    return !!h && h.point.y < new THREE.Vector3(0, slotY, 0).applyMatrix4(rig.matrixWorld).y;   // the part below the slot
  };
  function hit(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, view);
    const h = ray.intersectObjects(hitTargets, false)[0];
    return h ? h.object : null;
  }
  wrap.addEventListener('click', e => {
    if (dragged) { dragged = false; return; }
    const o = hit(e);
    if (o === dome) api.shoot(); else if (o === plusFace) api.pick();
  });

  // ── peel: a page curl. Grab the paper anywhere (corner, edge, even the top) and drag:
  // the part beyond the fold line rolls over a small cylinder and lies back on itself,
  // showing the white back of the paper. Pull far enough and it tears free. ──────────
  const TEAR = 6.2;                                             // cm the grabbed point travels before it tears
  const R = 0.42;                                               // radius of the rolled edge (cm)
  const pullPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const tmp = new THREE.Vector3();
  let peelDrag = null, dragged = false, lastPull = { x: 0, y: 0 };
  let curlNow = null;                                           // { gx, gy, px, py } currently applied
  function pointOnCard(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, view);
    pullPlane.constant = -card.position.z;
    return ray.ray.intersectPlane(pullPlane, tmp) ? { x: tmp.x - card.position.x, y: tmp.y - card.position.y } : null;
  }
  // curl the sheet: grabbed point (gx, gy) has been dragged to (px, py), in card coordinates
  function curl(gx, gy, px, py) {
    const g = card.geometry, pos = g.attributes.position, col = g.attributes.color, base = card.userData.base;
    let nx = gx - px, ny = gy - py;
    const d = Math.hypot(nx, ny);
    curlNow = { gx, gy, px, py };
    if (d < 1e-4) {                                             // flat
      pos.array.set(base); col.array.fill(1);
      pos.needsUpdate = col.needsUpdate = true; return;
    }
    nx /= d; ny /= d;                                           // points from the fold toward the grabbed side
    // fold line sits so the grabbed point lands under the pointer after rolling over the cylinder
    const travel = d / 2 + R * (Math.PI / 2 - 1);
    const mx = gx - nx * travel, my = gy - ny * travel;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const dist = (bx - mx) * nx + (by - my) * ny;              // signed distance past the fold line
      let x = bx, y = by, z = bz, shade = 1;
      if (dist > 0) {
        const fx = bx - nx * dist, fy = by - ny * dist;           // foot point on the fold line
        if (dist < Math.PI * R) {                               // on the roll
          const a = dist / R;
          x = fx + nx * R * Math.sin(a); y = fy + ny * R * Math.sin(a); z = bz + R * (1 - Math.cos(a));
          shade = 0.78 + 0.22 * Math.abs(Math.cos(a));
        } else {                                                // folded back flat on top
          const back = dist - Math.PI * R;
          x = fx - nx * back; y = fy - ny * back; z = bz + 2 * R;
          shade = 0.97 - Math.min(0.1, back * 0.02);
        }
      } else if (dist > -1.1) {                                 // soft shadow cast by the roll
        shade = 1 - 0.22 * (1 + dist / 1.1) * Math.min(1, d / 2);
      }
      pos.setXYZ(i, x, y, z); col.setXYZ(i, shade, shade, shade);
    }
    pos.needsUpdate = col.needsUpdate = true;
    g.computeBoundingSphere(); g.computeBoundingBox();
  }
  // resting state: the bottom-right corner gently lifted, inviting a peel
  const restCorner = () => {
    const p = card.userData.paper;
    return { gx: p.right, gy: p.bottom, px: p.right - 1.5, py: p.bottom + 1.15 };
  };
  function animateCurl(to, ms) {
    const from = curlNow || { ...to, px: to.gx, py: to.gy };
    return tween(ms, k => {
      if (!card) return;
      const e = 1 - Math.pow(1 - k, 3), m = (a, b) => a + (b - a) * e;
      curl(m(from.gx, to.gx), m(from.gy, to.gy), m(from.px, to.px), m(from.py, to.py));
    });
  }
  wrap.addEventListener('pointermove', e => {
    if (peelDrag) {
      const p = pointOnCard(e);
      if (!p) return;
      const { gx, gy } = peelDrag;
      const L = Math.hypot(p.x - gx, p.y - gy);
      lastPull = { x: p.x - gx, y: p.y - gy };
      if (L > 0.2) dragged = true;
      curl(gx, gy, p.x, p.y);
      if (L >= TEAR) { peelDrag = null; wrap.classList.remove('grabbing'); api.peel(); }
      return;
    }
    const overCard = card && card.userData.ready && cardHit(e);
    wrap.classList.toggle('hot', !!hit(e));
    wrap.classList.toggle('grab', !!overCard);
  });
  wrap.addEventListener('pointerdown', e => {
    if (!card || !card.userData.ready || !cardHit(e)) return;
    const p = pointOnCard(e);
    if (!p) return;
    peelDrag = { gx: p.x, gy: p.y };
    dragged = false;
    try { wrap.setPointerCapture(e.pointerId); } catch (_) { /* synthetic event */ }
    wrap.classList.add('grabbing');
    curl(p.x, p.y, p.x, p.y);
    e.preventDefault();
  });
  const release = () => {
    if (!peelDrag || !card) { peelDrag = null; return; }
    peelDrag = null; wrap.classList.remove('grabbing');
    lastPull = { x: 0, y: 0 };
    animateCurl(restCorner(), 480);                             // not pulled far enough: it settles back
  };
  wrap.addEventListener('pointerup', release);
  wrap.addEventListener('pointercancel', release);

  // ── card ────────────────────────────────────────────────────────────────
  let card = null, shutterPress = 0, flashT = 0, rumble = 0;
  const clip = new THREE.Plane(), localClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), slotY);
  const ease = k => 1 - Math.pow(1 - k, 3);
  const tween = (ms, fn) => new Promise(res => {
    if (reduce) { fn(1); res(); return; }
    const s = performance.now();
    const step = now => { const k = Math.min(1, (now - s) / ms); fn(k); k < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });
  const CARD_W = 13.0;
  const viewApi = {
    flash() { flashT = 1; shutterPress = 1; },
    async eject(c) {
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const h = CARD_W * c.height / c.width;
      const g = new THREE.PlaneGeometry(CARD_W, h, 64, 128);   // dense, so the curl rolls smoothly
      const pos = g.attributes.position;                        // paper hangs with a gentle forward curl
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = (h / 2 - y) / h; pos.setZ(i, 0.45 * k * k); }
      g.computeVertexNormals();
      // unlit + no tone mapping: the card shows exactly the colours that get saved
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, side: THREE.DoubleSide, clippingPlanes: [clip], toneMapped: false });
      // the back of the paper is plain white (keeps the card's alpha so only the paper shows)
      mat.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.985);');
      };
      card = new THREE.Mesh(g, mat);
      card.renderOrder = 2;
      card.userData.aspect = c.height / c.width;
      card.userData.h = h;
      card.userData.base = Float32Array.from(g.attributes.position.array);   // rest shape, for the peel
      // where the paper itself sits inside the card image (the image has a 40px margin for stickers)
      const mx = CARD_W * 40 / c.width;
      card.userData.paper = { right: CARD_W / 2 - mx, bottom: -h / 2 + h * 40 / c.height };
      card.position.set(0.35, slotY + h / 2 + 0.05, D / 2 + 0.14);
      rig.add(card);
      const from = card.position.y, to = slotY - h / 2 + 0.5, travel = from - to;
      live.textContent = c.getAttribute('aria-label') || 'Your polaroid card is ready.';
      // the motor pushes the film out in short bursts: move, pause, move…
      const STEPS = 7, DUR = 3000;
      await tween(DUR, k => {
        const s = k * STEPS, i = Math.floor(s), f = s - i;
        const pushed = Math.min(1, (i + Math.min(1, f / 0.62)) / STEPS);     // 62% of each beat moving, rest paused
        const e = 1 - Math.pow(1 - pushed, 1.6);
        card.position.y = from - travel * e;
        card.rotation.x = 0.05 * Math.sin(k * Math.PI) * (1 - k * 0.6);      // paper tips out as it feeds
        card.rotation.z = 0.012 * Math.sin(k * 9);                            // tiny side wobble
        rumble = k < 1 ? 1 : 0;
      });
      card.rotation.set(0, 0, 0.004);
      rumble = 0;
      card.userData.ready = true;
      curlNow = null;
      animateCurl(restCorner(), 600);                              // lift the corner: "peel me"
      wrap.classList.add('peelable');
    },
    // the visible card (below the slot) as a screen rectangle, for the hand-off to the centre view
    cardRect() {
      const r = renderer.domElement.getBoundingClientRect();
      if (!card) return r;
      card.updateMatrixWorld();
      const b = new THREE.Box3().setFromObject(card);
      const slotWorldY = new THREE.Vector3(0, slotY, 0).applyMatrix4(rig.matrixWorld).y;
      const toScreen = (x, y) => { const v = new THREE.Vector3(x, y, b.max.z).project(view); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
      const [l, t] = toScreen(b.min.x, Math.min(b.max.y, slotWorldY));
      const [rt, bt] = toScreen(b.max.x, b.min.y);
      return { left: l, top: t, width: rt - l, height: bt - t };
    },
    // tear the paper off: a quick upward tug, then it's handed to the HTML view
    peel() {
      if (!card) return;
      const m = card; card = null;
      wrap.classList.remove('peelable', 'grab', 'grabbing');
      rig.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose();
      renderOnce();                                              // camera without the card, then the popup covers it
    },
    // pause rendering while the popup is open: the GPU is free for the transition
    pause() { paused = true; },
    resume() { paused = false; startLoop(); },
    reset() { /* nothing to restore: the camera is ready for the next shot */ },
    async clear() {
      if (!card) return;
      const m = card, y0 = m.position.y;
      wrap.classList.remove('peelable', 'grab', 'grabbing');
      await tween(450, k => { m.position.y = y0 - 3 * k; m.material.opacity = 1 - k; });
      rig.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose();
      card = null;
    },
  };

  // ── loop ────────────────────────────────────────────────────────────────
  let paused = false, looping = false;
  function frameLoop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    rig.rotation.set(0, 0, 0);                                    // fixed, facing front
    rig.position.x = rumble && !reduce ? Math.sin(t * 90) * 0.012 : 0;   // motor buzz while the film feeds
    shutterPress = Math.max(0, shutterPress - dt * 4);
    dome.position.z = -0.12 * Math.sin(Math.min(1, shutterPress) * Math.PI);
    flashT = Math.max(0, flashT - dt * 3.2);
    flashLight.intensity = 260 * flashT * flashT;
    diffMat.emissiveIntensity = 2.2 * flashT;
    rig.updateMatrixWorld();
    clip.copy(localClip).applyMatrix4(rig.matrixWorld);
    renderer.render(scene, view);
    if (visible && !paused) requestAnimationFrame(frameLoop); else looping = false;
  }
  function renderOnce() { rig.updateMatrixWorld(); clip.copy(localClip).applyMatrix4(rig.matrixWorld); renderer.render(scene, view); }
  function startLoop() {
    if (looping || !visible || paused) return;
    looping = true; last = performance.now(); requestAnimationFrame(frameLoop);
  }

  // swap the CSS camera for the 3D one
  stage.classList.add('is-3d');
  stage.appendChild(wrap);
  layout();
  addEventListener('resize', layout);
  api.view = viewApi;
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; startLoop(); })).observe(wrap);
  startLoop();
})();
