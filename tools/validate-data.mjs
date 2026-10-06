/**
 * Validates everything under data/ against the schemas that describe it.
 *
 * Three separate checks, because a file can be schema-valid and still be
 * broken in ways that only show up at runtime:
 *
 *  1. Schema conformance. The schemas are written against two JSON Schema
 *     drafts - main-menu is draft-07, the rest are 2020-12 - so each file is
 *     compiled with the ajv build that understands its `$schema`.
 *  2. Asset references. Every `assets/...` string in the data must name a file
 *     that exists, or the screen that uses it renders an empty box.
 *  3. Menu targets. A target with no dot is a page key and must resolve to a
 *     real page, otherwise selecting the item goes nowhere.
 *
 * Run directly (`npm run validate:data`) or import `validateAll` - the unit
 * suite calls it so a bad data edit fails `npm test`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const at = (...parts) => path.join(root, ...parts);
const load = (relative) => JSON.parse(fs.readFileSync(at(relative), "utf8"));

/**
 * Assets the data references on purpose but which have not been produced yet.
 *
 * Listed rather than ignored so the debt stays visible and so any *other*
 * missing reference still fails. Remove an entry once the file lands.
 *
 * Currently empty: the arena environment GLBs that used to live here are
 * promoted out of assets/source by `npm run assets:promote`.
 */
const PENDING_ASSETS = new Map([]);

/**
 * Assets the code needs but no data file names, so scanning the JSON would
 * never notice them going missing.
 */
const REQUIRED_ASSETS = new Map([
  [
    "assets/runtime/models/ring-standard.glb",
    "the ring, loaded by GameScene and the arena viewer",
  ],
  [
    "assets/glb/arena/ring-steps.glb",
    "placed twice by the arena renderer",
  ],
]);

/** Which schema governs which data files. */
function schemaTargets() {
  const arenas = fs
    .readdirSync(at("data/arenas"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => `data/arenas/${f}`);

  return [
    ["data/schemas/main-menu.schema.json", ["data/ui/main-menu.json"]],
    ["data/schemas/arenas.schema.json", arenas],
    ["data/schemas/stages.schema.json", ["data/stages.json"]],
    ["data/schemas/moves.schema.json", ["data/moves/moves.json"]],
    ["data/schemas/move-slots.schema.json", ["data/moves/move-slots.json"]],
    ["data/schemas/combat-styles.schema.json", ["data/styles/styles.json"]],
    ["data/schemas/stances.schema.json", ["data/stances/stances.json"]],
    ["data/schemas/techniques.schema.json", ["data/combat/techniques.json"]],
    ["data/schemas/positions.schema.json", ["data/combat/positions.json"]],
    ["data/schemas/transitions.schema.json", ["data/combat/transitions.json"]],
    ["data/schemas/style-techniques.schema.json", ["data/styles/style-techniques.json"]],
    ["data/schemas/rulesets.schema.json", ["data/game/rulesets.json"]],
    ["data/schemas/competition.schema.json", ["data/game/competition.json"]],
    ["data/schemas/cosmetics.schema.json", ["data/cosmetics/catalog.json"]],
  ];
}

/** Picks the ajv build matching the schema's declared draft. */
function compilerFor(schema) {
  const draft = String(schema.$schema ?? "");
  const Ctor = draft.includes("2020-12") ? Ajv2020 : Ajv;
  // strict:false because the schemas use annotation keywords (title inside
  // anyOf branches) that ajv would otherwise flag.
  return new Ctor({ allErrors: true, strict: false });
}

function checkSchemas(errors) {
  for (const [schemaPath, dataPaths] of schemaTargets()) {
    const schema = load(schemaPath);
    let validate;
    try {
      validate = compilerFor(schema).compile(schema);
    } catch (e) {
      errors.push(`${schemaPath}: will not compile - ${e.message}`);
      continue;
    }
    for (const dataPath of dataPaths) {
      if (validate(load(dataPath))) continue;
      for (const e of validate.errors) {
        const where = e.instancePath || "(root)";
        errors.push(`${dataPath}${where}: ${e.message}`);
      }
    }
  }
}

/** Every `assets/...` string anywhere in the data files, with its source. */
function assetReferences() {
  const refs = new Map();
  const visit = (node, from) => {
    if (typeof node === "string") {
      if (node.startsWith("assets/")) {
        if (!refs.has(node)) refs.set(node, new Set());
        refs.get(node).add(from);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) visit(child, from);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        // `$schema` points at a schema file, not an asset.
        if (key !== "$schema") visit(value, from);
      }
    }
  };

  const arenaFiles =
    schemaTargets().find(([schema]) => schema.endsWith("arenas.schema.json"))?.[1] ??
    [];
  const files = ["data/ui/main-menu.json", "data/stages.json", ...arenaFiles];
  for (const file of files) visit(load(file), file);
  return refs;
}

