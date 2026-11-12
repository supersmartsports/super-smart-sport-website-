// Builds web-ready copies of the original GLB models.
// Reads the originals in "ALL FOOTBALL/" (never modified), using the slug list in
// src/data/products/models.json, and writes public/models/footballs/<slug>.glb
// with WebP textures (max 2048px) and Meshopt-compressed geometry.
// Usage: node scripts/optimize-models.mjs [--force]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, simplify, textureCompress, meshopt } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "ALL FOOTBALL";
const OUT = "public/models/footballs";
const MAX_TRIANGLES = 150_000;
const force = process.argv.includes("--force");

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

  const steps = [dedup(), prune(), weld()];
  if (tris > MAX_TRIANGLES)
    steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIANGLES / tris, error: 0.0005 }));
  steps.push(
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [2048, 2048], quality: 90 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await doc.transform(...steps);
  await io.write(out, doc);
  console.log(`done  ${file} ${mb(src)}MB -> ${out} ${mb(out)}MB`);
}
