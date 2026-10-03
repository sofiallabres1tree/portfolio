(function () {
  if (window.__slCursor || !window.matchMedia("(pointer: fine)").matches) return;
  window.__slCursor = true;
  const css = document.createElement("style");
  css.textContent = "html, body, a, button, * { cursor: none !important; }" +
    "#sl-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; width: 44px; height: 44px; opacity: 0; transition: opacity 0.2s ease; will-change: transform; }" +
    "#sl-cursor i { position: absolute; border-radius: 50%; display: block; }" +
    "#sl-cursor .b { left: 0; top: 0; width: 34px; height: 34px; background: #ff7300; }" +
    "#sl-cursor .s { left: 22px; top: 25px; width: 13px; height: 13px; background: #0077ff; }";
  document.head.appendChild(css);
  const el = document.createElement("div");
  el.id = "sl-cursor";
  el.innerHTML = '<i class="b"></i><i class="s"></i>';
  const mount = () => document.body.appendChild(el);
  document.body ? mount() : document.addEventListener("DOMContentLoaded", mount);
  const overContent = (t) => {
    for (let n = t; n && n !== document.body; n = n.parentElement) {
      const tag = n.tagName;
      if (tag === "IMG" || tag === "PICTURE" || tag === "VIDEO" || tag === "CANVAS" || tag === "IMAGE-SLOT") return true;
      for (const c of n.childNodes) if (c.nodeType === 3 && c.textContent.trim()) return true;
    }
    return false;
  };
  const hitText = (x, y) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.textContent.trim() && !(n.parentElement && n.parentElement.closest("#sl-cursor, script, style")) ? 1 : 2 });
    const r = document.createRange();
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      r.selectNodeContents(n);
      for (const b of r.getClientRects()) if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return true;
    }
    for (const m of document.querySelectorAll("img, picture, video, canvas, image-slot")) {
      const b = m.getBoundingClientRect();
      if (b.width && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom && getComputedStyle(m).visibility !== "hidden") return true;
    }
    return false;
  };
  let mx = 0, my = 0, queued = false;
  const update = () => {
    queued = false;
    const t = document.elementFromPoint(mx, my);
    el.style.opacity = (t && overContent(t)) || hitText(mx, my) ? "0.45" : "1";
  };
  window.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    el.style.transform = "translate3d(" + (mx - 17) + "px," + (my - 17) + "px,0)";
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  document.addEventListener("mouseleave", () => { el.style.opacity = "0"; });
})();