function checkAssets(errors, notes) {
  for (const [asset, sources] of assetReferences()) {
    if (fs.existsSync(at(asset))) continue;
    const from = [...sources].sort();
    const pending = PENDING_ASSETS.get(asset);
    if (pending) {
      notes.push(`pending: ${asset} (${pending}) - ${from.length} file(s)`);
      continue;
    }
    errors.push(`missing asset ${asset}, referenced by ${from.join(", ")}`);
  }

  for (const [asset, why] of REQUIRED_ASSETS) {
    if (fs.existsSync(at(asset))) continue;
    errors.push(
      `missing asset ${asset} (${why}). ` +
        `If it is in assets/source, run \`npm run assets:promote\`.`
    );
  }
}

function checkStyleStances(errors) {
  const styles = load("data/styles/styles.json").styles;
  const stances = load("data/stances/stances.json").stances;
  const ids = new Set(stances.map((s) => s.stance_id));
  for (const style of styles) {
    if (!ids.has(style.default_stance)) {
      errors.push(
        `data/styles/styles.json: ${style.style_id} references missing stance "${style.default_stance}"`
      );
    }
  }
}


function checkMayQuvReferences(errors) {
  const positions = load("data/combat/positions.json").positions;
  const transitions = load("data/combat/transitions.json").transitions;
  const techniques = load("data/combat/techniques.json").techniques;
  const styles = load("data/styles/styles.json").styles;
  const styleTechniques = load("data/styles/style-techniques.json").styles;
  const rulesets = load("data/game/rulesets.json").rulesets;
  const competition = load("data/game/competition.json").modes;
  const cosmetics = load("data/cosmetics/catalog.json");

  const positionIds = new Set(positions.map((x) => x.position_id));
  const techniqueIds = new Set(techniques.map((x) => x.technique_id));
  const styleIds = new Set(styles.map((x) => x.style_id));
  const rulesetIds = new Set(rulesets.map((x) => x.ruleset_id));
  const cosmeticCategories = new Set(cosmetics.categories);

  for (const t of transitions) {
    if (!positionIds.has(t.from)) errors.push(`transition ${t.transition_id} missing from-position ${t.from}`);
    if (!positionIds.has(t.to)) errors.push(`transition ${t.transition_id} missing to-position ${t.to}`);
  }

  const mappedStyles = new Set();
  for (const mapping of styleTechniques) {
    if (!styleIds.has(mapping.style_id)) errors.push(`style-techniques references missing style ${mapping.style_id}`);
    mappedStyles.add(mapping.style_id);
    for (const id of mapping.technique_ids) {
      if (!techniqueIds.has(id)) errors.push(`style ${mapping.style_id} references missing technique ${id}`);
    }
  }
  for (const id of styleIds) {
    if (!mappedStyles.has(id)) errors.push(`style ${id} has no technique mapping`);
  }

  for (const mode of competition) {
    if (!rulesetIds.has(mode.ruleset_id)) errors.push(`mode ${mode.mode_id} references missing ruleset ${mode.ruleset_id}`);
  }

  for (const item of cosmetics.items) {
    if (!cosmeticCategories.has(item.category)) errors.push(`cosmetic ${item.id} uses unknown category ${item.category}`);
  }

  const standard = rulesets.find((x) => x.ruleset_id === "may_quv_standard");
  if (!standard || standard.players !== 2 || standard.team_size !== 1 || standard.hp_max !== 100 || standard.normal_tko !== false) {
    errors.push("may_quv_standard must remain 1v1, 100 HP, and no normal TKO");
  }
}

function checkMenuTargets(errors) {
  const menu = load("data/ui/main-menu.json");
  const pages = Object.keys(menu.pages);
  for (const [pageKey, page] of Object.entries(menu.pages)) {
    for (const item of page.menuItems) {
      // Dotted targets are application routes; only bare page keys are
      // resolved by the menu itself.
      if (item.target.includes(".")) continue;
      if (pages.includes(item.target)) continue;
      errors.push(
        `data/ui/main-menu.json: ${pageKey}.${item.id} targets page "${item.target}", which does not exist`
      );
    }
  }
}

/** Runs every check. Returns errors (fatal) and notes (documented debt). */
export function validateAll() {
  const errors = [];
  const notes = [];
  checkSchemas(errors);
  checkAssets(errors, notes);
  checkMenuTargets(errors);
  checkStyleStances(errors);
  checkMayQuvReferences(errors);
  return { errors, notes };
}

// CLI entry point.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, notes } = validateAll();
  for (const note of notes) console.log(`note   ${note}`);
  for (const error of errors) console.error(`ERROR  ${error}`);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s) in data/`);
    process.exit(1);
  }
  console.log(`\ndata/ is valid${notes.length ? ` (${notes.length} pending asset(s))` : ""}`);
}
