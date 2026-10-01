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
  const pending = { x: -100, y: -100, visible: true, caption: '' }

  function build() {
    if (layer || !document.documentElement) return
    layer = document.createElement('div')
    layer.setAttribute('data-trailer-overlay', '')
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;'

    const style = document.createElement('style')
    style.textContent = `
      [data-trailer-overlay] .cursor {
        position: absolute; left: 0; top: 0; width: 26px; height: 26px;
        transform: translate(-100px, -100px); will-change: transform;
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
      [data-trailer-overlay] .caption {
        position: absolute; left: 132px; bottom: 40px; transform: translateY(14px);
        padding: 12px 26px; border-radius: 999px;
        font: 600 22px/1.2 system-ui, 'Segoe UI', sans-serif; letter-spacing: .01em; color: #f4f4f8;
        background: rgba(29,29,35,.82); border: 1px solid rgba(139,140,232,.35);
        box-shadow: 0 12px 40px rgba(0,0,0,.45); backdrop-filter: blur(14px);
        opacity: 0; transition: opacity 420ms ease, transform 520ms cubic-bezier(.2,.7,.2,1);
        white-space: nowrap;
      }
      [data-trailer-overlay] .caption.on { opacity: 1; transform: none; }
      [data-trailer-overlay] .caption::before {
        content: ''; display: inline-block; width: 9px; height: 9px; margin-right: 12px; border-radius: 50%;
        background: ${ACCENT}; vertical-align: 2px; box-shadow: 0 0 12px ${ACCENT};
      }
    `
    layer.append(style)

    cursor = document.createElement('div')
    cursor.className = 'cursor'
    cursor.innerHTML =
      '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13 28 L17 26.3 L13.2 17 L21 17 Z" ' +
      'fill="#fff" stroke="#17171c" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    layer.append(cursor)

    caption = document.createElement('div')
    caption.className = 'caption'
    layer.append(caption)

    document.documentElement.append(layer)
    apply()
  }

  function apply() {
    if (!layer) return
    cursor.style.transform = `translate(${pending.x}px, ${pending.y}px)`
    cursor.style.display = pending.visible ? '' : 'none'
    if (pending.caption) caption.textContent = pending.caption
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

  window.__trailer = {
    step,
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
    caption(text) {
      pending.caption = text
      build()
      apply()
    },
  }

  if (document.documentElement) build()
  else document.addEventListener('DOMContentLoaded', build, { once: true })
}
