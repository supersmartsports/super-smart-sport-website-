import type { PanelFamily, Product } from "@/types/product";
import models from "./models.json";

/**
 * The football collection.
 *
 * Every entry is built from one of the company's original 3D models. Facts shown
 * for a product come from the model file itself: panel configuration, the material
 * definition ("PU", "Thermobonded PU") and the measured diameter. Names are tidied
 * versions of the original file names. Nothing else is assumed; unconfirmed
 * specifications are null.
 */
type Entry = {
  name: string;
  family: PanelFamily;
  description: string;
  featured?: boolean;
};

const artworkNote = "Shown in SUPER SMART SPORTS artwork. Your colours, graphics and logo replace ours.";

const entries: Record<string, Entry> = {
  "hybrid-pro": {
    name: "Hybrid Pro",
    family: "32-panel",
    description: `A 32-panel design with a wide, clean wordmark panel. ${artworkNote}`,
    featured: true,
  },
  "32-panel-v5": {
    name: "32 Panel V5",
    family: "32-panel",
    description: `A 32-panel design with sweeping chevron bands. ${artworkNote}`,
    featured: true,
  },
  "20-panel": {
    name: "20 Panel",
    family: "20-panel",
    description: `A 20-panel thermo-bonded design with a dark cross layout. ${artworkNote}`,
    featured: true,
  },
  "gold-32-panel": {
    name: "Gold 32 Panel",
    family: "32-panel",
    description: `A 32-panel design in white and gold with flowing wave panels. ${artworkNote}`,
    featured: true,
  },
  "new-design-14-panel": {
    name: "New Design 14 Panel",
    family: "14-panel",
    description: `A 14-panel thermo-bonded design with a ringed centre panel for a large crest. ${artworkNote}`,
    featured: true,
  },
  "red-grey-design": {
    name: "Red Grey Design",
    family: "32-panel",
    description: `A 32-panel design with a grey and navy fragment print over red. ${artworkNote}`,
    featured: true,
  },
  "32-panel-v8": {
    name: "32 Panel V8",
    family: "32-panel",
    description: `A 32-panel design with geometric shard graphics. ${artworkNote}`,
  },
  "32-panel-4": {
    name: "32 Panel 4",
    family: "32-panel",
    description: `A 32-panel design with dotted and arrow-pattern panels. ${artworkNote}`,
  },
  "14-panel": {
    name: "14 Panel",
    family: "14-panel",
    description: `A 14-panel thermo-bonded design with a circular centre panel. ${artworkNote}`,
  },
  "sss-14-panel": {
    name: "SSS 14 Panel",
    family: "14-panel",
    description: `A 14-panel thermo-bonded design with a technical grey print. ${artworkNote}`,
  },
  "color-change-32-panel": {
    name: "Color Change 32 Panel",
    family: "32-panel",
    description: `A 32-panel design with a clean centre panel framed in red and black. ${artworkNote}`,
  },
  "hybrid-5-32-panel": {
    name: "Hybrid 5 32 Panel",
    family: "32-panel",
    description: `A 32-panel design with a textured navy and red frame. ${artworkNote}`,
  },
  "new-32-panel": {
    name: "New 32 Panel",
    family: "32-panel",
    description: `A 32-panel design with halftone red and navy bands. ${artworkNote}`,
  },
  "smart-32-panel": {
    name: "Smart 32 Panel",
    family: "32-panel",
    description: `A 32-panel design with a bold wordmark and angular side graphics. ${artworkNote}`,
  },
  "size-5-32-panel": {
    name: "Size 5 32 Panel",
    family: "32-panel",
    description: `A 32-panel design with a triangular navy and red frame. ${artworkNote}`,
  },
  "3-design": {
    name: "3 Design",
    family: "32-panel",
    description: `A 32-panel design with a starburst print in red and navy. ${artworkNote}`,
  },
  "32p-series-01": {
    name: "32P Series 01",
    family: "32-panel",
    description: `A 32-panel design with a hexagonal crest panel. ${artworkNote}`,
  },
  "32p-series-02": {
    name: "32P Series 02",
    family: "32-panel",
    description: `A 32-panel design with a red and navy swirl. ${artworkNote}`,
  },
  "32p-series-03": {
    name: "32P Series 03",
    family: "32-panel",
    description: `A 32-panel design with outlined hexagons and brushed colour. ${artworkNote}`,
  },
  "32p-series-04": {
    name: "32P Series 04",
    family: "32-panel",
    description: `A 32-panel design with a framed hexagon and brush strokes. ${artworkNote}`,
  },
};

const familyFacts: Record<PanelFamily, Pick<Product, "panelCount" | "construction" | "material">> = {
  // The 14 and 20 panel models carry a "Thermobonded PU" material; the 32 panel models carry "PU" only.
  "32-panel": { panelCount: 32, construction: null, material: "PU" },
  "20-panel": { panelCount: 20, construction: "Thermo-bonded", material: "PU" },
  "14-panel": { panelCount: 14, construction: "Thermo-bonded", material: "PU" },
};

export const products: Product[] = models.map(({ slug, source }, index) => {
  const entry = entries[slug];
  if (!entry) throw new Error(`No product entry for model "${slug}"`);
  return {
    slug,
    sku: `SSS-FB-${String(index + 1).padStart(3, "0")}`,
    name: entry.name,
    sourceModel: source,
    model: `/models/footballs/${slug}.glb`,
    poster: `/images/footballs/${slug}.webp`,
    images: [],
    family: entry.family,
    ...familyFacts[entry.family],
    modelDiameterCm: 22,
    description: entry.description,
    featured: entry.featured ?? false,
  };
});

export const featuredProducts = products.filter((product) => product.featured);

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

/** The football shown in the homepage hero. */
export const heroProduct = getProduct("new-design-14-panel")!;
