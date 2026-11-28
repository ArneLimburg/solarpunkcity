// Pure camera math of the settler preview: where the follow camera sits and
// how its yaw trails the heading of the settler. No Babylon imports.

export const PREVIEW_CAMERA_NAME = "settlerPreviewCamera";
export const PREVIEW_DISTANCE = 2; // scene units from the settler
export const PREVIEW_PITCH = Math.PI / 4; // looking down at 45° above the ground
export const PREVIEW_TIME_CONSTANT = 0.5; // seconds of the yaw smoothing
export const PREVIEW_NEAR_OFFSET = 0.25; // the near plane sits this far in front of the figure
export const PREVIEW_MIN_Z = PREVIEW_DISTANCE - PREVIEW_NEAR_OFFSET;
export const PREVIEW_MAX_Z = 8;
export const PREVIEW_MAX_WIDTH = 320;
export const PREVIEW_MAX_HEIGHT = 240;

export type Point = { x: number; y: number; z: number };

// an angle in (-π, π]
export function normalizeAngle(angle: number): number {
  const turns = angle / (2 * Math.PI);
  const wrapped = (turns - Math.round(turns)) * 2 * Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

// The camera sits behind the target (the heading 0 looks to +z, so "behind" is
// against its direction) and above it.
export function getCameraPosition(target: Point, yaw: number): Point {
  const horizontal = PREVIEW_DISTANCE * Math.cos(PREVIEW_PITCH);
  return {
    x: target.x - Math.sin(yaw) * horizontal,
    y: target.y + PREVIEW_DISTANCE * Math.sin(PREVIEW_PITCH),
    z: target.z - Math.cos(yaw) * horizontal,
  };
}

// One smoothing step of the yaw towards the heading, the shorter way around.
// The factor stays below 1, so the yaw never overshoots.
export function smoothYaw(
  yaw: number,
  heading: number,
  seconds: number,
): number {
  const factor = 1 - Math.exp(-Math.max(seconds, 0) / PREVIEW_TIME_CONSTANT);
  return normalizeAngle(yaw + normalizeAngle(heading - yaw) * factor);
}

export type PreviewFollow = {
  // the camera starts directly behind the settler (open, switch to another)
  reset: (heading: number) => void;
  // the yaw for the next frame; a paused settler keeps it
  update: (heading: number, seconds: number, pausing: boolean) => number;
};

export function createFollow(): PreviewFollow {
  let yaw = 0;
  return {
    reset: (heading) => {
      yaw = normalizeAngle(heading);
    },
    update: (heading, seconds, pausing) => {
      if (!pausing) {
        yaw = smoothYaw(yaw, heading, seconds);
      }
      return yaw;
    },
  };
}

// The backing resolution of the preview: the size of the canvas on the screen,
// scaled down to fit the limit (keeps the aspect ratio).
export function getPreviewSize(
  clientWidth: number,
  clientHeight: number,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    PREVIEW_MAX_WIDTH / clientWidth,
    PREVIEW_MAX_HEIGHT / clientHeight,
  );
  return {
    width: Math.max(1, Math.floor(clientWidth * scale)),
    height: Math.max(1, Math.floor(clientHeight * scale)),
  };
}
