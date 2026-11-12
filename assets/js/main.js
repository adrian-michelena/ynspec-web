/* ynspec — interacciones. Vanilla, sin dependencias. */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' });
  const nf1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ── 1. Partir texto en palabras ─────────────────────────── */
  function splitWords(root, cls, wrapInner) {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) return frag.append(' ');
            const w = el('span', cls);
            if (wrapInner) {
              const inner = el('span', '', tok);
              inner.style.setProperty('--i', i);
              w.append(inner);
            } else {
              w.textContent = tok;
            }
            i += 1;
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.childNodes.length) {
          walk(n);
        }
      });
    };
    walk(root);
    return i;
  }

  $$('[data-split]').forEach((node) => {
    if (/^H[1-6]$/.test(node.tagName)) node.setAttribute('aria-label', node.textContent.replace(/\s+/g, ' ').trim());
    splitWords(node, 'w', true);
  });
  const scrubs = $$('[data-scrub]').map((node) => {
    splitWords(node, 'sw', false);
    return { el: node, words: $$('.sw', node), on: -1 };
  });

  /* ── 2. Entradas al hacer scroll ─────────────────────────── */
  $$('[data-stagger]').forEach((group) => {
    Array.from(group.children).forEach((child, i) => child.style.setProperty('--d', `${i * 80}ms`));
  });

  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        revealIO.unobserve(e.target);
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
  );
  $$('.reveal, [data-split]:not(.hero__line)').forEach((node) => revealIO.observe(node));

  /* ── 3. Marquees: duplicar para bucle continuo ───────────── */
  $$('.marquee__track').forEach((track) => track.append(...Array.from(track.children).map((n) => n.cloneNode(true))));

  /* ── 4. Hero: escala de la composición y paralaje ────────── */
  const stage = $('#stage');
  function fitStage() {
    if (!stage) return;
    const dw = parseFloat(getComputedStyle(stage).getPropertyValue('--dw')) || 1180;
    stage.style.setProperty('--s', (stage.clientWidth / dw).toFixed(4));
  }
  fitStage();

  // rAF no dispara en pestañas en segundo plano: el temporizador garantiza la entrada del hero
  const markReady = () => {
    document.body.classList.add('is-ready');
    $$('.hero__line').forEach((l) => l.classList.add('is-in'));
  };
  requestAnimationFrame(markReady);
  setTimeout(markReady, 150);

  /* ── 5. Navegación: scroll suave, sección activa, progreso ─ */
  const nav = $('#nav');
  const navLinks = $$('[data-nav]');
  const indicator = $('.nav__indicator');
  const progress = $('.progress span');
  const spySections = $$('[data-section]');
  const specSteps = $$('.spec-step');
  let activeHref = null;
  let scrollAnim = 0;

  function scrollToY(target) {
    cancelAnimationFrame(scrollAnim);
    const start = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const end = clamp(target, 0, max);
    const dist = end - start;
    if (reduce || Math.abs(dist) < 4) return window.scrollTo(0, end);
    const dur = clamp(Math.abs(dist) * 0.4, 650, 1500);
    const t0 = performance.now();
    const tick = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      window.scrollTo(0, start + dist * easeInOut(t));
      if (t < 1) scrollAnim = requestAnimationFrame(tick);
    };
    scrollAnim = requestAnimationFrame(tick);
  }
  ['wheel', 'touchstart', 'keydown'].forEach((ev) =>
    addEventListener(ev, () => cancelAnimationFrame(scrollAnim), { passive: true })
  );

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return e.preventDefault();
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (a.dataset.sectorLink) setSector(a.dataset.sectorLink, { reveal: true });
    const y = id === '#inicio' ? 0 : target.getBoundingClientRect().top + window.scrollY;
    scrollToY(y);
    try {
      history.replaceState(null, '', id === '#inicio' ? location.pathname : id);
    } catch (_) {
      /* documentos sin URL propia (srcdoc, file://) no admiten replaceState */
    }
  });

  function moveIndicator() {
    if (!indicator) return;
    const a = navLinks.find((l) => l.classList.contains('is-active'));
    if (!a) return indicator.classList.remove('is-on');
    indicator.style.setProperty('--x', `${a.offsetLeft}px`);
    indicator.style.setProperty('--w', a.offsetWidth);
    indicator.classList.add('is-on');
  }

  function updateSpec(vh, still) {
    const n = specSteps.length;
    if (!n) return;
    const tops = specSteps.map((s) => s.getBoundingClientRect().top);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && Math.abs(tops[j + 1] - tops[i]) < 4) j += 1;
      const count = j - i + 1;
      const mp = still ? 1 : clamp((vh * 0.88 - tops[i]) / (vh * (count > 1 ? 0.5 : 0.3)), 0, 1);
      for (let k = i; k <= j; k += 1) {
        const p = clamp(mp * count - (k - i), 0, 1);
        specSteps[k].style.setProperty('--p', p.toFixed(3));
        specSteps[k].classList.toggle('is-on', p > 0.3);
      }
      i = j + 1;
    }
  }

  function onScroll() {
    const y = window.scrollY;
    const vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    // Sin animación por scroll si el usuario la reduce o si el documento no puede desplazarse
    // (p. ej. incrustado en un marco que crece hasta la altura del contenido): todo visible.
    const still = reduce || max <= 4;
    nav.classList.toggle('is-stuck', y > 16);
    if (progress) progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    if (stage && !reduce) stage.style.setProperty('--sp', clamp(y / 700, 0, 1).toFixed(3));

    // sección activa
    const probe = vh * 0.4;
    let cur = null;
    spySections.forEach((s) => {
      if (s.getBoundingClientRect().top <= probe) cur = s;
    });
    // data-spy="none": la sección no marca ningún enlace; data-spy="#otra": marca el de otra sección
    const spy = cur ? cur.dataset.spy || '' : 'none';
    const href = spy === 'none' ? '' : spy.charAt(0) === '#' ? spy : `#${cur.id}`;
    if (href !== activeHref) {
      activeHref = href;
      navLinks.forEach((a) => {
        const on = a.getAttribute('href') === href;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      moveIndicator();
    }

    // texto que se ilumina al avanzar
    scrubs.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      const from = vh * 0.88;
      const to = vh * 0.36;
      const p = still ? 1 : clamp((from - r.top) / (from - to), 0, 1);
      const on = Math.round(p * s.words.length);
      if (on === s.on) return;
      s.on = on;
      s.words.forEach((w, i) => w.classList.toggle('is-on', i < on));
    });

    updateSpec(vh, still);
  }

  let ticking = false;
  const requestScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      onScroll();
    });
  };
  addEventListener('scroll', requestScroll, { passive: true });
  addEventListener('resize', () => {
    fitStage();
    moveIndicator();
    placePill();
    requestScroll();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      moveIndicator();
      placePill();
    });
  }

  /* ── 6. Menú móvil ───────────────────────────────────────── */
  const burger = $('.nav__burger');
  const menu = $('#menu');
  function closeMenu() {
    if (!document.body.classList.contains('menu-open')) return;
    document.body.classList.remove('menu-open');
    document.documentElement.style.overflow = '';
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menú');
    menu.setAttribute('aria-hidden', 'true');
  }
  burger.addEventListener('click', () => {
    if (document.body.classList.contains('menu-open')) return closeMenu();
    document.body.classList.add('menu-open');
    document.documentElement.style.overflow = 'hidden';
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Cerrar menú');
    menu.setAttribute('aria-hidden', 'false');
  });
  addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());
  matchMedia('(min-width: 1181px)').addEventListener('change', closeMenu);

  /* ── 7. Efectos de puntero ───────────────────────────────── */
  if (fine && !reduce) {
    // foco de luz en tarjetas
    $$('[data-spot]').forEach((node) => {
      node.addEventListener('pointermove', (e) => {
        const r = node.getBoundingClientRect();
        node.style.setProperty('--mx', `${e.clientX - r.left}px`);
        node.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });

    // botones magnéticos
    $$('[data-magnetic]').forEach((node) => {
      node.addEventListener('pointermove', (e) => {
        const r = node.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        node.style.transform = `translate(${(dx * 0.2).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`;
      });
      node.addEventListener('pointerleave', () => (node.style.transform = ''));
    });

    // paralaje de la composición del hero
    const hero = $('.hero');
    if (hero && stage) {
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      const loop = () => {
        cx = lerp(cx, tx, 0.06);
        cy = lerp(cy, ty, 0.06);
        stage.style.setProperty('--px', cx.toFixed(4));
        stage.style.setProperty('--py', cy.toFixed(4));
        raf = Math.abs(cx - tx) + Math.abs(cy - ty) > 0.002 ? requestAnimationFrame(loop) : 0;
      };
      const kick = () => {
        if (!raf) raf = requestAnimationFrame(loop);
      };
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * -2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * -2;
        kick();
      });
      hero.addEventListener('pointerleave', () => {
        tx = 0;
        ty = 0;
        kick();
      });
    }
  }

  /* ── 8. Calculadora con pestañas ─────────────────────────── */
  const CALC = {
    presupuestos: {
      week: false,
      nLabel: 'Presupuestos al mes', n: [5, 300, 5, 60],
      mLabel: 'Minutos por presupuesto', m: [5, 180, 5, 45],
      how: 'Con un programa de presupuestos, eliges producto, medidas y extras, y el precio sale solo. Tú solo revisas y envías.',
    },
    pedidos: {
      week: true,
      nLabel: 'Pedidos a la semana', n: [5, 600, 5, 120],
      mLabel: 'Minutos por pedido', m: [1, 30, 1, 7],
      how: 'Con un programa de pedidos, los que llegan por correo o WhatsApp se leen solos y entran en tu programa. Tú solo miras los dudosos.',
    },
    partes: {
      week: true,
      nLabel: 'Partes a la semana', n: [5, 400, 5, 80],
      mLabel: 'Minutos de oficina por parte', m: [1, 45, 1, 10],
      how: 'Con una app de partes, el técnico lo cierra en el móvil con fotos y firma, y llega a la oficina listo para facturar.',
    },
    documentos: {
      week: true,
      nLabel: 'Documentos a la semana', n: [5, 600, 5, 150],
      mLabel: 'Minutos por documento', m: [1, 30, 1, 5],
      how: 'Con un gestor de documentos, el programa pide lo que falta, lo recibe y lo deja ordenado en su expediente.',
    },
    informes: {
      week: false,
      nLabel: 'Informes al mes', n: [1, 120, 1, 20],
      mLabel: 'Tiempo por informe', m: [15, 480, 15, 120],
      how: 'Con un generador de informes, el borrador sale con tus datos y tu plantilla. Tú repasas, corriges y firmas.',
    },
    otra: {
      week: true,
      nLabel: 'Veces a la semana', n: [5, 600, 5, 100],
      mLabel: 'Minutos cada vez', m: [1, 60, 1, 6],
      how: 'Piensa en cualquier tarea que se repite cada día: copiar, comprobar, reclamar, avisar. Casi siempre se puede aligerar.',
    },
  };
  const calcTabs = $$('.tabs__btn[data-calc]');
  const calcTabsEl = $('.tabs');
  const c = {
    n: $('#i-n'), m: $('#i-m'), cost: $('#i-cost'), auto: $('#i-auto'),
    lN: $('#l-n'), lM: $('#l-m'), how: $('#c-how'),
    oN: $('#o-n'), oM: $('#o-m'), oCost: $('#o-cost'), oAuto: $('#o-auto'),
    rec: $('#r-rec'), year: $('#r-year'), days: $('#r-days'),
    vNow: $('#v-now'), vNew: $('#v-new'), bNew: $('#b-new'), live: $('#calc-live'),
    key: 'presupuestos', shown: { now: 0, rec: 0, year: 0 }, raf: 0, liveTimer: 0,
  };
  const WEEKS_PER_MONTH = 52 / 12;
  const fmtMin = (m) => {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  };

  function placePill() {
    if (!calcTabsEl) return;
    const pill = $('.tabs__pill', calcTabsEl);
    const active = $('.tabs__btn.is-active', calcTabsEl);
    if (!pill || !active) return;
    pill.style.setProperty('--x', `${active.offsetLeft}px`);
    pill.style.setProperty('--w', `${active.offsetWidth}px`);
  }

  function paintCalc(now, rec, year) {
    const nowR = Math.round(now);
    const recR = Math.round(rec);
    c.rec.textContent = nf0.format(recR);
    c.vNow.textContent = `${nf0.format(nowR)} h`;
    c.vNew.textContent = `${nf0.format(Math.max(nowR - recR, 0))} h`;
    c.year.textContent = `${nf0.format(Math.round(year))} €`;
    c.days.textContent = `${nf1.format(rec / 8)} días de trabajo al mes`;
  }

  function updateCalc(animate) {
    const cfg = CALC[c.key];
    const n = +c.n.value, m = +c.m.value, cost = +c.cost.value, auto = +c.auto.value;
    [c.n, c.m, c.cost, c.auto].forEach((r) =>
      r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`)
    );
    c.oN.textContent = nf0.format(n);
    c.oM.textContent = fmtMin(m);
    c.oCost.textContent = `${cost} €`;
    c.oAuto.textContent = `${auto} %`;
    const now = ((n * m) / 60) * (cfg.week ? WEEKS_PER_MONTH : 1);
    const rec = (now * auto) / 100;
    const year = rec * 12 * cost;
    c.bNew.style.setProperty('--w', `${clamp(100 - auto, 4, 100)}%`);
    cancelAnimationFrame(c.raf);
    // lectores de pantalla: un único aviso con el resultado final, no uno por fotograma de la animación
    clearTimeout(c.liveTimer);
    if (animate && c.live) {
      c.liveTimer = setTimeout(() => {
        c.live.textContent = `Podríais recuperar ${nf0.format(Math.round(rec))} horas al mes. Valor de ese tiempo al año: ${nf0.format(Math.round(year))} euros.`;
      }, 700);
    }
    if (!animate || reduce) {
      c.shown = { now, rec, year };
      return paintCalc(now, rec, year);
    }
    const from = { ...c.shown };
    const t0 = performance.now();
    const tick = (t) => {
      const k = easeOut(clamp((t - t0) / 480, 0, 1));
      c.shown = { now: lerp(from.now, now, k), rec: lerp(from.rec, rec, k), year: lerp(from.year, year, k) };
      paintCalc(c.shown.now, c.shown.rec, c.shown.year);
      if (k < 1) c.raf = requestAnimationFrame(tick);
    };
    c.raf = requestAnimationFrame(tick);
  }

  function selectCalc(key, animate) {
    const cfg = CALC[key];
    if (!cfg) return;
    c.key = key;
    calcTabs.forEach((t) => {
      const on = t.dataset.calc === key;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    c.lN.textContent = cfg.nLabel;
    c.lM.textContent = cfg.mLabel;
    c.how.textContent = cfg.how;
    [[c.n, cfg.n], [c.m, cfg.m]].forEach(([input, [min, max, step, val]]) => {
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = val;
    });
    placePill();
    updateCalc(animate);
  }

  if (c.n) {
    calcTabs.forEach((t, i) => {
      t.addEventListener('click', () => {
        calcTabsEl.classList.add('is-live');
        selectCalc(t.dataset.calc, true);
        t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      });
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = calcTabs[(i + (e.key === 'ArrowRight' ? 1 : calcTabs.length - 1)) % calcTabs.length];
        calcTabsEl.classList.add('is-live');
        selectCalc(next.dataset.calc, true);
        next.focus();
      });
    });
    [c.n, c.m, c.cost, c.auto].forEach((r) => r.addEventListener('input', () => updateCalc(true)));
    selectCalc('presupuestos', false);
  }

  /* ── 9. Antes / Después ──────────────────────────────────── */
  const ba = $('#ba');
  if (ba) {
    const handle = $('.ba__handle', ba);
    let touched = false, dragging = false, tween = 0;
    const set = (pct) => {
      const v = clamp(pct, 0, 100);
      ba.style.setProperty('--pos', `${v}%`);
      handle.setAttribute('aria-valuenow', Math.round(v));
      return v;
    };
    const fromEvent = (e) => {
      const r = ba.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * 100;
    };
    ba.addEventListener('pointerdown', (e) => {
      touched = dragging = true;
      cancelAnimationFrame(tween);
      ba.setPointerCapture(e.pointerId);
      set(fromEvent(e));
    });
    ba.addEventListener('pointermove', (e) => dragging && set(fromEvent(e)));
    ['pointerup', 'pointercancel'].forEach((ev) => ba.addEventListener(ev, () => (dragging = false)));
    handle.addEventListener('keydown', (e) => {
      const now = parseFloat(ba.style.getPropertyValue('--pos')) || 50;
      const step = e.shiftKey ? 10 : 4;
      if (e.key === 'ArrowLeft') set(now - step);
      else if (e.key === 'ArrowRight') set(now + step);
      else if (e.key === 'Home') set(0);
      else if (e.key === 'End') set(100);
      else return;
      touched = true;
      cancelAnimationFrame(tween);
      e.preventDefault();
    });

    // pista inicial: se mueve sola una vez para enseñar que se arrastra
    if (!reduce) {
      const keys = [50, 76, 24, 50];
      const hintIO = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          hintIO.disconnect();
          const t0 = performance.now() + 500;
          const seg = 950;
          const tick = (now) => {
            if (touched) return;
            const dt = now - t0;
            if (dt < 0) return (tween = requestAnimationFrame(tick));
            const i = Math.min(Math.floor(dt / seg), keys.length - 2);
            const t = clamp((dt - i * seg) / seg, 0, 1);
            set(lerp(keys[i], keys[i + 1], easeInOut(t)));
            if (dt < seg * (keys.length - 1)) tween = requestAnimationFrame(tick);
          };
          tween = requestAnimationFrame(tick);
        },
        { threshold: 0.5 }
      );
      hintIO.observe(ba);
    }
  }

  /* ── 10. Casos de aplicación: explorador por sector ──────── */
  const CASOS = window.YNSPEC_CASOS || {};
  const chips = $$('.chip[data-sector]');
  const xp = $('#xp');
  const k = {
    sector: $('#k-sector'), pain: $('#k-pain'), name: $('#k-name'), desc: $('#k-desc'),
    flow: $('#k-flow'), app: $('#k-app'), screen: $('#k-screen'), kpis: $('#k-kpis'), rows: $('#k-rows'),
    page: $('#k-page'), pageT: $('#k-page-t'),
  };
  let sectorKey = 'distribuidores';
  let flowTimer = 0, flowIdx = 0, swapTimer = 0, xpVisible = false;

  function renderSector(key) {
    const d = CASOS[key];
    if (!d) return;
    k.sector.textContent = d.sector;
    k.pain.textContent = d.pain;
    k.name.textContent = d.name;
    k.desc.textContent = d.desc;
    k.app.textContent = d.app || d.name;
    k.screen.textContent = d.screen;
    // enlace a la página propia del sector, si la tiene
    if (k.page) {
      k.page.hidden = !d.page;
      if (d.page) {
        k.page.href = d.page;
        if (k.pageT) k.pageT.textContent = `Software a medida para ${d.sector.toLowerCase()}`;
      }
    }
    k.flow.replaceChildren(
      ...d.flow.map((step, i) => {
        const li = el('li');
        li.append(el('span', '', String(i + 1)), step);
        return li;
      })
    );
    k.kpis.replaceChildren(
      ...d.kpis.map(([label, value, tone]) => {
        const box = el('div', tone === 'warn' ? 'kpi is-warn' : 'kpi');
        box.append(el('small', '', label), el('strong', '', value));
        return box;
      })
    );
    k.rows.replaceChildren(
      ...d.rows.map(([main, meta, state, tone]) => {
        const li = el('li');
        li.append(el('span', '', main), el('small', '', meta || ''));
        if (state) li.append(el('em', tone ? `pill pill--${tone}` : 'pill', state));
        else li.append(el('em'));
        return li;
      })
    );
  }

  function paintFlow() {
    $$('li', k.flow).forEach((li, i) => {
      li.classList.toggle('is-on', i === flowIdx);
      li.classList.toggle('is-done', i < flowIdx);
    });
  }
  function startFlow() {
    clearInterval(flowTimer);
    flowIdx = 0;
    if (!k.flow) return;
    if (reduce) {
      $$('li', k.flow).forEach((li) => li.classList.add('is-done'));
      return;
    }
    paintFlow();
    if (!xpVisible) return;
    flowTimer = setInterval(() => {
      flowIdx = (flowIdx + 1) % 4;
      paintFlow();
    }, 1700);
  }

  function setSector(key, opts = {}) {
    if (!CASOS[key] || !xp) return;
    chips.forEach((ch) => {
      const on = ch.dataset.sector === key;
      ch.classList.toggle('is-active', on);
      ch.setAttribute('aria-pressed', String(on));
      if (on && opts.reveal) {
        const row = ch.parentElement;
        if (row.scrollWidth > row.clientWidth) {
          const off = ch.getBoundingClientRect().left - row.getBoundingClientRect().left;
          row.scrollTo({ left: row.scrollLeft + off - (row.clientWidth - ch.offsetWidth) / 2 });
        }
      }
    });
    if (key === sectorKey) return;
    sectorKey = key;
    clearTimeout(swapTimer);
    if (reduce) {
      renderSector(key);
      return startFlow();
    }
    xp.classList.add('is-swapping');
    swapTimer = setTimeout(() => {
      renderSector(key);
      xp.classList.remove('is-swapping');
      startFlow();
    }, 250);
  }

  if (xp && k.flow) {
    chips.forEach((ch) => ch.addEventListener('click', () => setSector(ch.dataset.sector)));
    new IntersectionObserver(
      (entries) => {
        xpVisible = entries[0].isIntersecting;
        if (xpVisible) startFlow();
        else clearInterval(flowTimer);
      },
      { threshold: 0.2 }
    ).observe(xp);
    startFlow();
  }

  /* ── 11. Copiar el correo ────────────────────────────────── */
  $$('[data-copy]').forEach((a) => {
    const live = $('#copy-live');
    let timer = 0;
    a.addEventListener('click', async (e) => {
      if (!navigator.clipboard || !navigator.clipboard.writeText) return; // sin API: se comporta como mailto
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(a.dataset.copy);
        a.classList.add('is-done');
        if (live) live.textContent = 'Dirección de correo copiada al portapapeles.';
        clearTimeout(timer);
        timer = setTimeout(() => {
          a.classList.remove('is-done');
          if (live) live.textContent = '';
        }, 2400);
      } catch (_) {
        location.href = a.href; // permiso denegado: se abre el programa de correo
      }
    });
  });

  /* ── 12. FAQ ─────────────────────────────────────────────── */
  const faqs = $$('.faq__q');
  faqs.forEach((q, i) => {
    const panel = q.nextElementSibling;
    q.id = `faq-q-${i}`;
    panel.id = `faq-a-${i}`;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', q.id);
    q.setAttribute('aria-controls', panel.id);
    q.addEventListener('click', () => {
      const open = q.getAttribute('aria-expanded') === 'true';
      faqs.forEach((other) => other.setAttribute('aria-expanded', 'false'));
      q.setAttribute('aria-expanded', String(!open));
    });
  });

  onScroll();
})();
