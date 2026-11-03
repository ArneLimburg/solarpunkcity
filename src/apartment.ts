import { deciduousTree, part, rotateY, type FarmPart } from "./farms";

const STORIES = 5;
const STORY_HEIGHT = 0.3;
const TOWER = 0.8;
const HEIGHT = STORIES * STORY_HEIGHT;
const FACE = TOWER / 2 + 0.01; // distance of facade details from the center
const ROOF_HEIGHT = 0.2;
const ROOF_TILT = Math.atan(ROOF_HEIGHT / (TOWER / 2 + 0.02));

// the four sides of the tower, the front side looks towards +Z
const SIDES = [0, 1, 2, 3].map((side) => (side * Math.PI) / 2);

function windows(): FarmPart[] {
  const parts: FarmPart[] = [];
  for (const rotation of SIDES) {
    for (let story = 0; story < STORIES; story++) {
      for (const offset of [-0.2, 0.2]) {
        const { x, z } = rotateY({ x: offset, z: FACE }, rotation);
        const y = story * STORY_HEIGHT + 0.17;
        parts.push(
          part("box", "darkGlass", [x, y, z], [0.14, 0.12, 0.02], rotation),
        );
      }
    }
  }
  return parts;
}

// wooden slab around the tower with a plant strip as railing
function balcony(story: number): FarmPart[] {
  const floor = story * STORY_HEIGHT;
  const edge = 0.46;
  return [
    part("box", "wood", [0, floor + 0.02, 0], [0.96, 0.04, 0.96]),
    part("box", "plant", [0, floor + 0.08, edge], [0.96, 0.08, 0.04]),
    part("box", "plant", [0, floor + 0.08, -edge], [0.96, 0.08, 0.04]),
    part("box", "plant", [edge, floor + 0.08, 0], [0.04, 0.08, 0.88]),
    part("box", "plant", [-edge, floor + 0.08, 0], [0.04, 0.08, 0.88]),
  ];
}

function climbingPlants(): FarmPart[] {
  return [
    part("box", "plant", [-0.35, 0.6, FACE + 0.005], [0.06, 1.0, 0.02]),
    part("box", "plant", [0.35, 0.9, FACE + 0.005], [0.06, 1.2, 0.02]),
    part("box", "plant", [FACE + 0.005, 0.7, 0.15], [0.02, 1.0, 0.06]),
  ];
}

// mono-pitch roof: a prism with the solar side towards +Z
function roof(): FarmPart[] {
  const sin = Math.sin(ROOF_TILT);
  const cos = Math.cos(ROOF_TILT);
  return [
    part(
      "prism",
      "roof",
      [0, HEIGHT + ROOF_HEIGHT / 2, 0],
      [TOWER + 0.04, ROOF_HEIGHT, TOWER + 0.04],
    ),
    part(
      "box",
      "solar",
      [
        0,
        HEIGHT + ROOF_HEIGHT / 2 + 0.018 * cos,
        TOWER / 4 + 0.01 + 0.018 * sin,
      ],
      [TOWER, 0.03, 0.4],
      0,
      ROOF_TILT,
    ),
  ];
}

function windTurbine(): FarmPart[] {
  const hub: [number, number, number] = [0.3, HEIGHT + ROOF_HEIGHT + 0.5, 0.05];
  const length = 0.28;
  const blades = [0, 1, 2].map((i) => {
    const angle = (i * 2 * Math.PI) / 3;
    return part(
      "box",
      "concrete",
      [
        hub[0] + 0.03,
        hub[1] + (Math.cos(angle) * length) / 2,
        hub[2] + (Math.sin(angle) * length) / 2,
      ],
      [0.01, length, 0.04],
      0,
      angle,
    );
  });
  return [
    part(
      "cylinder",
      "concrete",
      [hub[0], HEIGHT + ROOF_HEIGHT + 0.25, hub[2]],
      [0.04, 0.5, 0.04],
    ),
    ...blades,
  ];
}

// Parts of the apartment building relative to its tile. Pure and
// deterministic. hexSize is the side length of a hex; the parts are designed
// for 1.
export function getApartmentLayout(hexSize: number): FarmPart[] {
  const parts = [
    part("box", "ochre", [0, HEIGHT / 2, 0], [TOWER, HEIGHT, TOWER]),
    ...windows(),
    ...balcony(1),
    ...balcony(3),
    ...climbingPlants(),
    part("box", "plant", [0, 0.12, FACE + 0.005], [0.16, 0.24, 0.02]),
    ...roof(),
    ...deciduousTree(-0.25, HEIGHT + 0.06, -0.28),
    ...deciduousTree(0.05, HEIGHT + 0.06, -0.28),
    ...windTurbine(),
  ];
  return parts.map((p) => ({
    ...p,
    x: p.x * hexSize,
    y: p.y * hexSize,
    z: p.z * hexSize,
    width: p.width * hexSize,
    height: p.height * hexSize,
    depth: p.depth * hexSize,
  }));
}
