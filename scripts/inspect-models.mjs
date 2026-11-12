// Prints an inventory of every GLB in "ALL FOOTBALL/": size, dimensions, geometry, materials, textures.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "ALL FOOTBALL";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

for (const file of readdirSync(dir).filter((f) => /\.glb$/i.test(f)).sort()) {
  const path = join(dir, file);
  try {
    const doc = await io.read(path);
    const root = doc.getRoot();
    const scene = root.getDefaultScene() ?? root.listScenes()[0];
    const { min, max } = getBounds(scene);
    const dims = max.map((v, i) => +(v - min[i]).toFixed(3));
    let tris = 0;
    for (const mesh of root.listMeshes())
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        tris += (idx ? idx.getCount() : prim.getAttribute("POSITION").getCount()) / 3;
      }
    const mats = root.listMaterials().map((m) => {
      const slots = [];
      if (m.getBaseColorTexture()) slots.push("base");
      if (m.getNormalTexture()) slots.push("normal");
      if (m.getMetallicRoughnessTexture()) slots.push("mr");
      if (m.getOcclusionTexture()) slots.push("ao");
      if (m.getEmissiveTexture()) slots.push("emissive");
      return `${m.getName() || "(unnamed)"}[${slots.join("+") || "flat " + m.getBaseColorFactor().map((n) => n.toFixed(2)).join(",")}; r=${m.getRoughnessFactor()} m=${m.getMetallicFactor()}]`;
    });
    const texs = root.listTextures().map((t) => `${t.getMimeType().replace("image/", "")} ${t.getSize()?.join("x")} ${(t.getImage().byteLength / 1048576).toFixed(1)}MB`);
    console.log(`\n${file}  ${(statSync(path).size / 1048576).toFixed(1)}MB`);
    console.log(`  dims ${dims.join(" x ")} | meshes ${root.listMeshes().length} | tris ${Math.round(tris)} | ext ${root.listExtensionsUsed().map((e) => e.extensionName).join(",") || "none"}`);
    console.log(`  materials(${mats.length}): ${mats.join(" | ")}`);
    console.log(`  textures(${texs.length}): ${texs.join(" | ")}`);
  } catch (e) {
    console.log(`\n${file}  ERROR ${e.message}`);
  }
}
