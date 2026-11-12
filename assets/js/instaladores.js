/* ynspec — landing de instaladores: calculadora de pérdidas y demo animada.
   Vanilla, sin dependencias. Se carga después de main.js (que lleva nav, entradas, FAQ…). */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const fmt = (dec) =>
    new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' });
  const nf0 = fmt(0);
  const nf1 = fmt(1);
  const num = (v, d) => (v == null || v === '' ? d : parseFloat(v));
  const NBSP = ' ';

  /* ── 1. Calculadora: horas, lo que vale ese tiempo y lo que se va en presupuestos no aceptados ── */
  const ic = { n: $('#ic-n'), h: $('#ic-h'), rate: $('#ic-rate'), win: $('#ic-win'), cut: $('#ic-cut') };
  if (ic.n && ic.h && ic.rate && ic.win && ic.cut) {
    const io = { n: $('#io-n'), h: $('#io-h'), rate: $('#io-rate'), win: $('#io-win'), cut: $('#io-cut') };
    const o = {
      hours: $('#ic-hours'), days: $('#ic-days'), month: $('#ic-month'), year: $('#ic-year'),
      lostK: $('#ic-lost-k'), lost: $('#ic-lost'),
      recH: $('#ic-rec-h'), recE: $('#ic-rec-e'), recY: $('#ic-rec-y'), live: $('#ic-live'),
    };
    const HOURS_PER_DAY = 8;
    const MONTHS = 12;
    // entero si lo es (48), un decimal si no (45,5)
    const dec1 = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? nf0.format(Math.round(v)) : nf1.format(v));
    const eur = (v) => `${nf0.format(Math.round(v))}${NBSP}€`;
    let shown = null;
    let raf = 0;
    let liveTimer = 0;

    const paint = (v, done) => {
      o.hours.textContent = done ? dec1(v.hours) : nf0.format(Math.round(v.hours));
      o.month.textContent = `${eur(v.month)} al mes`;
      o.year.textContent = eur(v.year);
      o.lost.textContent = `${eur(v.lost)} al año`;
      o.recH.textContent = `${done ? dec1(v.recH) : nf0.format(Math.round(v.recH))}${NBSP}h`;
      o.recE.textContent = eur(v.recE);
      o.recY.textContent = `${eur(v.recE * MONTHS)} al año.`;
    };

    const update = (animate) => {
      const n = +ic.n.value;
      const h = +ic.h.value;
      const rate = +ic.rate.value;
      const win = +ic.win.value;
      const cut = +ic.cut.value;
      Object.values(ic).forEach((r) =>
        r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`)
      );
      io.n.textContent = nf0.format(n);
      io.h.textContent = `${dec1(h)}${NBSP}h`;
      io.rate.textContent = `${rate}${NBSP}€/h`;
      io.win.textContent = `${win} de 10`;
      io.cut.textContent = cut === 50 ? 'la mitad del trabajo' : `el ${cut}${NBSP}% del trabajo`;

      const hours = n * h;
      const month = hours * rate;
      const year = month * MONTHS;
      const lost = year * (1 - win / 10);
      const recH = (hours * cut) / 100;
      const target = { hours, month, year, lost, recH, recE: recH * rate };

      const days = hours / HOURS_PER_DAY;
      o.days.textContent =
        days < 1
          ? 'Menos de una jornada de 8 horas al mes.'
          : `${days === 1 ? 'Es' : 'Son'} ${dec1(days)} ${days === 1 ? 'jornada' : 'jornadas'} de 8 horas que no estás en obra.`;
      o.lostK.textContent =
        win >= 10
          ? 'En presupuestos que no te aceptan (ninguno)'
          : `En presupuestos que no te aceptan (${10 - win} de cada 10)`;

      // lectores de pantalla: un único aviso con el resultado final, no uno por fotograma
      clearTimeout(liveTimer);
      if (animate && o.live) {
        liveTimer = setTimeout(() => {
          o.live.textContent = `Dedicas ${dec1(hours)} horas al mes a presupuestar. Ese tiempo vale ${nf0.format(
            Math.round(year)
          )} euros al año, y ${nf0.format(Math.round(lost))} se van en presupuestos que no te aceptan.`;
        }, 700);
      }

      cancelAnimationFrame(raf);
      if (!animate || reduce || !shown) {
        shown = target;
        return paint(target, true);
      }
      const from = { ...shown };
      const t0 = performance.now();
      const tick = (now) => {
        const k = easeOut(clamp((now - t0) / 480, 0, 1));
        shown = {};
        Object.keys(target).forEach((key) => (shown[key] = lerp(from[key], target[key], k)));
        paint(shown, k >= 1);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    Object.values(ic).forEach((r) => r.addEventListener('input', () => update(true)));
    update(false);
  }

  /* ── 2. Demo: motor de escenas sin estado, guiado por el tiempo ──────────────────────────────
     Cada escena declara en el HTML qué pasa y cuándo (ms desde su inicio):
       data-at / data-off   aparece (clase .on) y, si se indica, vuelve a ocultarse
       data-add             con data-at: clase que se añade en vez de .on (no oculta el elemento)
       data-click + data-cls  el cursor llega, hace clic y el elemento recibe esa clase
       data-type            el texto se escribe letra a letra desde su data-at
       data-count           número que avanza de data-from al valor, desde data-cat, en data-dur
       data-var             variable CSS que avanza de data-from a data-to, desde data-vat
     El estado se recalcula entero a partir del tiempo: se puede saltar a cualquier instante.   */
  const root = $('#demo');
  const screen = $('#demo-screen');
  if (root && screen) {
    const app = $('.app', screen);
    const cur = $('#demo-cur');
    const chapters = $$('.ch', root);
    const buttons = chapters.map((ch) => $('button', ch));
    const steps = $$('.app__steps li', screen);
    const toggle = $('#demo-toggle');
    const toggleText = $('#demo-toggle-t');
    const cap = $('#demo-cap');
    const TYPE_MS = 42; // por carácter
    const TRAVEL_MS = 720; // viaje del cursor hasta el clic
    const DOWN_MS = 460; // lo que dura el gesto del clic
    const design = { w: 820, h: 540 };

    const scenes = $$('.scene', screen).map((el) => ({
      el,
      dur: num(el.dataset.dur, 6000),
      ats: $$('[data-at]', el).map((n) => ({
        n,
        at: num(n.dataset.at, 0),
        off: num(n.dataset.off, Infinity),
        cls: n.dataset.add || 'on',
      })),
      clicks: $$('[data-click]', el)
        .map((n) => ({ n, at: num(n.dataset.click, 0), cls: n.dataset.cls || 'is-hit' }))
        .sort((a, b) => a.at - b.at),
      // el texto se reparte en dos tramos (escrito + pendiente invisible) para que no baile el ancho
      types: $$('[data-type]', el).map((n) => {
        const full = n.textContent;
        const a = document.createElement('span');
        const b = document.createElement('span');
        a.className = 'ty-a';
        b.className = 'ty-b';
        n.textContent = '';
        n.append(a, b);
        return { n, a, b, full, at: num(n.dataset.at, 0), shown: -1 };
      }),
      counts: $$('[data-count]', el).map((n) => ({
        n,
        from: num(n.dataset.from, 0),
        to: num(n.dataset.count, 0),
        at: num(n.dataset.cat, 0),
        dur: num(n.dataset.dur, 900),
        nf: fmt(num(n.dataset.dec, 0)),
        suffix: (n.dataset.suffix || '').replace(/^ /, NBSP),
        last: null,
      })),
      vars: $$('[data-var]', el).map((n) => ({
        n,
        name: n.dataset.var,
        from: num(n.dataset.from, 0),
        to: num(n.dataset.to, 1),
        at: num(n.dataset.vat, 0),
        dur: num(n.dataset.dur, 900),
        last: null,
      })),
    }));

    let idx = 0;
    let t = 0;
    let playing = false;
    let userPaused = reduce; // con movimiento reducido no arranca sola
    let raf = 0;
    let last = 0;
    let scale = 1;

    function render(sc, time) {
      sc.ats.forEach((a) => a.n.classList.toggle(a.cls, time >= a.at && time < a.off));
      sc.clicks.forEach((c) => c.n.classList.toggle(c.cls, time >= c.at));
      sc.types.forEach((ty) => {
        const n = clamp(Math.floor((time - ty.at) / TYPE_MS), 0, ty.full.length);
        if (n === ty.shown) return;
        ty.shown = n;
        ty.a.textContent = ty.full.slice(0, n);
        ty.b.textContent = ty.full.slice(n);
        ty.n.classList.toggle('typing', n > 0 && n < ty.full.length);
      });
      sc.counts.forEach((c) => {
        const k = easeInOut(clamp((time - c.at) / c.dur, 0, 1));
        const text = c.nf.format(lerp(c.from, c.to, k)) + c.suffix;
        if (text === c.last) return;
        c.last = text;
        c.n.textContent = text;
      });
      sc.vars.forEach((v) => {
        const k = easeInOut(clamp((time - v.at) / v.dur, 0, 1));
        const val = lerp(v.from, v.to, k).toFixed(2);
        if (val === v.last) return;
        v.last = val;
        v.n.style.setProperty(v.name, val);
      });
    }

    // centro de un elemento en px del lienzo (sin escalar)
    function center(n) {
      const r = n.getBoundingClientRect();
      const a = app.getBoundingClientRect();
      return { x: (r.left + r.width / 2 - a.left) / scale, y: (r.top + r.height / 2 - a.top) / scale };
    }

    function placeCursor(sc, time) {
      if (!cur) return;
      const cl = sc.clicks;
      const ni = cl.findIndex((c) => c.at > time);
      const next = ni === -1 ? null : cl[ni];
      const prev = (ni === -1 ? cl[cl.length - 1] : cl[ni - 1]) || null;
      // entre clics se queda sobre el último elemento pulsado (y lo sigue si se mueve)
      let pos = prev ? center(prev.n) : { x: design.w * 0.7, y: design.h * 0.94 };
      let hidden = !prev;
      if (next && time >= next.at - TRAVEL_MS) {
        const to = center(next.n);
        const k = easeInOut(clamp((time - (next.at - TRAVEL_MS)) / (TRAVEL_MS - 110), 0, 1));
        pos = { x: lerp(pos.x, to.x, k), y: lerp(pos.y, to.y, k) };
        hidden = false;
      }
      if (!next && prev && time > prev.at + 1300) hidden = true;
      cur.classList.toggle('is-hidden', hidden);
      cur.classList.toggle('is-down', cl.some((c) => time >= c.at && time < c.at + DOWN_MS));
      if (hidden) return; // oculto, se desvanece donde estaba
      cur.style.setProperty('--cx', `${pos.x.toFixed(1)}px`);
      cur.style.setProperty('--cy', `${pos.y.toFixed(1)}px`);
    }

    function paint() {
      const sc = scenes[idx];
      render(sc, t);
      placeCursor(sc, t);
      chapters[idx].style.setProperty('--p', clamp(t / sc.dur, 0, 1).toFixed(3));
    }

    function show(i, time) {
      idx = (i + scenes.length) % scenes.length;
      t = time;
      scenes.forEach((s, k) => s.el.classList.toggle('is-current', k === idx));
      chapters.forEach((ch, k) => {
        ch.classList.toggle('is-active', k === idx);
        ch.classList.toggle('is-done', k < idx);
        if (k === idx) buttons[k].setAttribute('aria-current', 'step');
        else buttons[k].removeAttribute('aria-current');
      });
      steps.forEach((li, k) => {
        li.classList.toggle('is-on', k === idx);
        li.classList.toggle('is-done', k < idx);
      });
      if (cap && cap.children.length > 1) {
        cap.children[0].textContent = $('.ch__t', chapters[idx]).textContent;
        cap.children[1].textContent = $('.ch__d', chapters[idx]).textContent;
      }
      // el estado de partida se coloca sin transiciones: nada debe «desaparecer» a la vista
      root.classList.add('is-static');
      paint();
      void screen.offsetWidth;
      root.classList.remove('is-static');
    }

    function tick(now) {
      // dt acotado: tras una pestaña en segundo plano no se salta media demo de golpe
      t += Math.min(now - last, 100);
      last = now;
      if (t >= scenes[idx].dur) show(idx + 1, 0);
      else paint();
      raf = requestAnimationFrame(tick);
    }

    function sync() {
      if (!toggle) return;
      toggle.dataset.state = playing ? 'playing' : 'paused';
      if (toggleText) toggleText.textContent = playing ? 'Pausar' : 'Reproducir';
    }
    function play() {
      if (playing) return;
      playing = true;
      if (t >= scenes[idx].dur) show(idx, 0);
      last = performance.now();
      raf = requestAnimationFrame(tick);
      sync();
    }
    function pause() {
      playing = false;
      cancelAnimationFrame(raf);
      sync();
    }

    function fit() {
      const cs = getComputedStyle(screen);
      design.w = parseFloat(cs.getPropertyValue('--dw')) || 820;
      design.h = parseFloat(cs.getPropertyValue('--dh')) || 540;
      scale = screen.clientWidth / design.w || 1;
      screen.style.setProperty('--s', scale.toFixed(4));
      paint();
    }

    // en marcha se reinicia el paso elegido; en pausa se enseña ya terminado, para leerlo con calma
    buttons.forEach((b, k) => b.addEventListener('click', () => show(k, playing ? 0 : scenes[k].dur)));
    if (toggle) {
      toggle.addEventListener('click', () => {
        userPaused = playing;
        if (playing) pause();
        else play();
      });
    }

    fit();
    show(0, userPaused ? scenes[0].dur : 0);
    sync();
    addEventListener('resize', fit);
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(screen);

    // solo se reproduce mientras está a la vista
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            if (!userPaused) play();
          } else if (playing) {
            pause();
          }
        },
        { threshold: 0.3 }
      ).observe(screen);
    } else if (!userPaused) {
      play();
    }

    // gancho para las pruebas automatizadas: fija una escena en un instante exacto
    root.__player = {
      seek(i, time) {
        userPaused = true;
        pause();
        show(i, time == null ? scenes[i].dur : time);
      },
      resume() {
        userPaused = false;
        play();
      },
      get state() {
        return { idx, t, playing, scale, scenes: scenes.map((s) => s.dur) };
      },
    };
  }
})();
