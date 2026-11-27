import { expect, test, vi } from "vitest";
import type { CornerRenderer } from "../src/CornerRenderer";
import type {
  ConstructionRenderer,
  ConstructionSite,
} from "../src/ConstructionRenderer";
import type { FarmRenderer } from "../src/FarmRenderer";
import type { ForestRenderer } from "../src/ForestRenderer";
import type { WindTurbineRenderer } from "../src/WindTurbineRenderer";
import type { WoodStorageRenderer } from "../src/WoodStorageRenderer";
import type { GroundMaterials, TileRenderer } from "../src/TileRenderer";
import { GRID_RADIUS, getRiverCourse } from "../src/board";
import { hexToPixel } from "../src/hexGeometry";
import { getHydroPowerPlantRotation } from "../src/hydroPowerPlant";

vi.mock("@babylonjs/core", () => ({
  Vector3: class {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  },
}));

import { placeBuilding, type PlacedModel } from "../src/placeBuilding";

function setup() {
  const dispose = vi.fn();
  const model: PlacedModel = { dispose, triangles: 5 };
  const clearTile = vi.fn();
  const create = vi.fn(() => model);
  const models: Record<string, PlacedModel> = {};
  const setGrounds = vi.fn();
  const materials = {
    meadow: { name: "meadow" },
    farmland: { name: "farmland" },
    soil: { name: "soil" },
    gravel: { name: "gravel" },
    earth: { name: "earth" },
    water: { name: "water" },
  } as GroundMaterials;
  const update = vi.fn();
  const siteDispose = vi.fn();
  const site: ConstructionSite = {
    dispose: siteDispose,
    setProgress: vi.fn(),
    getFill: () => 0,
  };
  const createSite = vi.fn(() => site);
  const sites: Record<string, ConstructionSite> = {};
  const createLogYard = vi.fn(() => model);
  const createTurbine = vi.fn(() => model);
  const createApartment = vi.fn(() => model);
  const parts = {
    corners: { update } as unknown as CornerRenderer,
    forest: { clearTile } as unknown as ForestRenderer,
    farms: { create } as unknown as FarmRenderer,
    woodStorage: { create: createLogYard } as unknown as WoodStorageRenderer,
    windTurbines: { create: createTurbine } as unknown as WindTurbineRenderer,
    apartmentRotors: {
      create: createApartment,
    } as unknown as WindTurbineRenderer,
    tiles: { setGrounds } as unknown as TileRenderer,
    materials,
    models,
    construction: { create: createSite } as ConstructionRenderer,
    sites,
  };
  return {
    parts,
    createSite,
    site,
    siteDispose,
    sites,
    dispose,
    model,
    clearTile,
    create,
    createLogYard,
    createTurbine,
    createApartment,
    models,
    update,
    setGrounds,
  };
}

test("a wood storage shows the log yard on gravel", () => {
  const { parts, create, createLogYard, models, model, setGrounds } = setup();
  placeBuilding({ q: 0, r: 0 }, "WoodStorage", parts);
  expect(setGrounds.mock.calls[0][1]).toBe(parts.materials.gravel);
  expect(createLogYard).toHaveBeenCalledWith(hexToPixel(0, 0));
  expect(create).not.toHaveBeenCalled();
  expect(models["0,0"]).toBe(model);
});

test("a sawmill shows its model on compacted earth", () => {
  const { parts, create, models, model, setGrounds } = setup();
  placeBuilding({ q: 0, r: 0 }, "Sawmill", parts);
  expect(setGrounds.mock.calls[0][1]).toBe(parts.materials.earth);
  expect(create).toHaveBeenCalledWith("Sawmill", hexToPixel(0, 0));
  expect(models["0,0"]).toBe(model);
});

test("a supermarket shows its model on a meadow, the gravel is part of the model", () => {
  const { parts, create, models, model, setGrounds } = setup();
  placeBuilding({ q: 0, r: 0 }, "Supermarket", parts);
  expect(setGrounds.mock.calls[0][1]).toBe(parts.materials.meadow);
  expect(create).toHaveBeenCalledWith("Supermarket", hexToPixel(0, 0));
  expect(models["0,0"]).toBe(model);
});

test("a wind turbine is shown by the wind turbine renderer on a meadow", () => {
  const { parts, create, createTurbine, models, model, setGrounds } = setup();
  placeBuilding({ q: 1, r: 2 }, "WindTurbine", parts);
  expect(setGrounds.mock.calls[0][1]).toBe(parts.materials.meadow);
  expect(createTurbine).toHaveBeenCalledWith({ q: 1, r: 2 }, hexToPixel(1, 2));
  expect(create).not.toHaveBeenCalled();
  expect(models["1,2"]).toBe(model);
});

test("a finished apartment building has a turning rooftop rotor, a site does not", () => {
  const { parts, create, createApartment, createSite, models, model } = setup();
  placeBuilding({ q: 1, r: 2 }, "AppartmentBuilding", parts);
  expect(createApartment).toHaveBeenCalledWith(
    { q: 1, r: 2 },
    hexToPixel(1, 2),
  );
  expect(create).not.toHaveBeenCalled();
  expect(models["1,2"]).toBe(model);
  placeBuilding({ q: 3, r: 2 }, "AppartmentBuilding", parts, true);
  expect(createApartment).toHaveBeenCalledTimes(1);
  expect(createSite).toHaveBeenCalledWith(
    "AppartmentBuilding",
    hexToPixel(3, 2),
    0,
  );
});

