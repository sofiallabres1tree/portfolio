// Crochet eyes that grow into a face on hover. Mounts into the first #eye-grow element on the page.
(function () {
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || 'eye-grow/';

  // The page framework can render #eye-grow more than once (and throw early copies away),
  // so keep watching and mount into whichever copy is live and still empty.
  function whenMounted(cb) {
    const scan = () => {
      const el = document.getElementById('eye-grow');
      if (el && el.isConnected && !el.querySelector('canvas')) cb(el);
    };
    scan();
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  }

  whenMounted(async (piece) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1303; canvas.height = 1608;
    canvas.style.cssText = 'display: block; width: 100%; height: 100%;';
    piece.appendChild(canvas);
    const hint = piece.parentElement.querySelector('[data-eye-hint]') || document.createElement('span');

    // Iris centres in the aligned 1303x1608 canvas, as fractions.
    const EYES = [[703 / 1303, 617 / 1608], [1033 / 1303, 617 / 1608]];
    const EYE_HIT = 0.13;           // hover radius around an eye, as a fraction of width

    const P_MAX = 4;
    const GROW_RATE = 0.38;         // constant speed: ~10.5s from eyes to finished portrait
    const SHRINK_RATE = 0.6;

    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;

    const VS = `attribute vec2 a; varying vec2 uv;
      void main() { uv = vec2(a.x * .5 + .5, .5 - a.y * .5); gl_Position = vec4(a, 0., 1.); }`;
    // Chain of four overlapping per-pixel crossfades (stage1→2→3→4→5).
    // tau holds, per pixel, *when* inside each transition that pixel changes, so growth
    // spreads outward from the previous silhouette instead of switching all at once.
    const FS = `precision highp float; varying vec2 uv;
      uniform sampler2D s0, s1, s2, s3, s4, tau, tau5; uniform float p;
      const float LC = 0.55;          // colour blend length (fraction of a transition): slow, gradual
      // opacity blend length is passed per transition: short, so new yarn arrives solid, not ghosted
      const float START = 0.8, LEN = 1.6;    // transitions overlap: [0,1.6] [0.8,2.4] [1.6,3.2] [2.4,4]
      float w(float k, float t, float L) {
        float f = clamp((p - k * START) / LEN, 0., 1.);
        float x = clamp((f - t * (1. - L)) / L, 0., 1.);
        return x * x * (3. - 2. * x);
      }
      // straight (un-premultiplied) colour; where a layer is empty it borrows the other's colour
      vec3 rgb(vec4 c, vec3 fallback) { return c.a > 0.004 ? c.rgb / c.a : fallback; }
      void step(inout vec3 col, inout float a, vec4 nxt, float k, float t, float LA) {
        vec3 n = rgb(nxt, col);
        col = a > 0.004 ? col : n;
        float wa = w(k, t, LA), wc = w(k, t, LC);
        // slow colour drift only where the old layer was solid; over faint fringe pixels the
        // colour arrives together with the opacity (otherwise white fringe turns into white yarn)
        float solid = smoothstep(0.3, 0.95, a) * smoothstep(0.0, 0.5, nxt.a);
        col = mix(col, n, mix(max(wa, wc), wc, solid));
        a = mix(a, nxt.a, wa);
      }
      void main() {
        vec3 t = texture2D(tau, uv).rgb;
        vec4 c0 = texture2D(s0, uv);
        float a = c0.a; vec3 col = rgb(c0, vec3(0.));
        step(col, a, texture2D(s1, uv), 0., t.r, .07);
        step(col, a, texture2D(s2, uv), 1., t.g, .07);
        step(col, a, texture2D(s3, uv), 2., t.b, .07);
        step(col, a, texture2D(s4, uv), 3., texture2D(tau5, uv).r, .025);  // longest growth distance → narrower band
        gl_FragColor = vec4(col * a, a);   // premultiplied
      }`;

    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const load = (src) => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = BASE + src; });
    const srcs = ['stage1.png', 'stage2.png', 'stage3.png', 'stage4.png', 'stage5.png', 'tau.png', 'tau5.png'];
    const names = ['s0', 's1', 's2', 's3', 's4', 'tau', 'tau5'];
    const imgs = await Promise.all(srcs.map(load));
    imgs.forEach((img, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !names[i].startsWith('tau'));
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(prog, names[i]), i);
    });
    const uP = gl.getUniformLocation(prog, 'p');

    let p = 0, mode = 'idle';       // idle | grow | hold
    let last = performance.now(), raf = 0;

    function draw() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uP, p);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function onEye(ev) {
      const r = piece.getBoundingClientRect();
      const fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
      return EYES.some((e) => Math.hypot(fx - e[0], (fy - e[1]) * r.height / r.width) < EYE_HIT);
    }
    function onMove(ev) {
      if (onEye(ev)) { mode = 'grow'; hint.style.opacity = '0'; }
      else if (mode === 'grow') mode = 'hold';
      kick();
    }
    function onLeave() { mode = 'idle'; kick(); }

    piece.addEventListener('pointermove', onMove);
    piece.addEventListener('pointerdown', onMove);
    piece.addEventListener('pointerleave', onLeave);
    piece.addEventListener('pointercancel', onLeave);
    piece.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') onLeave(); });

    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (mode === 'grow') p = Math.min(P_MAX, p + GROW_RATE * dt);
      else if (mode === 'idle') p = Math.max(0, p - SHRINK_RATE * dt);
      draw();
      const settled = mode === 'hold' || (mode === 'grow' && p === P_MAX) || (mode === 'idle' && p === 0);
      raf = settled ? 0 : requestAnimationFrame(frame);
    }

    draw();
  });
})();
