/**
 * Shared page content, kept short on purpose. It describes only the capabilities the
 * company has confirmed (custom logos, colours, graphics, panel designs, materials,
 * construction methods, match / training / futsal footballs, private label, bulk orders,
 * export). It contains no numbers, certifications or history, because none have been
 * confirmed. Have the company review this wording before launch.
 */

export const capabilities = [
  { title: "Your logo", text: "Printed where you want it." },
  { title: "Your colours", text: "Matched to your brand." },
  { title: "Your graphics", text: "From your artwork or brief." },
  { title: "Panel design", text: "32, 20 or 14 panels." },
  { title: "Surface material", text: "Chosen for how it is used." },
  { title: "Construction", text: "Stitched or thermo-bonded." },
] as const;

export const processSteps = [
  { title: "Football engineering", text: "Your brief becomes the construction." },
  { title: "Material selection", text: "Matched to your specification." },
  { title: "Panel preparation", text: "Cut to your panel layout." },
  { title: "Printing and branding", text: "Your artwork, applied." },
  { title: "Stitching", text: "Panels joined with thread." },
  { title: "Thermal bonding", text: "Panels joined with heat." },
  { title: "Quality inspection", text: "Checked before packing." },
  { title: "Final product presentation", text: "Finished and packed as agreed." },
] as const;

export const qualityPoints = [
  { title: "Material standards", text: "Materials follow your agreed specification." },
  { title: "Construction quality", text: "Seams get the closest attention." },
  { title: "Surface finishing", text: "Print and texture checked against your artwork." },
  { title: "Product inspection", text: "Inspected before packing." },
  { title: "Consistency", text: "Every football in an order matches the first." },
  { title: "Manufacturing precision", text: "Accurate panels make a round ball." },
] as const;

export const constructionTypes = [
  { slug: "new-32-panel", panels: "32 panel", text: "The classic layout." },
  { slug: "20-panel", panels: "20 panel", text: "Fewer, larger panels. Thermo-bonded." },
  { slug: "14-panel", panels: "14 panel", text: "Large panels. Thermo-bonded." },
] as const;
