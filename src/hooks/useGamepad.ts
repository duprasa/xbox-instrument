
import { useState, useEffect, useRef, useCallback } from 'react';

export interface GamepadState {
  connected: boolean;
  axes: {
    left: { x: number; y: number; angle: number; magnitude: number };
    right: { x: number; y: number; angle: number; magnitude: number };
  };
  triggers: {
    left: number;
    right: number;
  };
  buttons: {
    a: boolean;
    b: boolean;
    x: boolean;
    y: boolean;
    lb: boolean;
    rb: boolean;
    lt: boolean; // Treat as button too? usually analog
    rt: boolean;
    back: boolean;
    start: boolean;
    ls: boolean;
    rs: boolean;
    dpadUp: boolean;
    dpadDown: boolean;
    dpadLeft: boolean;
    dpadRight: boolean;
    home: boolean;
  };
}

const DEFAULT_STATE: GamepadState = {
  connected: false,
  axes: {
    left: { x: 0, y: 0, angle: 0, magnitude: 0 },
    right: { x: 0, y: 0, angle: 0, magnitude: 0 },
  },
  triggers: { left: 0, right: 0 },
  buttons: {
    a: false, b: false, x: false, y: false,
    lb: false, rb: false, lt: false, rt: false,
    back: false, start: false, ls: false, rs: false,
    dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
    home: false,
  },
};

const DEADZONE = 0.1;

const getAngle = (x: number, y: number) => {
  // atan2 returns -PI to PI. -PI is West, -PI/2 is North, 0 is East, PI/2 is South.
  // We want 0 at North (Up)? Or East?
  // Standard math: 0 is East (Right).
  // Let's normalize to 0-360, starting from North (Up) clockwise?
  // Up is y = -1 (in gamepad API usually y is down positive, so Up is -1).
  // Let's use standard math 0 = East, but flip Y because screen Y is down.
  // Gamepad: Y is 1 (Down), -1 (Up). X is -1 (Left), 1 (Right).
  
  // To make 0 = North (Up, Y=-1):
  // atan2(y, x).
  // North: x=0, y=-1 -> atan2(-1, 0) = -PI/2 (-90 deg).
  // East: x=1, y=0 -> atan2(0, 1) = 0.
  // We want North to be 0.
  // degrees = (atan2(y, x) * 180 / PI) + 90.
  // If < 0, add 360.
  
  const angle = Math.atan2(y, x) * (180 / Math.PI);
  // Convert to 0 at top, clockwise.
  // atan2: Right=0, Down=90, Left=180, Up=-90.
  // We want Up=0, Right=90, Down=180, Left=270.
  // So angle + 90.
  
  let d = angle + 90;
  if (d < 0) d += 360;
  return d;
};

const getMagnitude = (x: number, y: number) => {
  const m = Math.sqrt(x * x + y * y);
  return m > 1 ? 1 : m;
};

export const useGamepad = () => {
  const [gamepadState, setGamepadState] = useState<GamepadState>(DEFAULT_STATE);
  const requestRef = useRef<number | null>(null);

  const scanGamepads = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gamepads = (navigator as any).getGamepads ? (navigator as any).getGamepads() : [];
    // Use the first active gamepad
    const gp = gamepads[0]; // Assuming index 0

    if (gp) {
      // Process Axes
      // Standard mapping: 0: LeftX, 1: LeftY, 2: RightX, 3: RightY
      const lx = Math.abs(gp.axes[0]) > DEADZONE ? gp.axes[0] : 0;
      const ly = Math.abs(gp.axes[1]) > DEADZONE ? gp.axes[1] : 0;
      const rx = Math.abs(gp.axes[2]) > DEADZONE ? gp.axes[2] : 0;
      const ry = Math.abs(gp.axes[3]) > DEADZONE ? gp.axes[3] : 0;

      // Process Buttons
      // Standard mapping (Xbox):
      // 0:A, 1:B, 2:X, 3:Y, 4:LB, 5:RB, 6:LT, 7:RT, 8:Back, 9:Start, 10:LS, 11:RS, 12:Up, 13:Down, 14:Left, 15:Right, 16:Home
      const b = gp.buttons;
      
      setGamepadState({
        connected: true,
        axes: {
          left: { x: lx, y: ly, angle: getAngle(lx, ly), magnitude: getMagnitude(lx, ly) },
          right: { x: rx, y: ry, angle: getAngle(rx, ry), magnitude: getMagnitude(rx, ry) },
        },
        triggers: {
          left: b[6].value,
          right: b[7].value,
        },
        buttons: {
          a: b[0].pressed,
          b: b[1].pressed,
          x: b[2].pressed,
          y: b[3].pressed,
          lb: b[4].pressed,
          rb: b[5].pressed,
          lt: b[6].pressed, // Also available as button
          rt: b[7].pressed,
          back: b[8].pressed,
          start: b[9].pressed,
          ls: b[10].pressed,
          rs: b[11].pressed,
          dpadUp: b[12].pressed,
          dpadDown: b[13].pressed,
          dpadLeft: b[14].pressed,
          dpadRight: b[15].pressed,
          home: b[16]?.pressed || false,
        },
      });
    } else {
      setGamepadState(prev => prev.connected ? { ...DEFAULT_STATE, connected: false } : prev);
    }

    requestRef.current = requestAnimationFrame(scanGamepads);
  }, []);

  useEffect(() => {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('Gamepad connected:', e.gamepad);
    });
    
    requestRef.current = requestAnimationFrame(scanGamepads);

    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [scanGamepads]);

  return gamepadState;
};

