/* 3D model creation - local geometry engine with STL export for 3D printing.
   Modes: 3D text sign (any language incl. Hebrew), AI/image relief (lithophane),
   parametric vase, basic shapes. Units: 1 = 1mm. */
const ThreeD = (() => {
  let scene, camera, renderer, controls, mesh, inited = false;
  let currentGeom = null;      // Z-up geometry ready for STL export
  let uploadedImage = null;

  function initViewport() {
    if (inited) return;
    inited = true;
    const box = $('#d3-viewport');
    const w = box.clientWidth, h = box.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0e1c);

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 3000);
    camera.position.set(120, 90, 150);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(w, h);
    box.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x202040, 1.0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(80, 150, 90);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x8899ff, 0.35);
    dir2.position.set(-90, 40, -70);
    scene.add(dir2);

    const grid = new THREE.GridHelper(240, 24, 0x2a2d55, 0x1c1e3a);
    scene.add(grid);

    window.addEventListener('resize', onResize);
    animate();
  }

  function onResize() {
    if (!renderer) return;
    const box = $('#d3-viewport');
    if (!box.clientWidth) return;
    camera.aspect = box.clientWidth / box.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(box.clientWidth, box.clientHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer) renderer.render(scene, camera);
  }

  function showGeometry(geomZUp) {
    currentGeom = geomZUp;
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
    const displayGeom = geomZUp.clone();
    displayGeom.rotateX(-Math.PI / 2);          // Z-up -> Y-up for display
    displayGeom.computeBoundingBox();
    const bb = displayGeom.boundingBox;
    displayGeom.translate(
      -(bb.min.x + bb.max.x) / 2,
      -bb.min.y,
      -(bb.min.z + bb.max.z) / 2
    );
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9f8cff, metalness: 0.15, roughness: 0.45,
      side: THREE.DoubleSide
    });
    mesh = new THREE.Mesh(displayGeom, mat);
    scene.add(mesh);

    const size = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z, bb.max.y - bb.min.y);
    camera.position.set(size * 1.2, size * 0.9, size * 1.5);
    controls.target.set(0, (bb.max.y - bb.min.y) / 2, 0);
    $('#btn-d3-export').disabled = false;
  }

  /* ---- generic heightfield -> watertight solid (Z-up) ----
     heights: Float32Array (rows+1)*(cols+1), extra height above base */
  function reliefGeometry(heights, cols, rows, cellW, cellH, base) {
    const vpr = cols + 1;
    const nTop = (rows + 1) * vpr;
    const pos = new Float32Array(nTop * 2 * 3);
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const i = r * vpr + c;
        const x = c * cellW, y = r * cellH;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = base + heights[i];
        const j = nTop + i;
        pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = 0;
      }
    }
    const idx = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * vpr + c, b = a + 1, d = a + vpr, e = d + 1;
        idx.push(a, b, e, a, e, d);                                    // top (+Z)
        const A = nTop + a, B = nTop + b, D = nTop + d, E = nTop + e;
        idx.push(A, E, B, A, D, E);                                    // bottom (-Z)
      }
    }
    for (let c = 0; c < cols; c++) {                                   // front / back walls
      let a = c, b = c + 1;
      idx.push(a, nTop + a, nTop + b, a, nTop + b, b);
      a = rows * vpr + c; b = a + 1;
      idx.push(a, b, nTop + b, a, nTop + b, nTop + a);
    }
    for (let r = 0; r < rows; r++) {                                   // left / right walls
      let a = r * vpr, b = (r + 1) * vpr;
      idx.push(a, b, nTop + b, a, nTop + b, nTop + a);
      a = r * vpr + cols; b = (r + 1) * vpr + cols;
      idx.push(a, nTop + a, nTop + b, a, nTop + b, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ---- mode: 3D text (canvas mask -> relief, works for Hebrew) ---- */
  function buildText() {
    const text = $('#d3-text').value.trim();
    if (!text) { toast(t('d3_need_text')); return null; }
    const letterMm = Math.max(8, parseFloat($('#d3-text-size').value) || 30);
    const depth = Math.max(1, parseFloat($('#d3-text-depth').value) || 6);
    const base = Math.max(0, parseFloat($('#d3-text-base').value) || 3);

    const px = 160;
    const cv = document.createElement('canvas');
    const cx = cv.getContext('2d');
    cx.font = '900 ' + px + 'px "Segoe UI", "Arial Black", Arial, sans-serif';
    const metrics = cx.measureText(text);
    const pad = px * 0.18;
    cv.width = Math.ceil(metrics.width + pad * 2);
    cv.height = Math.ceil(px * 1.35 + pad * 2);
    const cx2 = cv.getContext('2d');
    cx2.fillStyle = '#000';
    cx2.fillRect(0, 0, cv.width, cv.height);
    cx2.font = '900 ' + px + 'px "Segoe UI", "Arial Black", Arial, sans-serif';
    cx2.fillStyle = '#fff';
    cx2.textBaseline = 'middle';
    cx2.textAlign = 'center';
    cx2.fillText(text, cv.width / 2, cv.height / 2);

    const mmPerPx = letterMm / px;
    const wMm = cv.width * mmPerPx, hMm = cv.height * mmPerPx;
    const cols = Math.min(300, Math.max(60, Math.round(cv.width / 3)));
    const rows = Math.max(30, Math.round(cols * cv.height / cv.width));
    const data = cx2.getImageData(0, 0, cv.width, cv.height).data;

    const heights = new Float32Array((rows + 1) * (cols + 1));
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const sx = Math.min(cv.width - 1, Math.round(c / cols * (cv.width - 1)));
        const sy = Math.min(cv.height - 1, Math.round((1 - r / rows) * (cv.height - 1)));
        const v = data[(sy * cv.width + sx) * 4];   // red channel
        heights[r * (cols + 1) + c] = v > 110 ? depth : 0;
      }
    }
    return reliefGeometry(heights, cols, rows, wMm / cols, hMm / rows, Math.max(0.4, base));
  }

  /* ---- mode: relief / lithophane from AI image or upload ---- */
  async function buildRelief() {
    const prompt = $('#d3-relief-prompt').value.trim();
    let img = uploadedImage;
    if (!img && !prompt) { toast(t('d3_need_img')); return null; }
    if (!img) {
      $('#d3-status').textContent = t('d3_ai');
      const url = Engine.buildImageUrl({
        prompt: prompt + ', bas-relief sculpture, grayscale heightmap, high contrast, centered, dark background',
        engine: 'flux', width: 768, height: 768, seed: randSeed()
      });
      img = await Engine.loadPixelImage(url);
    }
    const widthMm = Math.max(20, parseFloat($('#d3-relief-width').value) || 80);
    const depth = Math.max(0.5, parseFloat($('#d3-relief-depth').value) || 2.5);
    const invert = $('#d3-invert').checked;
    const base = invert ? 0.6 : 1.2;

    const res = 200;
    const cv = document.createElement('canvas');
    const ar = img.height / img.width;
    cv.width = res; cv.height = Math.max(40, Math.round(res * ar));
    const cx = cv.getContext('2d');
    cx.filter = 'blur(0.6px)';
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    const data = cx.getImageData(0, 0, cv.width, cv.height).data;

    const cols = cv.width - 1, rows = cv.height - 1;
    const heights = new Float32Array((rows + 1) * (cols + 1));
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const sy = rows - r;
        const o = (sy * cv.width + c) * 4;
        let lum = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
        if (invert) lum = 1 - lum;   // lithophane: dark = thick
        heights[r * (cols + 1) + c] = lum * depth;
      }
    }
    const hMm = widthMm * (rows / cols);
    return reliefGeometry(heights, cols, rows, widthMm / cols, hMm / rows, base);
  }

  /* ---- mode: parametric vase (Z-up) ---- */
  function buildVase() {
    const H = Math.max(30, parseFloat($('#d3-vase-height').value) || 100);
    const R = Math.max(10, parseFloat($('#d3-vase-radius').value) || 35);
    const waves = Math.max(0, parseInt($('#d3-vase-waves').value, 10) || 6);
    const pts = [];
    const N = 80;
    pts.push(new THREE.Vector2(0.01, 0));
    for (let i = 0; i <= N; i++) {
      const tN = i / N;
      const belly = 0.62 + 0.38 * Math.sin(Math.PI * (0.15 + 0.85 * tN));
      const wob = waves ? 1 + 0.06 * Math.sin(tN * waves * Math.PI * 2) : 1;
      const neck = tN > 0.85 ? 0.82 + 0.5 * (tN - 0.85) : 1;
      pts.push(new THREE.Vector2(Math.max(2, R * belly * wob * neck), tN * H));
    }
    const g = new THREE.LatheGeometry(pts, 96);
    g.rotateX(Math.PI / 2);   // lathe is Y-up -> convert to Z-up
    return g;
  }

  /* ---- mode: basic shapes (Z-up) ---- */
  function buildShape() {
    const s = Math.max(5, parseFloat($('#d3-shape-size').value) || 50);
    const kind = $('#d3-shape').value;
    let g;
    if (kind === 'sphere') g = new THREE.SphereGeometry(s / 2, 48, 32);
    else if (kind === 'cylinder') { g = new THREE.CylinderGeometry(s / 2, s / 2, s, 64); g.rotateX(Math.PI / 2); }
    else if (kind === 'torus') { g = new THREE.TorusGeometry(s / 2, s / 6, 24, 64); }
    else g = new THREE.BoxGeometry(s, s, s);
    if (kind === 'sphere' || kind === 'torus' || kind === 'box') g.translate(0, 0, 0);
    return g;
  }

  async function generate() {
    initViewport();
    const mode = $('#d3-mode').value;
    const btn = $('#btn-d3-generate');
    btn.disabled = true;
    $('#d3-status').textContent = t('d3_building');
    try {
      let g = null;
      if (mode === 'text') g = buildText();
      else if (mode === 'relief') g = await buildRelief();
      else if (mode === 'vase') g = buildVase();
      else g = buildShape();
      if (g) {
        showGeometry(g);
        $('#d3-status').textContent = t('d3_ready');
      } else {
        $('#d3-status').textContent = t('d3_hint');
      }
    } catch (e) {
      $('#d3-status').textContent = '⚠️ ' + e.message;
    }
    btn.disabled = false;
  }

  function exportStl() {
    if (!currentGeom) return;
    const exporter = new THREE.STLExporter();
    const tmp = new THREE.Mesh(currentGeom, new THREE.MeshStandardMaterial());
    const result = exporter.parse(tmp, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    const mode = $('#d3-mode').value;
    downloadBlob(blob, 'vans-3d-' + mode + '-' + Date.now().toString(36) + '.stl');
    toast(t('d3_exported'), 5000);
  }

  function init() {
    $('#d3-mode').addEventListener('change', () => {
      const mode = $('#d3-mode').value;
      $$('.d3-panel').forEach(p => p.classList.add('hidden'));
      const panel = $('#d3-panel-' + (mode === 'shape' ? 'shape' : mode));
      if (panel) panel.classList.remove('hidden');
    });
    $('#btn-d3-generate').onclick = generate;
    $('#btn-d3-export').onclick = exportStl;
    $('#d3-upload-btn').onclick = () => $('#d3-file').click();
    $('#d3-file').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => { uploadedImage = img; $('#d3-file-name').textContent = '✓ ' + f.name; };
      img.src = URL.createObjectURL(f);
      e.target.value = '';
    });
  }

  return { init, initViewport, onResize };
})();
