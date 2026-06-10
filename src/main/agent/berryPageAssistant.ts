import type { AgentActivityEvent } from "../../shared/agent-activity-types";
import { getBerryPageMoodMap } from "../../shared/berrySpriteMood";
import { loadBerrySpriteDataUrls } from "./berrySpriteLoader";

/** Injected into page tabs — animated Berry sprite + click effects. */
export const buildBerryAssistantInitScript = (frames: string[]): string => {
  const framesJson = JSON.stringify(frames.length > 0 ? frames : []);
  const moodsJson = JSON.stringify(getBerryPageMoodMap());
  return `
(function () {
  if (window.__berryAssistant) return true;

  var FRAMES = ${framesJson};
  var MOODS = ${moodsJson};
  if (!FRAMES.length) {
    FRAMES = ["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cellipse cx='32' cy='36' rx='22' ry='20' fill='%235B4FE8'/%3E%3C/svg%3E"];
  }

  var MOOD_CLASSES = ["mood-think","mood-fly","mood-read","mood-peek","mood-wait","mood-work","mood-happy","mood-denied","mood-click","mood-idle"];

  var style = document.createElement("style");
  style.textContent = [
    "#berry-assistant-root { pointer-events:none; position:fixed; inset:0; z-index:2147483646; overflow:hidden; }",
    "#berry-assistant-hero {",
    "  display:none !important;",
    "  position:fixed; left:0; top:0; width:56px; height:56px;",
    "  z-index:2147483647; pointer-events:none; opacity:0;",
    "  filter:drop-shadow(0 6px 16px rgba(99,102,241,0.4));",
    "  transition:opacity 0.45s ease;",
    "  will-change:transform;",
    "}",
    "#berry-assistant-hero.visible { opacity:1; }",
    "#berry-assistant-hero.entering .berry-sprite-inner { animation:berry-enter-inner 0.95s cubic-bezier(0.22,1,0.36,1) forwards; }",
    ".berry-sprite-inner { width:100%; height:100%; display:block; transform-origin:center bottom; }",
    "#berry-assistant-hero img { width:100%; height:100%; object-fit:contain; display:block; }",
    "#berry-assistant-hero.mood-think .berry-sprite-inner { animation:berry-think 2.4s ease-in-out infinite; }",
    "#berry-assistant-hero.mood-fly .berry-sprite-inner { animation:berry-fly-bob 0.45s ease-in-out infinite; }",
    "#berry-assistant-hero.mood-read .berry-sprite-inner { animation:berry-read 2.8s ease-in-out infinite; }",
    "#berry-assistant-hero.mood-peek .berry-sprite-inner { animation:berry-peek 1.1s ease-in-out infinite; }",
    "#berry-assistant-hero.mood-wait .berry-sprite-inner { animation:berry-wait 1.6s ease-in-out infinite; }",
    "#berry-assistant-hero.mood-work .berry-sprite-inner { animation:berry-work 0.35s ease-in-out infinite; }",
    "#berry-assistant-hero.mood-happy .berry-sprite-inner { animation:berry-happy 0.7s cubic-bezier(0.34,1.4,0.48,1) 2; }",
    "#berry-assistant-hero.mood-denied .berry-sprite-inner { animation:berry-shake 0.45s ease-in-out 2; }",
    "#berry-assistant-hero.mood-click .berry-sprite-inner { animation:berry-click-pulse 0.22s ease-out; }",
    "#berry-assistant-hero.clicking .berry-sprite-inner { transform:scale(0.82); transition:transform 0.12s ease-out; }",
    "@keyframes berry-enter-inner {",
    "  0% { opacity:0.35; transform:scale(0.58) rotate(-8deg) translateY(-18px); }",
    "  62% { opacity:1; transform:scale(1.07) rotate(3deg) translateY(5px); }",
    "  100% { opacity:1; transform:scale(1) rotate(0) translateY(0); }",
    "}",
    "@keyframes berry-exit-inner {",
    "  to { opacity:0; transform:scale(0.62) translateY(-28px); }",
    "}",
    "@keyframes berry-think { 0%,100% { transform:translateY(0) rotate(0); } 50% { transform:translateY(-5px) rotate(-4deg); } }",
    "@keyframes berry-fly-bob { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-6px) scale(1.04); } }",
    "@keyframes berry-read { 0%,100% { transform:translateX(0) rotate(0); } 33% { transform:translateX(-3px) rotate(-2deg); } 66% { transform:translateX(3px) rotate(2deg); } }",
    "@keyframes berry-peek { 0%,100% { transform:scale(1); } 50% { transform:scale(1.06) translateY(-2px); } }",
    "@keyframes berry-wait { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.78; transform:scale(0.96); } }",
    "@keyframes berry-work { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }",
    "@keyframes berry-happy { 0% { transform:scale(1); } 40% { transform:scale(1.12) translateY(-8px); } 100% { transform:scale(1) translateY(0); } }",
    "@keyframes berry-shake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-4px); } 40% { transform:translateX(4px); } 60% { transform:translateX(-3px); } 80% { transform:translateX(3px); } }",
    "@keyframes berry-click-pulse { 0% { transform:scale(1); } 50% { transform:scale(0.88); } 100% { transform:scale(1); } }",
    "#berry-assistant-trail { position:fixed; width:7px; height:7px; border-radius:50%; pointer-events:none; z-index:2147483645;",
    "  background:radial-gradient(circle,rgba(129,140,248,0.85),rgba(99,102,241,0.2)); animation:berry-trail 0.75s ease-out forwards; }",
    "@keyframes berry-trail { to { opacity:0; transform:scale(2.8); } }",
    ".berry-agent-click-ring { position:absolute; width:12px; height:12px; margin:-6px 0 0 -6px; border-radius:50%;",
    "  border:2px solid rgba(99,102,241,0.9); animation:berry-agent-ring 0.65s ease-out forwards; pointer-events:none; }",
    "@keyframes berry-agent-ring { from { transform:scale(0.6); opacity:1; } to { transform:scale(5); opacity:0; } }",
    "#berry-assistant-flash { position:fixed; inset:0; pointer-events:none; z-index:2147483644; background:white; opacity:0; }",
    "#berry-assistant-flash.active { animation:berry-flash 0.35s ease-out forwards; }",
    "@keyframes berry-flash { 0% { opacity:0.35; } 100% { opacity:0; } }",
    "#berry-assistant-status { position:absolute; left:50%; top:100%; transform:translateX(-50%); margin-top:6px;",
    "  min-width:72px; max-width:168px; padding:3px 10px; border-radius:999px;",
    "  background:rgba(15,20,30,0.88); color:#e7ecf3; font:10px/1.35 system-ui,sans-serif; text-align:center;",
    "  opacity:0; transition:opacity 0.3s ease, transform 0.3s ease; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;",
    "  box-shadow:0 4px 12px rgba(0,0,0,0.25); }",
    "#berry-assistant-status.show { opacity:1; transform:translateX(-50%) translateY(0); }",
  ].join("\\n");
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = "berry-assistant-root";
  var flash = document.createElement("div");
  flash.id = "berry-assistant-flash";
  root.appendChild(flash);

  var hero = document.createElement("div");
  hero.id = "berry-assistant-hero";
  var inner = document.createElement("div");
  inner.className = "berry-sprite-inner";
  var img = document.createElement("img");
  img.src = FRAMES[0];
  img.alt = "";
  img.draggable = false;
  inner.appendChild(img);
  hero.appendChild(inner);

  var status = document.createElement("div");
  status.id = "berry-assistant-status";
  hero.appendChild(status);

  document.documentElement.appendChild(hero);
  document.documentElement.appendChild(root);

  var frameIdx = 0;
  var frameTimer = null;
  var visible = false;
  var lastX = window.innerWidth * 0.5;
  var lastY = 56;
  var currentMood = "idle";
  var activityQueue = [];
  var activityBusy = false;
  var currentKind = "idle";
  var flyAnimId = null;
  var pendingSkippable = null;

  var SKIPPABLE_KINDS = {
    thinking: true,
    reading_page: true,
    tool_running: true,
    responding: true,
  };

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function cancelFlyAnim() {
    if (flyAnimId) {
      cancelAnimationFrame(flyAnimId);
      flyAnimId = null;
    }
  }

  function clearMoodClasses() {
    for (var i = 0; i < MOOD_CLASSES.length; i++) hero.classList.remove(MOOD_CLASSES[i]);
  }

  function setMood(pageMood) {
    clearMoodClasses();
    currentMood = pageMood || "idle";
    if (pageMood && pageMood !== "idle") hero.classList.add("mood-" + pageMood);
  }

  function applyMoodForKind(kind) {
    var cfg = MOODS[kind] || MOODS.thinking || { pageMood: "think", frameMin: 0, frameMax: 2, frameMs: 400 };
    setMood(cfg.pageMood);
    startFrames(cfg.frameMin, cfg.frameMax, cfg.frameMs);
  }

  function setFrame(i) {
    frameIdx = ((i % FRAMES.length) + FRAMES.length) % FRAMES.length;
    img.src = FRAMES[frameIdx];
  }

  function startFrames(minF, maxF, ms) {
    stopFrames();
    if (maxF <= minF || !ms) {
      setFrame(minF || 0);
      return;
    }
    setFrame(minF);
    frameTimer = setInterval(function () {
      var next = frameIdx + 1;
      if (next > maxF) next = minF;
      setFrame(next);
    }, ms);
  }

  function stopFrames() {
    if (frameTimer) { clearInterval(frameTimer); frameTimer = null; }
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function flyDuration(x1, y1, x2, y2) {
    var d = Math.hypot(x2 - x1, y2 - y1);
    return Math.min(1400, Math.max(620, Math.round(d * 0.55)));
  }

  function place(x, y) {
    lastX = x;
    lastY = y;
    hero.style.transform =
      "translate3d(" + x + "px," + y + "px,0) translate(-50%,-50%)";
  }

  function animateFlyTo(x2, y2, dur, options) {
    cancelFlyAnim();
    var x1 = lastX;
    var y1 = lastY;
    var useArc = !options || options.arc !== false;
    var start = performance.now();

    return new Promise(function (resolve) {
      function tick(now) {
        var t = Math.min(1, (now - start) / dur);
        var e = easeInOutCubic(t);
        var x = x1 + (x2 - x1) * e;
        var y = y1 + (y2 - y1) * e;
        if (useArc) {
          var lift = Math.sin(Math.PI * e) * Math.min(52, Math.hypot(x2 - x1, y2 - y1) * 0.14);
          y -= lift;
        }
        place(x, y);
        if (t < 1) {
          flyAnimId = requestAnimationFrame(tick);
        } else {
          place(x2, y2);
          flyAnimId = null;
          resolve();
        }
      }
      flyAnimId = requestAnimationFrame(tick);
    });
  }

  function animateFlyPath(points, totalDur, options) {
    if (!points || !points.length) return wait(0);
    if (points.length === 1) {
      return animateFlyTo(points[0].x, points[0].y, totalDur, options);
    }

    cancelFlyAnim();
    var useArc = !options || options.arc !== false;
    var chain = [{ x: lastX, y: lastY }];
    for (var i = 0; i < points.length; i++) chain.push(points[i]);

    var segLens = [];
    var totalDist = 0;
    for (var j = 1; j < chain.length; j++) {
      var segD = Math.hypot(chain[j].x - chain[j - 1].x, chain[j].y - chain[j - 1].y);
      segLens.push(segD);
      totalDist += segD;
    }
    if (totalDist < 1) {
      place(points[points.length - 1].x, points[points.length - 1].y);
      return wait(0);
    }

    var start = performance.now();
    return new Promise(function (resolve) {
      function pointAt(dist) {
        var walked = 0;
        for (var k = 0; k < segLens.length; k++) {
          if (walked + segLens[k] >= dist) {
            var local = (dist - walked) / segLens[k];
            return {
              x: chain[k].x + (chain[k + 1].x - chain[k].x) * local,
              y: chain[k].y + (chain[k + 1].y - chain[k].y) * local,
            };
          }
          walked += segLens[k];
        }
        return chain[chain.length - 1];
      }

      function tick(now) {
        var t = Math.min(1, (now - start) / totalDur);
        var e = easeInOutCubic(t);
        var p = pointAt(totalDist * e);
        var y = p.y;
        if (useArc) {
          y -= Math.sin(Math.PI * e) * Math.min(40, totalDist * 0.1);
        }
        place(p.x, y);
        if (t < 1) {
          flyAnimId = requestAnimationFrame(tick);
        } else {
          var end = points[points.length - 1];
          place(end.x, end.y);
          flyAnimId = null;
          resolve();
        }
      }
      flyAnimId = requestAnimationFrame(tick);
    });
  }

  function dropTrail(x, y, delay) {
    setTimeout(function () {
      var t = document.createElement("div");
      t.className = "berry-assistant-trail";
      t.style.left = x + "px";
      t.style.top = y + "px";
      root.appendChild(t);
      setTimeout(function () { t.remove(); }, 800);
    }, delay || 0);
  }

  function dropTrailPath(x1, y1, x2, y2, steps) {
    var n = steps || 4;
    for (var i = 1; i <= n; i++) {
      (function (idx) {
        var t = idx / n;
        dropTrail(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, idx * 80);
      })(i);
    }
  }

  function setStatus(label) {
    if (label) status.textContent = String(label).slice(0, 48);
    status.classList.add("show");
  }

  function drainQueue() {
    if (activityBusy || !activityQueue.length) return;
    activityBusy = true;
    var job = activityQueue.shift();
    job().finally(function () {
      activityBusy = false;
      if (pendingSkippable) {
        var p = pendingSkippable;
        pendingSkippable = null;
        activityQueue.push(p.run);
      }
      drainQueue();
    });
  }

  function enqueueActivity(kind, fn) {
    return new Promise(function (resolve, reject) {
      var job = function () {
        return Promise.resolve(fn()).then(resolve, reject);
      };
      if (SKIPPABLE_KINDS[kind]) {
        if (pendingSkippable && pendingSkippable.resolve) {
          pendingSkippable.resolve(true);
        }
        if (activityBusy || activityQueue.length > 0) {
          pendingSkippable = { run: job, resolve: resolve, reject: reject };
          return;
        }
      } else if (pendingSkippable && pendingSkippable.resolve) {
        pendingSkippable.resolve(true);
        pendingSkippable = null;
      }
      activityQueue.push(job);
      drainQueue();
    });
  }

  function runEnter(label) {
    var cx = window.innerWidth * 0.5;
    cancelFlyAnim();
    place(cx, -56);
    hero.classList.add("visible", "entering");
    hero.classList.remove("working", "clicking");
    setMood("fly");
    startFrames(3, 6, 100);
    if (label) setStatus(label);
    return animateFlyTo(cx, 64, 980, { arc: true }).then(function () {
      hero.classList.remove("entering");
      visible = true;
    });
  }

  function runExit() {
    stopFrames();
    setMood("idle");
    status.classList.remove("show");
    inner.style.animation = "berry-exit-inner 0.55s ease-in forwards";
    var cx = lastX;
    return animateFlyTo(cx, -80, 560, { arc: false }).then(function () {
      return wait(120);
    }).then(function () {
      hero.classList.remove("visible", "working", "clicking");
      inner.style.animation = "";
      visible = false;
      currentKind = "idle";
    });
  }

  function runFlyTo(x, y, label, kind) {
    if (!visible) {
      return runEnter(label).then(function () {
        return runFlyTo(x, y, label, kind);
      });
    }
    if (Math.hypot(x - lastX, y - lastY) < 32) {
      if (kind) applyMoodForKind(kind);
      else applyMoodForKind(currentKind === "idle" ? "thinking" : currentKind);
      if (label) setStatus(label);
      return wait(160);
    }
    var dur = flyDuration(lastX, lastY, x, y);
    if (kind) applyMoodForKind(kind);
    else applyMoodForKind(currentKind === "idle" ? "thinking" : currentKind);
    if (label) setStatus(label);
    hero.classList.add("working");
    dropTrailPath(lastX, lastY, x, y, Math.min(6, Math.max(3, Math.round(dur / 180))));
    return animateFlyTo(x, y, dur, { arc: true }).then(function () {
      hero.classList.remove("working");
    });
  }

  function runFlyToSelector(selector, label, kind) {
    var el = document.querySelector(selector);
    if (!el) return runFlyTo(window.innerWidth * 0.5, window.innerHeight * 0.38, label, kind || "clicking");
    try {
      el.scrollIntoView({ block: "center", inline: "center" });
    } catch (_) {}
    var p = centerOf(el);
    return runFlyTo(p.x, p.y, label, kind || "clicking");
  }

  function anchorPoint(anchor) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var map = {
      top: { x: w * 0.5, y: h * 0.14 },
      read: { x: w * 0.2, y: h * 0.32 },
      center: { x: w * 0.5, y: h * 0.44 },
      side: { x: w * 0.82, y: h * 0.3 },
      navigate: { x: w * 0.68, y: h * 0.12 },
      urlbar: { x: w * 0.5, y: 36 },
    };
    return map[anchor] || map.center;
  }

  function runFlyToAnchor(anchor, label, kind) {
    var p = anchorPoint(anchor);
    return runFlyTo(p.x, p.y, label, kind);
  }

  function runClick() {
    hero.classList.add("clicking");
    setMood("click");
    var ring = document.createElement("div");
    ring.className = "berry-agent-click-ring";
    ring.style.left = lastX + "px";
    ring.style.top = lastY + "px";
    root.appendChild(ring);
    setTimeout(function () { ring.remove(); }, 700);
    return wait(260).then(function () {
      hero.classList.remove("clicking");
    });
  }

  function runScreenshotFlash() {
    flash.classList.remove("active");
    void flash.offsetWidth;
    flash.classList.add("active");
    return wait(360).then(function () { flash.classList.remove("active"); });
  }

  function runPlayActivity(kind, selector, label) {
    currentKind = kind;
    var short = label ? String(label).slice(0, 42) : "";

    if (kind === "idle") return runExit();

    switch (kind) {
      case "thinking":
        return runFlyToAnchor("side", short || "Thinking…", kind);
      case "navigating":
        applyMoodForKind("navigating");
        return (visible ? Promise.resolve() : runEnter(short || "Navigating…"))
          .then(function () {
            var p1 = anchorPoint("navigate");
            var p2 = anchorPoint("urlbar");
            var dur = flyDuration(lastX, lastY, p2.x, p2.y) + 320;
            hero.classList.add("working");
            if (short) setStatus(short);
            dropTrailPath(lastX, lastY, p2.x, p2.y, 5);
            return animateFlyPath([p1, p2], dur, { arc: true }).then(function () {
              hero.classList.remove("working");
            });
          });
      case "reading_page":
        return runFlyToAnchor("read", short || "Reading…", kind);
      case "screenshot":
        return runFlyToAnchor("top", short || "Looking…", kind)
          .then(runScreenshotFlash);
      case "tool_consent":
        return runFlyToAnchor("center", short || "Waiting for you…", kind);
      case "clicking":
        return (selector
          ? runFlyToSelector(selector, short || "Clicking…", kind)
          : runFlyToAnchor("center", short || "Clicking…", kind)
        ).then(runClick);
      case "tool_running":
        return runFlyToAnchor("center", short || "Running tool…", kind);
      case "tool_done":
        return runFlyToAnchor("side", short || "Done!", kind);
      case "responding":
        return runFlyToAnchor("side", short || "Reply ready", kind);
      case "tool_denied":
        applyMoodForKind("tool_denied");
        return runFlyToAnchor("center", short || "Stopped", kind);
      default:
        return runFlyToAnchor("center", short, kind);
    }
  }

  window.__berryAssistant = {
    enter: function (label) { return enqueueActivity("thinking", function () { return runEnter(label); }); },
    exit: function () { return enqueueActivity("idle", function () { return runExit(); }); },
    flyTo: function (x, y, label) { return enqueueActivity("thinking", function () { return runFlyTo(x, y, label); }); },
    flyToSelector: function (sel, label) { return enqueueActivity("clicking", function () { return runFlyToSelector(sel, label); }); },
    flyToAnchor: function (a, label) { return enqueueActivity("thinking", function () { return runFlyToAnchor(a, label); }); },
    click: function (sel) {
      return enqueueActivity("clicking", function () {
        if (sel) return runFlyToSelector(sel, "Click…", "clicking").then(runClick);
        return runClick();
      });
    },
    playActivity: function (kind, selector, label) {
      return enqueueActivity(kind, function () { return runPlayActivity(kind, selector, label); });
    },
    hide: function () { return this.exit(); },
  };

  window.__berryAgentCursor = {
    goTo: function (sel) { return window.__berryAssistant.flyToSelector(sel, ""); },
    click: function (sel) { return window.__berryAssistant.click(sel); },
    hide: function () { window.__berryAssistant.hide(); },
  };

  place(lastX, lastY);

  return true;
})();
`;
};

export const buildBerryAssistantInitScriptFromDisk = (): string =>
  buildBerryAssistantInitScript(loadBerrySpriteDataUrls());

export function toolFormSelector(toolName: string): string {
  const safe = toolName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `form[toolname="${safe}"]`;
}

export const buildCursorAnimateScript = (toolName: string): string => {
  const sel = toolFormSelector(toolName);
  return `
(async function () {
  if (typeof window.__berryAssistant === "undefined") return false;
  await window.__berryAssistant.playActivity("clicking", ${JSON.stringify(sel)}, "Clicking…");
  return true;
})();
`;
};

export const buildBerryActivityScript = (event: AgentActivityEvent): string => {
  const kind = event.kind;
  const selector = event.selector ? JSON.stringify(event.selector) : "null";
  const label = JSON.stringify(event.label.slice(0, 48));
  return `
(async function () {
  if (typeof window.__berryAssistant === "undefined") return false;
  await window.__berryAssistant.playActivity(${JSON.stringify(kind)}, ${selector}, ${label});
  return true;
})();
`;
};

/** @deprecated use buildBerryAssistantInitScriptFromDisk */
export const AGENT_CURSOR_INIT_SCRIPT = buildBerryAssistantInitScriptFromDisk();