test("a wind turbine site shows a blueprint, no turbine", () => {
  const { parts, createTurbine, createSite, sites, site } = setup();
  placeBuilding({ q: 1, r: 2 }, "WindTurbine", parts, true);
  expect(createTurbine).not.toHaveBeenCalled();
  expect(createSite).toHaveBeenCalledWith("WindTurbine", hexToPixel(1, 2), 0);
  expect(sites["1,2"]).toBe(site);
});

test("a hydro power plant keeps the water and is turned to the river", () => {
  const { parts, create, models, model, setGrounds } = setup();
  const tile = getRiverCourse(GRID_RADIUS)[3];
  placeBuilding(tile, "HydroPowerPlant", parts);
  expect(setGrounds).toHaveBeenCalledWith([tile], parts.materials.water);
  expect(create).toHaveBeenCalledWith(
    "HydroPowerPlant",
    hexToPixel(tile.q, tile.r),
    getHydroPowerPlantRotation(tile),
  );
  expect(models[`${tile.q},${tile.r}`]).toBe(model);
});

test("a hydro power plant site keeps the water and shows a turned blueprint", () => {
  const { parts, create, createSite, site, sites, models, setGrounds } =
    setup();
  const tile = getRiverCourse(GRID_RADIUS)[3];
  placeBuilding(tile, "HydroPowerPlant", parts, true);
  expect(setGrounds).toHaveBeenCalledWith([tile], parts.materials.water);
  expect(create).not.toHaveBeenCalled();
  expect(createSite).toHaveBeenCalledWith(
    "HydroPowerPlant",
    hexToPixel(tile.q, tile.r),
    getHydroPowerPlantRotation(tile),
  );
  expect(sites[`${tile.q},${tile.r}`]).toBe(site);
  expect(models).toEqual({});
});

test("a wood storage under construction shows a blueprint, no log yard", () => {
  const { parts, createLogYard, createSite, sites, site, models } = setup();
  placeBuilding({ q: 0, r: 0 }, "WoodStorage", parts, true);
  expect(createLogYard).not.toHaveBeenCalled();
  expect(createSite).toHaveBeenCalledWith("WoodStorage", hexToPixel(0, 0), 0);
  expect(sites["0,0"]).toBe(site);
  expect(models).toEqual({});
});

test("a site without a model has no blueprint", () => {
  const { parts, createSite, sites } = setup();
  placeBuilding({ q: 0, r: 0 }, "Forest", parts, true);
  expect(createSite).not.toHaveBeenCalled();
  expect(sites).toEqual({});
});

test("blueprints on the footprint are disposed", () => {
  const { parts, siteDispose, sites, site } = setup();
  sites["1,0"] = site;
  placeBuilding({ q: 0, r: 0 }, "Farm", parts);
  expect(siteDispose).toHaveBeenCalledTimes(1);
  expect(sites["1,0"]).toBeUndefined();
});

test("a model building clears the footprint and shows its model", () => {
  const { parts, clearTile, create, models, model, update, setGrounds } =
    setup();
  placeBuilding({ q: 0, r: 0 }, "Farm", parts);
  expect(clearTile).toHaveBeenCalledTimes(7);
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0]).toHaveLength(7);
  // farms get farmland on their whole footprint
  expect(setGrounds).toHaveBeenCalledTimes(1);
  expect(setGrounds.mock.calls[0][0]).toHaveLength(7);
  expect(setGrounds.mock.calls[0][0]).toContainEqual({ q: 1, r: 0 });
  expect(setGrounds.mock.calls[0][1]).toBe(parts.materials.farmland);
  expect(create).toHaveBeenCalledWith("Farm", hexToPixel(0, 0));
  expect(models["0,0"]).toBe(model);
});

test("a construction site shows bare soil and a blueprint, no model", () => {
  const { parts, clearTile, create, createSite, models, update, setGrounds } =
    setup();
  placeBuilding({ q: 0, r: 0 }, "Farm", parts, true);
  expect(createSite).toHaveBeenCalledWith("Farm", hexToPixel(0, 0), 0);
  expect(clearTile).toHaveBeenCalledTimes(7);
  expect(update).toHaveBeenCalledTimes(1);
  expect(setGrounds).toHaveBeenCalledTimes(1);
  expect(setGrounds.mock.calls[0][1]).toBe(parts.materials.soil);
  expect(create).not.toHaveBeenCalled();
  expect(models).toEqual({});
});

test("previous models on the footprint are disposed", () => {
  const { parts, dispose, models, model } = setup();
  models["1,0"] = model;
  placeBuilding({ q: 0, r: 0 }, "Farm", parts);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(models["1,0"]).toBeUndefined();
});

test("a building without a model only changes trees and ground", () => {
  const { parts, clearTile, create, models, setGrounds } = setup();
  placeBuilding({ q: 0, r: 0 }, "Forest", parts);
  expect(clearTile).toHaveBeenCalled();
  expect(setGrounds).toHaveBeenCalledWith(
    [{ q: 0, r: 0 }],
    parts.materials.meadow,
  );
  expect(create).not.toHaveBeenCalled();
  expect(models).toEqual({});
});
