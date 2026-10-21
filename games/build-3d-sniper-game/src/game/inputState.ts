export interface LiveInputState {
  keysDown: Set<string>;
  lookDeltaX: number;
  lookDeltaY: number;
  fireRequested: boolean;
  fireHeld: boolean;
  toggleScopeRequested: boolean;
  zoomDeltaSteps: number;
  reloadRequested: boolean;
  crouchToggleRequested: boolean;
  interactRequested: boolean;
  binocularsToggleRequested: boolean;
  cameraModeToggleRequested: boolean;
  equipment1Requested: boolean;
  equipment2Requested: boolean;
  ammoCycleRequested: boolean;
  tacticalMapHeld: boolean;
  touchMoveX: number; // -1..1
  touchMoveY: number; // -1..1
  touchSprint: boolean;
  touchBreathHold: boolean;
}

export const liveInput: LiveInputState = {
  keysDown: new Set<string>(),
  lookDeltaX: 0,
  lookDeltaY: 0,
  fireRequested: false,
  fireHeld: false,
  toggleScopeRequested: false,
  zoomDeltaSteps: 0,
  reloadRequested: false,
  crouchToggleRequested: false,
  interactRequested: false,
  binocularsToggleRequested: false,
  cameraModeToggleRequested: false,
  equipment1Requested: false,
  equipment2Requested: false,
  ammoCycleRequested: false,
  tacticalMapHeld: false,
  touchMoveX: 0,
  touchMoveY: 0,
  touchSprint: false,
  touchBreathHold: false,
};

export function resetTransientInput(): void {
  liveInput.keysDown.clear();
  liveInput.lookDeltaX = 0;
  liveInput.lookDeltaY = 0;
  liveInput.fireRequested = false;
  liveInput.fireHeld = false;
  liveInput.toggleScopeRequested = false;
  liveInput.zoomDeltaSteps = 0;
  liveInput.reloadRequested = false;
  liveInput.crouchToggleRequested = false;
  liveInput.interactRequested = false;
  liveInput.binocularsToggleRequested = false;
  liveInput.cameraModeToggleRequested = false;
  liveInput.equipment1Requested = false;
  liveInput.equipment2Requested = false;
  liveInput.ammoCycleRequested = false;
  liveInput.tacticalMapHeld = false;
  liveInput.touchMoveX = 0;
  liveInput.touchMoveY = 0;
  liveInput.touchSprint = false;
  liveInput.touchBreathHold = false;
}
