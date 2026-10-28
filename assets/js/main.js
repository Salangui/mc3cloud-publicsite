/* ═══════════════════════════════════════════════════════════════════════════
   MC3 CLOUD — JavaScript du site (vanilla, ~5 Ko, aucune dépendance)

   Rôle : de petites améliorations. Le contenu et la navigation fonctionnent
   SANS ce fichier (liens HTML classiques).

     1. Menu mobile
     2. Apparition progressive des sections
     3. Cadres de logo : essai .svg/.png/.webp/.jpg, sinon espace réservé neutre
     4. Filtre des produits par catégorie
     5. Sélecteur de régions (carte de présence)

   Fichier « classique » (pas de module) : fonctionne en ouvrant les pages
   directement depuis le disque (file://).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Menu mobile ─────────────────────────────────────────────────── */
  var header = document.querySelector('[data-header]');
  var toggle = document.querySelector('[data-menu-toggle]');

  if (header && toggle) {
    var setOpen = function (open) {
      if (open) header.setAttribute('data-menu-open', '');
      else header.removeAttribute('data-menu-open');
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', function () {
      setOpen(!header.hasAttribute('data-menu-open'));
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && header.hasAttribute('data-menu-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    header.querySelectorAll('.site-nav a').forEach(function (link) {
      link.addEventListener('click', function () {
        setOpen(false);
      });
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (event) {
      if (event.matches) setOpen(false);
    });
  }

  /* ── 2. Apparition progressive ──────────────────────────────────────── */
  var reveals = document.querySelectorAll('[data-reveal]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) {
      el.classList.add('is-visible');
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── 3. Cadres de logo ──────────────────────────────────────────────── */
  // Le logo attendu est assets/logos/<nom>.svg. S'il est absent, on essaie le même nom en
  // .png, .webp, .jpg ; s'il n'y a rien du tout, on affiche « [Logo Nom] » (cadre neutre,
  // jamais un faux logo). Déposer un fichier dans assets/logos/ suffit.
  var LOGO_FALLBACKS = ['png', 'webp', 'jpg', 'jpeg'];
  document.querySelectorAll('.logo-slot').forEach(function (slot) {
    var img = slot.querySelector('img');
    if (!img) return;
    var base = img.getAttribute('src');
    var candidates = [base];
    LOGO_FALLBACKS.forEach(function (ext) {
      var alt = base.replace(/\.[a-z0-9]+$/i, '.' + ext);
      if (candidates.indexOf(alt) === -1) candidates.push(alt);
    });
    (function tryCandidate(i) {
      if (i >= candidates.length) {
        slot.classList.add('is-missing');
        return;
      }
      var probe = new Image();
      probe.onload = function () {
        if (i > 0) img.setAttribute('src', candidates[i]);
      };
      probe.onerror = function () {
        tryCandidate(i + 1);
      };
      probe.src = candidates[i];
    })(0);
  });

  /* ── 4. Filtre des produits ─────────────────────────────────────────── */
  document.querySelectorAll('[data-filter-root]').forEach(function (root) {
    var bar = root.querySelector('[data-filter-bar]');
    var buttons = root.querySelectorAll('[data-filter]');
    var items = root.querySelectorAll('[data-categories]');
    if (!bar) return;
    bar.hidden = false; // la barre n'existe que si JavaScript est actif

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var value = button.getAttribute('data-filter') || 'all';
        buttons.forEach(function (b) {
          var on = b === button;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        items.forEach(function (item) {
          var cats = (item.getAttribute('data-categories') || '').split(' ');
          item.hidden = !(value === 'all' || cats.indexOf(value) !== -1);
        });
      });
    });
  });

  /* ── 5. Sélecteur de régions ────────────────────────────────────────── */
  // Les cadres de zoom sont écrits dans le HTML par le générateur (data-boxes, data-full,
  // data-compact) : aucun fichier à charger.
  document.querySelectorAll('[data-presence]').forEach(function (root) {
    var svg = root.querySelector('svg');
    var mapBox = root.querySelector('.presence__map');
    if (!svg || !mapBox) return;

    var boxes = JSON.parse(root.getAttribute('data-boxes') || '{}');
    var fullBox = JSON.parse(root.getAttribute('data-full') || '{}');
    var compactBox = JSON.parse(root.getAttribute('data-compact') || '{}');
    var narrow = window.matchMedia('(max-width: 639.98px)');
    var buttons = root.querySelectorAll('[data-region-btn]');
    var reset = root.querySelector('[data-region-reset]');
    var regionItems = root.querySelectorAll('.region');
    var nodes = svg.querySelectorAll('.worldmap__node');

    var current = null;
    var view = { x: fullBox.x, y: fullBox.y, w: fullBox.w, h: fullBox.h };
    var frame = 0;

    // Vue de départ : tous les territoires, ou Afrique + océan Indien seulement sur mobile
    var baseBox = function () {
      return narrow.matches ? compactBox : fullBox;
    };

    // Adapte un cadre au ratio du conteneur (évite les bandes vides)
    var fit = function (box) {
      var rect = mapBox.getBoundingClientRect();
      var ratio = rect.width && rect.height ? rect.width / rect.height : 2;
      var cx = box.x + box.w / 2;
      var cy = box.y + box.h / 2;
      var w = box.w;
      var h = box.h;
      if (w / h < ratio) w = h * ratio;
      else h = w / ratio;
      return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
    };

    var apply = function (b) {
      view = b;
      svg.setAttribute('viewBox', b.x + ' ' + b.y + ' ' + b.w + ' ' + b.h);
      svg.style.setProperty('--node-r', b.w / (current !== null ? 120 : 260) + 'px');
      svg.style.setProperty('--dot-size', Math.max(b.w / 300, 1.2) + 'px');
    };

    var animateTo = function (target) {
      cancelAnimationFrame(frame);
      if (reduceMotion) return apply(target);
      var from = { x: view.x, y: view.y, w: view.w, h: view.h };
      var start = performance.now();
      var step = function (now) {
        var p = Math.min((now - start) / 450, 1);
        var e = 1 - Math.pow(1 - p, 3);
        apply({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          w: from.w + (target.w - from.w) * e,
          h: from.h + (target.h - from.h) * e,
        });
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    var select = function (id) {
      current = current === id ? null : id;
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-region-btn') === current));
      });
      regionItems.forEach(function (li) {
        li.classList.toggle('is-active', li.getAttribute('data-region') === current);
      });
      nodes.forEach(function (n) {
        var inRegion = n.getAttribute('data-region') === current;
        n.classList.toggle('is-dim', current !== null && !inRegion);
      });
      if (reset) reset.hidden = current === null;
      animateTo(fit(current ? boxes[current] : baseBox()));
    };

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        select(b.getAttribute('data-region-btn'));
      });
    });
    if (reset) {
      reset.addEventListener('click', function () {
        select(current);
      });
    }

    apply(fit(baseBox()));
    window.addEventListener('resize', function () {
      apply(fit(current ? boxes[current] : baseBox()));
    });
  });
})();
