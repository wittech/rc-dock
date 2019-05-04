import React, {CSSProperties} from "react";
import * as DragManager from "./DragManager";
import {GestureState} from "./GestureManager";

export type AbstractPointerEvent = MouseEvent | TouchEvent;

interface DragDropDivProps extends React.HTMLAttributes<HTMLDivElement> {
  getRef?: (ref: HTMLDivElement) => void;
  onDragStartT?: DragManager.DragHandler;
  onDragMoveT?: DragManager.DragHandler;
  onDragEndT?: DragManager.DragHandler;
  onDragOverT?: DragManager.DragHandler;
  onDragLeaveT?: DragManager.DragHandler;
  onDropT?: DragManager.DragHandler;
  /**
   * by default onDragStartT will be called on first drag move
   * but if directDragT is true, onDragStartT will be called as soon as mouse is down
   */
  directDragT?: boolean;

  onGestureStartT?: (state: GestureState) => boolean;
  onGestureMoveT?: (state: GestureState) => void;
  onGestureEndT?: () => void;


  gestureSensitivity?: number;
}

export class DragDropDiv extends React.Component<DragDropDivProps, any> {

  element: HTMLElement;

  _getRef = (r: HTMLDivElement) => {
    if (r === this.element) {
      return;
    }
    let {getRef, onDragOverT, onDropT, onDragLeaveT} = this.props;
    if (this.element && onDragOverT) {
      DragManager.removeHandlers(this.element);
    }
    this.element = r;
    if (getRef) {
      getRef(r);
    }
    if (r && onDragOverT) {
      DragManager.addHandlers(r, {onDragOverT, onDragLeaveT, onDropT});
    }
  };

  dragType: DragManager.DragType = null;
  baseX: number;
  baseY: number;
  scaleX: number;
  scaleY: number;
  waitingMove = false;
  listening = false;

  gesturing = false;
  baseX2: number;
  baseY2: number;
  baseDis: number;
  baseAng: number;

  onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    let {onDragStartT, onGestureStartT, onGestureMoveT} = this.props;
    let event = e.nativeEvent;
    this.cancel();
    if (event.type === 'touchstart') {
      // check single or double fingure touch
      if ((event as TouchEvent).touches.length === 1) {
        if (onDragStartT) {
          this.onDragStart(event);
        }
      } else if ((event as TouchEvent).touches.length === 2) {
        if (onGestureStartT && onGestureMoveT) {
          this.onGestureStart(event as TouchEvent);
        }
      }
    } else if (onDragStartT) {
      this.onDragStart(event);
    }
  };

  onDragStart(event: MouseEvent | TouchEvent) {
    if (!DragManager.checkPointerDownEvent(event)) {
      // same pointer event shouldn't trigger 2 drag start
      return;
    }
    let state = new DragManager.DragState(event, this, true);
    this.baseX = state.pageX;
    this.baseY = state.pageY;

    let baseElement = this.element.parentElement;
    let rect = baseElement.getBoundingClientRect();
    this.scaleX = baseElement.offsetWidth / Math.round(rect.width);
    this.scaleY = baseElement.offsetHeight / Math.round(rect.height);
    this.addDragListeners(event);
    if (this.props.directDragT) {
      this.executeFirstMove(state);
    }
    event.preventDefault();
  }

  addDragListeners(event: MouseEvent | TouchEvent) {
    let {onDragStartT} = this.props;

    if (event.type === 'touchstart') {
      document.addEventListener('touchmove', this.onTouchMove);
      document.addEventListener('touchend', this.onDragEnd);
      this.dragType = 'touch';
    } else {
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onDragEnd);
      if ((event as MouseEvent).button === 2) {
        this.dragType = 'right';
      } else {
        this.dragType = 'left';
      }
    }
    document.body.classList.add('dock-dragging');
    this.waitingMove = true;
    this.listening = true;
  }

  // return true for a valid move
  checkFirstMove(e: AbstractPointerEvent) {
    let state = new DragManager.DragState(e, this, true);
    if (!state.moved()) {
      // not a move
      return false;
    }
    return this.executeFirstMove(state);
  }

  executeFirstMove(state: DragManager.DragState): boolean {
    let {onDragStartT} = this.props;

    this.waitingMove = false;
    onDragStartT(state);
    if (!DragManager.isDragging()) {
      this.onDragEnd();
      return false;
    }
    state._onMove();
    document.addEventListener('keydown', this.onKeyDown);
    return true;
  }


  onMouseMove = (e: MouseEvent) => {
    let {onDragMoveT} = this.props;
    if (this.waitingMove) {
      if (!this.checkFirstMove(e)) {
        return;
      }
    } else {
      let state = new DragManager.DragState(e, this);
      state._onMove();
      if (onDragMoveT) {
        onDragMoveT(state);
      }
    }
    e.preventDefault();
  };

  onTouchMove = (e: TouchEvent) => {
    let {onDragMoveT} = this.props;
    if (this.waitingMove) {
      if (!this.checkFirstMove(e)) {
        return;
      }
    } else if (e.touches.length !== 1) {
      this.onDragEnd();
    } else {
      let state = new DragManager.DragState(e, this);
      state._onMove();
      if (onDragMoveT) {
        onDragMoveT(state);
      }
    }
    e.preventDefault();
  };

  onDragEnd = (e?: TouchEvent | MouseEvent) => {
    let {onDragEndT} = this.props;
    let state = new DragManager.DragState(e, this);

    this.removeListeners();

    if (!this.waitingMove) {
      if (e) {
        // e=null means drag is canceled
        state._onDragEnd();
      }
      if (onDragEndT) {
        onDragEndT(state);
      }
    }

    this.cleanupDrag(state);
  };

  addGestureListeners(event: TouchEvent) {
    document.addEventListener('touchmove', this.onGestureMove);
    document.addEventListener('touchend', this.onGestureEnd);
    document.addEventListener('keydown', this.onKeyDown);
    document.body.classList.add('dock-dragging');
    this.gesturing = true;
    this.waitingMove = true;
  }

  onGestureStart(event: TouchEvent) {
    if (!DragManager.checkPointerDownEvent(event)) {
      // same pointer event shouldn't trigger 2 drag start
      return;
    }
    let {onGestureStartT} = this.props;


    this.baseX = event.touches[0].pageX;
    this.baseY = event.touches[0].pageY;
    this.baseX2 = event.touches[1].pageX;
    this.baseY2 = event.touches[1].pageY;
    let baseElement = this.element.parentElement;
    let rect = baseElement.getBoundingClientRect();
    this.scaleX = baseElement.offsetWidth / Math.round(rect.width);
    this.scaleY = baseElement.offsetHeight / Math.round(rect.height);
    this.baseDis = Math.sqrt(Math.pow(this.baseX - this.baseX2, 2) + Math.pow(this.baseY - this.baseY2, 2));
    this.baseAng = Math.atan2(this.baseY2 - this.baseY, this.baseX2 - this.baseX);

    let state = new GestureState(event, this, true);
    if (onGestureStartT(state)) {
      this.addGestureListeners(event);
      event.preventDefault();
    }
  }

  onGestureMove = (e: TouchEvent) => {
    let {onGestureMoveT, gestureSensitivity} = this.props;
    let state = new GestureState(e, this);
    if (this.waitingMove) {
      if (!(gestureSensitivity > 0)) {
        gestureSensitivity = 10; // default sensitivity
      }
      if (state.moved() > gestureSensitivity) {
        this.waitingMove = false;
      } else {
        return;
      }
    }
    if (onGestureMoveT) {
      onGestureMoveT(state);
    }
  };
  onGestureEnd = (e?: TouchEvent) => {
    let {onGestureEndT} = this.props;
    let state = new DragManager.DragState(e, this);

    this.removeListeners();
    if (onGestureEndT) {
      onGestureEndT();
    }
  };
  onKeyDown = (e?: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.cancel();
    }
  };

  cancel() {
    if (this.listening) {
      this.onDragEnd();
    }
    if (this.gesturing) {
      this.onGestureEnd();
    }
  }

  removeListeners() {
    if (this.gesturing) {
      document.removeEventListener('touchmove', this.onGestureMove);
      document.removeEventListener('touchend', this.onGestureEnd);
    } else if (this.listening) {
      if (this.dragType === 'touch') {
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onDragEnd);
      } else {
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onDragEnd);
      }
    }
    document.body.classList.remove('dock-dragging');
    document.removeEventListener('keydown', this.onKeyDown);
    this.listening = false;
    this.gesturing = false;
  }

  cleanupDrag(state: DragManager.DragState) {
    this.dragType = null;
    this.waitingMove = false;
    DragManager.destroyDraggingElement(state);
  }

  render(): React.ReactNode {
    let {
      getRef, children, className,
      directDragT, onDragStartT, onDragMoveT, onDragEndT, onDragOverT, onDragLeaveT, onDropT,
      onGestureStartT, onGestureMoveT, onGestureEndT,
      ...others
    } = this.props;
    let onTouchDown = this.onPointerDown;
    let onMouseDown = this.onPointerDown;
    if (!onDragStartT) {
      onMouseDown = null;
      if (!onGestureStartT) {
        onTouchDown = null;
      }
    }
    if (onDragStartT || onGestureStartT) {
      if (className) {
        className = `${className} drag-initiator`;
      } else {
        className = 'drag-initiator';
      }
    }

    return (
      <div ref={this._getRef} className={className} {...others} onMouseDown={onMouseDown}
           onTouchStart={onTouchDown}>
        {children}
      </div>
    );
  }

  componentWillUnmount(): void {
    let {onDragOverT} = this.props;
    if (this.element && onDragOverT) {
      DragManager.removeHandlers(this.element);
    }
    this.cancel();
  }
}