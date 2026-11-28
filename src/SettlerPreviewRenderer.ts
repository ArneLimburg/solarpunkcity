import { FreeCamera, Vector3, type Scene } from "@babylonjs/core";
import { TILE_TOP } from "./hexGeometry";
import { DEFAULT_LAYER_MASK, type SettlerRenderer } from "./SettlerRenderer";
import {
  PREVIEW_CAMERA_NAME,
  PREVIEW_MAX_Z,
  PREVIEW_MIN_Z,
  createFollow,
  getCameraPosition,
  getPreviewSize,
} from "./settlerPreview";

const MAX_FRAME_SECONDS = 0.25;
// the camera looks at the middle of the body
const TARGET_HEIGHT = TILE_TOP + 0.12;

// Shows the scene from a camera that follows one settler in the canvas (a
// second view of the engine). The same scene is rendered, there is no second
// simulation. Babylon renders only the registered views while there are any,
// so the engine's view step is wrapped: it renders the preview in every second
// frame and the main map right after it.
// Returns the function that removes the preview again.
export function attachSettlerPreview(
  scene: Scene,
  settlers: Pick<SettlerRenderer, "getPose">,
  canvas: HTMLCanvasElement,
  id: number,
): () => void {
  const engine = scene.getEngine();
  const camera = new FreeCamera(PREVIEW_CAMERA_NAME, Vector3.Zero(), scene);
  camera.minZ = PREVIEW_MIN_Z;
  camera.maxZ = PREVIEW_MAX_Z;
  // everything of the map except the selection marker
  camera.layerMask = DEFAULT_LAYER_MASK;
  const follow = createFollow();
  let started = false;
  let frame = 0;

  const moveCamera = () => {
    const pose = settlers.getPose(id);
    if (!pose) {
      return;
    }
    if (!started) {
      follow.reset(pose.heading);
      started = true;
    }
    const yaw = follow.update(
      pose.heading,
      Math.min(engine.getDeltaTime() / 1000, MAX_FRAME_SECONDS),
      pose.pausing,
    );
    const target = { x: pose.x, y: TARGET_HEIGHT + pose.bob, z: pose.z };
    const position = getCameraPosition(target, yaw);
    camera.position.set(position.x, position.y, position.z);
    camera.setTarget(new Vector3(target.x, target.y, target.z));
  };

  const renderViews = engine._renderViews;
  const dispose = () => {
    engine._renderViews = renderViews; // back to the engine's own view step
    engine.unRegisterView(canvas);
    camera.dispose();
  };

  try {
    const view = engine.registerView(canvas, camera);
    view.customResize = (target) => {
      const { width, height } = getPreviewSize(
        target.clientWidth,
        target.clientHeight,
      );
      target.width = width;
      target.height = height;
      engine.setSize(width, height);
    };
    engine._renderViews = () => {
      view.enabled = frame++ % 2 === 0;
      if (view.enabled) {
        moveCamera();
      }
      renderViews.call(engine);
      if (view.enabled) {
        // the map renders in its own size again
        engine.resize();
      }
      return false; // the main frame follows
    };
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
