import {StablePointerLockControls} from './look-controls.js';

export class TouchControls extends StablePointerLockControls {
  constructor(game) {
    super(game.camera, document.body);
    super.dispose();
    this.isTouch = true;
    this.root = document.getElementById('touch-controls');
    this.stick = this.root.querySelector('.touch-stick');
    const move = game.moveInput;

    this.bindPointer(this.stick, () => {}, event => {
      const rect = this.stick.getBoundingClientRect();
      const radius = rect.width / 2;
      const x = (event.clientX - rect.left - radius) / radius;
      const y = (event.clientY - rect.top - radius) / radius;
      const length = Math.max(1, Math.hypot(x,y));
      this.stick.style.setProperty('--stick-x', x / length * radius * .65 + 'px');
      this.stick.style.setProperty('--stick-y', y / length * radius * .65 + 'px');
      move.forward = y < -.22;
      move.backward = y > .22;
      move.left = x < -.22;
      move.right = x > .22;
      move.sprint = Math.hypot(x,y) > .88;
    }, () => {
      move.forward = move.backward = move.left = move.right = move.sprint = false;
      this.stick.style.removeProperty('--stick-x');
      this.stick.style.removeProperty('--stick-y');
    }, true);

    const aimDrag = () => {
      let lastX, lastY;
      return {
        start(event) {
          lastX = event.clientX;
          lastY = event.clientY;
        },
        move: event => {
          this.rotate(event.clientX-lastX, event.clientY-lastY, game.weapon.isScoped ? .002 : .005);
          lastX = event.clientX;
          lastY = event.clientY;
        }
      };
    };
    const look = this.root.querySelector('.touch-look');
    const lookDrag = aimDrag();
    this.bindPointer(look, lookDrag.start, lookDrag.move);

    const actions = {
      pause: () => this.unlock(),
      fire: () => { game.isMouseDown = true; game.handleShoot(); },
      crouch: () => { move.crouch = true; },
      jump: () => {
        game.jumpRequested = true;
        game.jumpRequestedAt = performance.now();
        game.jumpRequestTimer = .2;
      },
      reload: () => { game.weapon.reload(); game.updateHudAmmo(); },
      aim: () => {
        if (!game.weapon.config.hasScope) return;
        const scoped = game.weapon.toggleScope();
        game.sniperScopeOverlay.classList.toggle('hidden', !scoped);
        game.crosshairElem.style.display = scoped ? 'none' : 'block';
      },
      weapon: () => {
        const slots = [...game.weapon.loadout,4];
        game.switchWeaponSlot(slots[(slots.indexOf(game.weapon.currentSlot)+1)%slots.length]);
      },
      ability: () => game.socket.emit('use-ability'),
      frag: () => game.throwFragGrenade(),
      flash: () => game.throwFlashbang(),
      molotov: () => game._throwTactical('molotov')
    };
    const release = {fire: () => { game.isMouseDown = false; }, crouch: () => { move.crouch = false; }};
    for (const button of this.root.querySelectorAll('[data-action]')) {
      const action = button.dataset.action;
      const drag = action === 'fire' ? aimDrag() : null;
      this.bindPointer(button, event => {
        drag?.start(event);
        if (game.state === 'playing' && game.isAlive) actions[action]();
      }, drag?.move, release[action]);
    }
  }

  pointers = new Map();

  bindPointer(element, start, move, end, moveOnStart = false) {
    const finish = event => {
      const id = event.pointerId;
      if (this.pointers.get(id)?.element !== element) return;
      this.pointers.delete(id);
      end?.();
    };
    element.addEventListener('pointerdown', event => {
      if (!this.isLocked || [...this.pointers.values()].some(pointer => pointer.element === element)) return;
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, {element,end});
      start(event);
      if (moveOnStart) move(event);
    });
    element.addEventListener('pointermove', event => {
      if (this.pointers.get(event.pointerId)?.element === element) move?.(event);
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) element.addEventListener(name,finish);
  }

  resetTouches() {
    for (const [id,{element,end}] of this.pointers) {
      this.pointers.delete(id);
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      end?.();
    }
  }

  lock() {
    if (this.isLocked) return;
    this.isLocked = true;
    this.root.hidden = false;
    this.dispatchEvent({type:'lock'});
  }

  unlock() {
    this.resetTouches();
    if (!this.isLocked) return;
    this.isLocked = false;
    this.root.hidden = true;
    this.dispatchEvent({type:'unlock'});
  }
}
