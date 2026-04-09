import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

/**
 * POST /api/scraper-proxy
 * Fetches a URL, sanitizes the HTML (removes scripts, rewrites relative URLs),
 * and injects a visual element-picker script for the scraper builder.
 */
export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove all scripts and dangerous elements
    $("script").remove();
    $("noscript").remove();
    $("iframe").remove();
    $("object").remove();
    $("embed").remove();

    // Remove event handler attributes
    $("*").each((_, el) => {
      const elem = $(el);
      const attribs = (el as unknown as { attribs?: Record<string, string> }).attribs || {};
      for (const attr of Object.keys(attribs)) {
        if (attr.startsWith("on") || attribs[attr]?.startsWith("javascript:")) {
          elem.removeAttr(attr);
        }
      }
    });

    // Add base tag for resolving relative URLs
    $("head").prepend(`<base href="${parsedUrl.origin}${parsedUrl.pathname}" />`);

    // Remove existing base tags that might conflict (keep only ours)
    $("base").slice(1).remove();

    // Inject picker CSS
    $("head").append(`<style id="picker-styles">
      .picker-highlight {
        outline: 3px solid #3b82f6 !important;
        outline-offset: -1px;
        background-color: rgba(59, 130, 246, 0.08) !important;
        cursor: crosshair !important;
      }
      .picker-container-mark {
        outline: 2px dashed #10b981 !important;
        outline-offset: -1px;
      }
      .picker-selected {
        outline: 3px solid #f59e0b !important;
        outline-offset: -1px;
        background-color: rgba(245, 158, 11, 0.1) !important;
      }
      body { cursor: crosshair !important; }
      * { pointer-events: auto !important; }
      a, button, input, select, textarea { pointer-events: none !important; }
    </style>`);

    // Inject picker script
    $("body").append(`<script id="picker-script">
(function() {
  var mode = 'container';
  var containerSelector = null;
  var hoveredEl = null;

  // Listen for mode changes from parent
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'set-mode') {
      mode = e.data.mode;
      containerSelector = e.data.containerSelector || null;
      // Clear previous highlights
      document.querySelectorAll('.picker-container-mark').forEach(function(el) {
        el.classList.remove('picker-container-mark');
      });
      document.querySelectorAll('.picker-selected').forEach(function(el) {
        el.classList.remove('picker-selected');
      });
      // Mark containers when picking child elements
      if (containerSelector && mode !== 'container') {
        try {
          document.querySelectorAll(containerSelector).forEach(function(el) {
            el.classList.add('picker-container-mark');
          });
        } catch(ex) {}
      }
    }
  });

  document.addEventListener('mouseover', function(e) {
    if (hoveredEl) hoveredEl.classList.remove('picker-highlight');
    hoveredEl = e.target;
    if (hoveredEl && hoveredEl.id !== 'picker-script') {
      hoveredEl.classList.add('picker-highlight');
    }
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (hoveredEl) hoveredEl.classList.remove('picker-highlight');
  }, true);

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var el = e.target;
    if (!el || el.id === 'picker-script') return;

    var selector;
    var count = 0;

    if (mode === 'container') {
      selector = genSelector(el);
      try { count = document.querySelectorAll(selector).length; } catch(ex) {}
    } else {
      if (containerSelector) {
        var container = el.closest(containerSelector);
        if (container) {
          selector = genRelativeSelector(el, container);
          // Count how many containers have this element
          try {
            document.querySelectorAll(containerSelector).forEach(function(c) {
              if (c.querySelector(selector)) count++;
            });
          } catch(ex) {}
        } else {
          selector = genSelector(el);
          try { count = document.querySelectorAll(selector).length; } catch(ex) {}
        }
      } else {
        selector = genSelector(el);
        try { count = document.querySelectorAll(selector).length; } catch(ex) {}
      }
    }

    // Visual feedback
    el.classList.add('picker-selected');

    window.parent.postMessage({
      type: 'element-selected',
      mode: mode,
      selector: selector,
      text: (el.textContent || '').trim().substring(0, 200),
      tagName: el.tagName.toLowerCase(),
      matchCount: count,
    }, '*');
  }, true);

  function genSelector(el) {
    if (el.id && /^[a-zA-Z]/.test(el.id)) {
      return '#' + cssEsc(el.id);
    }
    var classes = getClasses(el);
    if (classes.length > 0) {
      var sel = el.tagName.toLowerCase() + '.' + classes.slice(0, 3).map(cssEsc).join('.');
      try { if (document.querySelectorAll(sel).length <= 30) return sel; } catch(ex) {}
    }
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var part = cur.tagName.toLowerCase();
      var cls = getClasses(cur);
      if (cls.length > 0) {
        part += '.' + cls.slice(0, 2).map(cssEsc).join('.');
      }
      parts.unshift(part);
      try {
        var full = parts.join(' > ');
        if (document.querySelectorAll(full).length <= 20 && parts.length >= 2) return full;
      } catch(ex) {}
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function genRelativeSelector(el, container) {
    var tag = el.tagName.toLowerCase();
    var classes = getClasses(el);
    if (classes.length > 0) {
      var sel1 = tag + '.' + classes.slice(0, 2).map(cssEsc).join('.');
      try { if (container.querySelectorAll(sel1).length === 1) return sel1; } catch(ex) {}
      var sel2 = '.' + cssEsc(classes[0]);
      try { if (container.querySelectorAll(sel2).length === 1) return sel2; } catch(ex) {}
    }
    try { if (container.querySelectorAll(tag).length === 1) return tag; } catch(ex) {}
    var parts = [];
    var cur = el;
    while (cur && cur !== container) {
      var pt = cur.tagName.toLowerCase();
      var cl = getClasses(cur);
      if (cl.length > 0) pt += '.' + cl.slice(0, 2).map(cssEsc).join('.');
      parts.unshift(pt);
      cur = cur.parentElement;
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var s = parts.slice(i).join(' ');
      try { if (container.querySelectorAll(s).length === 1) return s; } catch(ex) {}
    }
    return parts.join(' > ');
  }

  function getClasses(el) {
    if (!el.className || typeof el.className !== 'string') return [];
    return el.className.trim().split(/\\s+/).filter(function(c) {
      return c && c.length < 40 && !/^(hover|active|focus|picker-)/.test(c);
    });
  }

  function cssEsc(s) {
    return s.replace(/([^a-zA-Z0-9_-])/g, '\\\\$1');
  }
})();
</script>`);

    const sanitizedHtml = $.html();

    return NextResponse.json({ html: sanitizedHtml });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
