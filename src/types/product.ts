export type PanelFamily = "32-panel" | "20-panel" | "14-panel";

/**
 * A football design that SUPER SMART SPORTS can manufacture to order.
 * It is a manufacturing reference, not an inventory item: there is no price,
 * stock level or cart. Fields that the company has not confirmed stay null
 * and the interface shows them as "specified per order".
 */
export type Product = {
  slug: string;
  /** Website design reference. Replace with the company's own SKU when available. */
  sku: string;
  name: string;
  /** Original file in "ALL FOOTBALL/" that this product's 3D model was built from. */
  sourceModel: string;
  model: string;
  poster: string;
  /** Additional photography. Empty until real product photos are supplied. */
  images: string[];
  family: PanelFamily;
  panelCount: number;
  /** Taken from the material definition inside the 3D model. */
  construction: string | null;
  material: string | null;
  /** Diameter of the 3D model in centimetres, measured from the file. */
  modelDiameterCm: number;
  description: string;
  featured: boolean;
};
