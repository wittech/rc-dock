"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const DragManager = __importStar(require("./DragManager"));
const GestureManager_1 = require("./GestureManager");
class DragDropDiv extends react_1.default.Component {
    constructor() {
        super(...arguments);
        this._getRef = (r) => {
            if (r === this.element) {
                return;
            }
            let { getRef, onDragOverT, onDropT, onDragLeaveT } = this.props;
            if (this.element && onDragOverT) {
                DragManager.removeHandlers(this.element);
            }
            this.element = r;
            if (getRef) {
                getRef(r);
            }
            if (r && onDragOverT) {
                DragManager.addHandlers(r, { onDragOverT, onDragLeaveT, onDropT });
            }
        };
        this.dragType = null;
        this.waitingMove = false;
        this.listening = false;
        this.gesturing = false;
        this.onPointerDown = (e) => {
            let { onDragStartT, onGestureStartT, onGestureMoveT } = this.props;
            let event = e.nativeEvent;
            this.cancel();
            if (event.type === 'touchstart') {
                // check single or double fingure touch
                if (event.touches.length === 1) {
                    if (onDragStartT) {
                        this.onDragStart(event);
                    }
                }
                else if (event.touches.length === 2) {
                    if (onGestureStartT && onGestureMoveT) {
                        this.onGestureStart(event);
                    }
                }
            }
            else if (onDragStartT) {
                this.onDragStart(event);
            }
        };
        this.onMouseMove = (e) => {
            let { onDragMoveT } = this.props;
            if (this.waitingMove) {
                if (!this.checkFirstMove(e)) {
                    return;
                }
            }
            else {
                let state = new DragManager.DragState(e, this);
                state._onMove();
                if (onDragMoveT) {
                    onDragMoveT(state);
                }
            }
            e.preventDefault();
        };
        this.onTouchMove = (e) => {
            let { onDragMoveT } = this.props;
            if (this.waitingMove) {
                if (!this.checkFirstMove(e)) {
                    return;
                }
            }
            else if (e.touches.length !== 1) {
                this.onDragEnd();
            }
            else {
                let state = new DragManager.DragState(e, this);
                state._onMove();
                if (onDragMoveT) {
                    onDragMoveT(state);
                }
            }
            e.preventDefault();
        };
        this.onDragEnd = (e) => {
            let { onDragEndT } = this.props;
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
        this.onGestureMove = (e) => {
            let { onGestureMoveT, gestureSensitivity } = this.props;
            let state = new GestureManager_1.GestureState(e, this);
            if (this.waitingMove) {
                if (!(gestureSensitivity > 0)) {
                    gestureSensitivity = 10; // default sensitivity
                }
                if (state.moved() > gestureSensitivity) {
                    this.waitingMove = false;
                }
                else {
                    return;
                }
            }
            if (onGestureMoveT) {
                onGestureMoveT(state);
            }
        };
        this.onGestureEnd = (e) => {
            let { onGestureEndT } = this.props;
            let state = new DragManager.DragState(e, this);
            this.removeListeners();
            if (onGestureEndT) {
                onGestureEndT();
            }
        };
        this.onKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.cancel();
            }
        };
    }
    onDragStart(event) {
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
    addDragListeners(event) {
        let { onDragStartT } = this.props;
        if (event.type === 'touchstart') {
            document.addEventListener('touchmove', this.onTouchMove);
            document.addEventListener('touchend', this.onDragEnd);
            this.dragType = 'touch';
        }
        else {
            document.addEventListener('mousemove', this.onMouseMove);
            document.addEventListener('mouseup', this.onDragEnd);
            if (event.button === 2) {
                this.dragType = 'right';
            }
            else {
                this.dragType = 'left';
            }
        }
        document.body.classList.add('dock-dragging');
        this.waitingMove = true;
        this.listening = true;
    }
    // return true for a valid move
    checkFirstMove(e) {
        let state = new DragManager.DragState(e, this, true);
        if (!state.moved()) {
            // not a move
            return false;
        }
        return this.executeFirstMove(state);
    }
    executeFirstMove(state) {
        let { onDragStartT } = this.props;
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
    addGestureListeners(event) {
        document.addEventListener('touchmove', this.onGestureMove);
        document.addEventListener('touchend', this.onGestureEnd);
        document.addEventListener('keydown', this.onKeyDown);
        document.body.classList.add('dock-dragging');
        this.gesturing = true;
        this.waitingMove = true;
    }
    onGestureStart(event) {
        if (!DragManager.checkPointerDownEvent(event)) {
            // same pointer event shouldn't trigger 2 drag start
            return;
        }
        let { onGestureStartT } = this.props;
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
        let state = new GestureManager_1.GestureState(event, this, true);
        if (onGestureStartT(state)) {
            this.addGestureListeners(event);
            event.preventDefault();
        }
    }
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
        }
        else if (this.listening) {
            if (this.dragType === 'touch') {
                document.removeEventListener('touchmove', this.onTouchMove);
                document.removeEventListener('touchend', this.onDragEnd);
            }
            else {
                document.removeEventListener('mousemove', this.onMouseMove);
                document.removeEventListener('mouseup', this.onDragEnd);
            }
        }
        document.body.classList.remove('dock-dragging');
        document.removeEventListener('keydown', this.onKeyDown);
        this.listening = false;
        this.gesturing = false;
    }
    cleanupDrag(state) {
        this.dragType = null;
        this.waitingMove = false;
        DragManager.destroyDraggingElement(state);
    }
    render() {
        let _a = this.props, { getRef, children, className, directDragT, onDragStartT, onDragMoveT, onDragEndT, onDragOverT, onDragLeaveT, onDropT, onGestureStartT, onGestureMoveT, onGestureEndT } = _a, others = __rest(_a, ["getRef", "children", "className", "directDragT", "onDragStartT", "onDragMoveT", "onDragEndT", "onDragOverT", "onDragLeaveT", "onDropT", "onGestureStartT", "onGestureMoveT", "onGestureEndT"]);
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
            }
            else {
                className = 'drag-initiator';
            }
        }
        return (react_1.default.createElement("div", Object.assign({ ref: this._getRef, className: className }, others, { onMouseDown: onMouseDown, onTouchStart: onTouchDown }), children));
    }
    componentWillUnmount() {
        let { onDragOverT } = this.props;
        if (this.element && onDragOverT) {
            DragManager.removeHandlers(this.element);
        }
        this.cancel();
    }
}
exports.DragDropDiv = DragDropDiv;
//# sourceMappingURL=DragDropDiv.js.map