// Builds web-ready copies of the original GLB models.
// Reads the originals in "ALL FOOTBALL/" (never modified), using the slug list in
// src/data/products/models.json, and writes public/models/footballs/<slug>.glb
// with WebP textures (max 2048px) and Meshopt-compressed geometry.
// With --lite it also writes smaller copies (1024px textures, about 40k triangles) to
// public/models/footballs/lite, which cards and secondary footballs load for speed.
// Usage: node scripts/optimize-models.mjs [--force] [--lite]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, simplify, textureCompress, meshopt } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "ALL FOOTBALL";
const MAX_TRIANGLES = 150_000;
const force = process.argv.includes("--force");
const lite = process.argv.includes("--lite");
const OUT = lite ? "public/models/footballs/lite" : "public/models/footballs";
const LITE_TRIANGLES = 40_000;

const models = JSON.parse(readFileSync("src/data/products/models.json", "utf8"));

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

mkdirSync(OUT, { recursive: true });
const mb = (p) => (statSync(p).size / 1048576).toFixed(1);

for (const { slug, source: file } of models) {
  const src = join(SRC, file);
  const out = join(OUT, `${slug}.glb`);
  if (existsSync(out) && !force) { console.log(`skip  ${out}`); continue; }

  const doc = await io.read(src);
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives())
      tris += (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3;

  const limit = lite ? LITE_TRIANGLES : MAX_TRIANGLES;
  const steps = [dedup(), prune(), weld()];
  if (tris > limit) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: limit / tris, error: lite ? 0.001 : 0.0005 }));
  steps.push(
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: lite ? [1024, 1024] : [2048, 2048], quality: lite ? 82 : 90 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await doc.transform(...steps);
  await io.write(out, doc);
  console.log(`done  ${file} ${mb(src)}MB -> ${out} ${mb(out)}MB`);
}
