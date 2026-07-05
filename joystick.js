/* MediaHub Arcade — Virtual joystick for touch devices */

export class Joystick {
  constructor(root, stick) {
    this.root = root;
    this.stick = stick;
    this.active = false;
    this.dx = 0;
    this.dy = 0;
    this.enabled = false;
    this._pointerId = null;
    this._radius = 44;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);

    root.addEventListener('touchstart', this._onDown, { passive: false });
    root.addEventListener('touchmove', this._onMove, { passive: false });
    root.addEventListener('touchend', this._onUp);
    root.addEventListener('touchcancel', this._onUp);
    // Pointer fallback for hybrid devices
    root.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
  }

  setEnabled(on) {
    this.enabled = on;
    this.root.classList.toggle('show', on);
    if (!on) this._reset();
  }

  _rect() { return this.root.getBoundingClientRect(); }

  _pt(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  _onDown(e) {
    if (!this.enabled) return;
    if (e.cancelable) e.preventDefault();
    this.active = true;
    this.root.classList.add('active');
    this._move(e);
  }
  _onMove(e) {
    if (!this.active || !this.enabled) return;
    if (e.cancelable && e.type === 'touchmove') e.preventDefault();
    this._move(e);
  }
  _onUp() {
    if (!this.active) return;
    this._reset();
  }
  _reset() {
    this.active = false;
    this.dx = 0; this.dy = 0;
    this.root.classList.remove('active');
    this.stick.style.transform = 'translate(-50%, -50%)';
  }

  _move(e) {
    const r = this._rect();
    const p = this._pt(e);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = p.x - cx;
    let dy = p.y - cy;
    const max = r.width / 2 - 8;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    this.dx = dx / max; // -1..1
    this.dy = dy / max;
    this.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}
