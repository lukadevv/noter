/**
 * Runs inside the page (as an init script, so it survives reloads) and adds
 * what the recorder needs on top of the app:
 *  - `step(ms)`, which moves every Web Animation forward by exactly `ms`;
 *  - a cursor, since a headless browser draws none;
 *  - a caption pill for the lower third.
 *
 * Everything lives in one fixed layer on <html>, outside the app's own tree,
 * with pointer events off so it never intercepts a click.
 *
 * Must stay self-contained: Playwright serialises this function on its own.
 */
export function overlayScript() {
  if (window.__trailer) return

  const ACCENT = '#8b8ce8'
  let layer = null
  let cursor = null
  let caption = null
  let hud = null
  let under = null
  const pending = { x: -100, y: -100, visible: true, caption: '', icon: '', color: ACCENT, cursorScale: 1 }

  function build() {
    if (layer || !document.documentElement) return
    layer = document.createElement('div')
    layer.setAttribute('data-trailer-overlay', '')
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;'

    const style = document.createElement('style')
    style.textContent = `
      [data-trailer-overlay] .cursor {
        position: absolute; transform-origin: 0 0; left: 0; top: 0; width: 26px; height: 26px;
        transform: translate(-100px, -100px);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.45));
      }
      [data-trailer-overlay] .cursor svg { position: absolute; left: -3px; top: -2px; transition: transform 120ms ease-out; }
      [data-trailer-overlay] .cursor.pressed svg { transform: scale(.86); }
      [data-trailer-overlay] .ripple {
        position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
        border: 2px solid ${ACCENT}; background: color-mix(in srgb, ${ACCENT} 22%, transparent);
        animation: trailer-ripple 520ms cubic-bezier(.2,.7,.3,1) forwards;
      }
      @keyframes trailer-ripple { from { transform: scale(.3); opacity: .9 } to { transform: scale(1.35); opacity: 0 } }
      [data-trailer-overlay] .focus {
        position: absolute; border-radius: 16px; opacity: 0;
        border: 2px solid ${ACCENT};
        background: color-mix(in srgb, ${ACCENT} 7%, transparent);
        box-shadow: 0 0 0 1px rgba(255,255,255,.06), 0 0 38px color-mix(in srgb, ${ACCENT} 55%, transparent);
        animation: trailer-focus var(--dur, 1600ms) cubic-bezier(.2,.7,.2,1) forwards;
      }
      @keyframes trailer-focus {
        0% { opacity: 0; transform: scale(1.07); }
        20% { opacity: 1; transform: scale(1); }
        78% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.015); }
      }
      [data-trailer-overlay] .pulse {
        position: absolute; border-radius: 50%; opacity: 0;
        border: 4px solid var(--color, ${ACCENT});
        box-shadow: 0 0 40px var(--color, ${ACCENT}), inset 0 0 40px color-mix(in srgb, var(--color, ${ACCENT}) 35%, transparent);
        animation: trailer-pulse var(--dur, 1000ms) cubic-bezier(.15,.7,.25,1) forwards;
      }
      @keyframes trailer-pulse {
        0% { opacity: .9; transform: scale(.25); }
        100% { opacity: 0; transform: scale(1); }
      }
      [data-trailer-overlay] .bit {
        position: absolute; opacity: 0; will-change: transform;
        animation: trailer-bit var(--dur, 1400ms) cubic-bezier(.12,.6,.3,1) forwards;
      }
      @keyframes trailer-bit {
        0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
        55% { opacity: 1; transform: translate(var(--dx), var(--dy)) rotate(calc(var(--rot) * .6)); }
        100% { opacity: 0; transform: translate(calc(var(--dx) * 1.12), calc(var(--dy) + var(--fall))) rotate(var(--rot)); }
      }
      [data-trailer-overlay] .caption {
        position: absolute; inset-inline-start: 132px; bottom: 40px;
        display: flex; align-items: center; gap: 14px;
        padding: 9px 26px 9px 10px; border-radius: 999px;
        font: 650 22px/1.2 system-ui, 'Segoe UI', sans-serif; letter-spacing: .01em; color: #f4f4f8;
        background: rgba(24,24,30,.86); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
        box-shadow: 0 14px 44px rgba(0,0,0,.5), 0 0 34px color-mix(in srgb, var(--c) 22%, transparent);
        backdrop-filter: blur(14px); white-space: nowrap; opacity: 0;
      }
      [data-trailer-overlay] .caption.on { animation: trailer-cap-in 620ms cubic-bezier(.16,1,.3,1) forwards; }
      @keyframes trailer-cap-in {
        from { opacity: 0; transform: translateY(26px); }
        to { opacity: 1; transform: none; }
      }
      /* The badge: the section's colour and icon, with rings that keep leaving it. */
      [data-trailer-overlay] .badge {
        position: relative; display: grid; place-items: center; flex: none;
        width: 38px; height: 38px; border-radius: 50%;
        background: linear-gradient(150deg, color-mix(in srgb, var(--c) 100%, white 18%), var(--c));
        box-shadow: 0 6px 20px color-mix(in srgb, var(--c) 55%, transparent);
      }
      [data-trailer-overlay] .badge svg { width: 21px; height: 21px; color: #fff; }
      [data-trailer-overlay] .badge::before, [data-trailer-overlay] .badge::after {
        content: ''; position: absolute; inset: 0; border-radius: 50%;
        border: 2px solid var(--c); opacity: 0;
      }
      [data-trailer-overlay] .caption.on .badge::before { animation: trailer-ring 2.4s cubic-bezier(.2,.6,.3,1) .5s infinite; }
      [data-trailer-overlay] .caption.on .badge::after { animation: trailer-ring 2.4s cubic-bezier(.2,.6,.3,1) 1.7s infinite; }
      @keyframes trailer-ring {
        0% { opacity: .75; transform: scale(1); }
        100% { opacity: 0; transform: scale(2.2); }
      }
      /* The words are uncovered left to right (right to left in Arabic), not scaled or blurred. */
      [data-trailer-overlay] .label { display: block; clip-path: inset(-6px 100% -6px 0); }
      html[dir=rtl] [data-trailer-overlay] .label { clip-path: inset(-6px 0 -6px 100%); }
      [data-trailer-overlay] .caption.on .label { animation: trailer-wipe 760ms cubic-bezier(.3,.7,.2,1) 220ms forwards; }
      @keyframes trailer-wipe { to { clip-path: inset(-6px -6px -6px -6px); } }
      /* One sheen sweeps across the pill once the words are in. */
      [data-trailer-overlay] .sheen {
        position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none;
      }
      [data-trailer-overlay] .sheen::before {
        content: ''; position: absolute; top: 0; bottom: 0; width: 90px; left: -140px;
        background: linear-gradient(100deg, transparent, color-mix(in srgb, var(--c) 40%, white 30%), transparent);
        opacity: .55; transform: skewX(-20deg);
      }
      [data-trailer-overlay] .caption.on .sheen::before { animation: trailer-sheen 1100ms ease-in-out 700ms forwards; }
      @keyframes trailer-sheen { from { left: -140px; } to { left: 115%; } }
      /* A thin line under the pill that fills with the section's colour. */
      [data-trailer-overlay] .bar {
        position: absolute; left: 22px; right: 22px; bottom: -1px; height: 3px; border-radius: 3px;
        background: linear-gradient(90deg, var(--c), color-mix(in srgb, var(--c) 30%, white)); opacity: .9;
        transform: scaleX(0); transform-origin: left;
      }
      html[dir=rtl] [data-trailer-overlay] .bar { transform-origin: right; }
      [data-trailer-overlay] .caption.on .bar { animation: trailer-bar 900ms cubic-bezier(.3,.7,.2,1) 400ms forwards; }
      @keyframes trailer-bar { to { transform: scaleX(1); } }
    `
    layer.append(style)

    cursor = document.createElement('div')
    cursor.className = 'cursor'
    cursor.innerHTML =
      '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13 28 L17 26.3 L13.2 17 L21 17 Z" ' +
      'fill="#fff" stroke="#17171c" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    layer.append(cursor)

    hud = document.createElement('div')
    hud.style.cssText = 'position:absolute;inset:0;transform-origin:0 0;'
    caption = document.createElement('div')
    caption.className = 'caption'
    caption.innerHTML =
      '<span class="badge"></span><span class="label"></span><span class="sheen"></span><span class="bar"></span>'
    hud.append(caption)
    layer.append(hud)

    // Rings that must sit behind the app's own dialogs (z-index 90) go here.
    under = document.createElement('div')
    // Same attribute as the main layer, which is what the stylesheet is scoped to.
    under.setAttribute('data-trailer-overlay', '')
    under.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:89;'
    document.documentElement.append(under)

    document.documentElement.append(layer)
    apply()
  }

  function apply() {
    if (!layer) return
    cursor.style.transform = `translate(${pending.x}px, ${pending.y}px) scale(${pending.cursorScale})`
    cursor.style.display = pending.visible ? '' : 'none'
    if (pending.caption) {
      caption.style.setProperty('--c', pending.color)
      caption.querySelector('.label').textContent = pending.caption
      caption.querySelector('.badge').innerHTML = pending.icon || '<i></i>'
    }
    caption.classList.toggle('on', Boolean(pending.caption))
  }

  // Animations created while the timeline is frozen sit at 0; this is the
  // only thing that moves them, by the same amount the fake clock moved.
  function step(ms) {
    build()
    for (const animation of document.getAnimations()) {
      if (animation.playState === 'paused' || animation.playState === 'finished') continue
      animation.currentTime = (Number(animation.currentTime) || 0) + ms * (animation.playbackRate || 1)
    }
  }

  // The camera crops the page to a rectangle and scales it up. The caption
  // sits in a layer fitted to that rectangle and scaled down by as much, so on
  // screen it never moves or grows. The cursor shrinks partway, so a close-up
  // shows a bigger pointer without a comically large one.
  function frameTo(x, y, zoom) {
    build()
    hud.style.transform = zoom === 1 ? '' : `translate(${x}px, ${y}px) scale(${1 / zoom})`
    pending.cursorScale = 1 / Math.sqrt(zoom)
    apply()
  }

  window.__trailer = {
    step,
    frameTo,
    cursor(x, y) {
      pending.x = x
      pending.y = y
      build()
      apply()
    },
    cursorVisible(visible) {
      pending.visible = visible
      build()
      apply()
    },
    press() {
      build()
      const ripple = document.createElement('div')
      ripple.className = 'ripple'
      ripple.style.left = `${pending.x}px`
      ripple.style.top = `${pending.y}px`
      ripple.addEventListener('animationend', () => ripple.remove())
      layer.append(ripple)
      cursor.classList.add('pressed')
      setTimeout(() => cursor.classList.remove('pressed'), 140)
    },
    /**
     * Puts the app's alarm card on a chosen point instead of the screen's
     * middle, and drops its dimming backdrop below the ring layer, so rings
     * can sit between the two: lit, but behind the card. It only takes effect
     * when the card appears. The individual `translate` property centres the
     * card without touching the `transform` its own entrance animation uses.
     */
    pinAlarm(x, y) {
      let style = document.querySelector('style[data-trailer-pin]')
      if (!style) {
        style = document.createElement('style')
        style.setAttribute('data-trailer-pin', '')
        document.head.append(style)
      }
      style.textContent =
        `[data-testid="ringing"] { inset: auto !important; left: ${x}px !important; top: ${y}px !important;` +
        ' margin: 0 !important; translate: -50% -50% !important; }' +
        ' .backdrop { z-index: 88 !important; }'
    },
    /** A glowing frame that draws itself around a box, holds, and fades. */
    focus(x, y, w, h, ms) {
      build()
      const frame = document.createElement('div')
      frame.className = 'focus'
      frame.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;--dur:${ms}ms`
      frame.addEventListener('animationend', () => frame.remove())
      layer.append(frame)
    },
    /** A ring that expands from a point, e.g. on every tick of a countdown. */
    pulse(x, y, size, color, ms, behind = false) {
      build()
      const ring = document.createElement('div')
      ring.className = 'pulse'
      ring.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;--dur:${ms}ms;--color:${color}`
      ring.addEventListener('animationend', () => ring.remove())
      ;(behind ? under : layer).append(ring)
    },
    /** Confetti: the recorder supplies every bit's direction, so runs are identical. */
    burst(x, y, bits) {
      build()
      for (const bit of bits) {
        const piece = document.createElement('div')
        piece.className = 'bit'
        piece.style.cssText =
          `left:${x}px;top:${y}px;width:${bit.w}px;height:${bit.h}px;background:${bit.color};` +
          `border-radius:${bit.round ? '50%' : '2px'};--dx:${bit.dx}px;--dy:${bit.dy}px;` +
          `--fall:${bit.fall}px;--rot:${bit.rot}deg;--dur:${bit.ms}ms;animation-delay:${bit.delay}ms`
        piece.addEventListener('animationend', () => piece.remove())
        layer.append(piece)
      }
    },
    caption(text, style = {}) {
      pending.caption = text
      pending.color = style.color ?? ACCENT
      pending.icon = style.icon ?? ''
      build()
      apply()
    },
  }

  if (document.documentElement) build()
  else document.addEventListener('DOMContentLoaded', build, { once: true })
}
