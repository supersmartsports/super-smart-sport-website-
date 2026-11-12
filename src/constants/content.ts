/**
 * Shared page content. It describes the capabilities the company has confirmed
 * (custom logos, colours, graphics, panel designs, materials, construction methods,
 * match / training / futsal footballs, private label, bulk orders, export).
 * It deliberately contains no numbers, certifications or history, because none
 * have been confirmed. Have the company review this wording before launch.
 */

export const capabilities = [
  {
    title: "Your logo",
    text: "Club crests, brand marks and sponsor logos are printed on the panels where you want them.",
  },
  {
    title: "Your colours",
    text: "Panels, graphics and print are matched to your brand colours.",
  },
  {
    title: "Your graphics",
    text: "Send finished artwork, or a brief, and we lay it out across the panels.",
  },
  {
    title: "Panel design",
    text: "Choose a panel configuration, such as 32, 20 or 14 panels, to suit your design.",
  },
  {
    title: "Surface material",
    text: "The outer material and its texture are selected to match how the football will be used.",
  },
  {
    title: "Construction",
    text: "Stitched or thermo-bonded, specified for match play, training or futsal.",
  },
] as const;

export const processSteps = [
  {
    title: "Football engineering",
    text: "Every order starts with your brief: the type of football, its size, the panel configuration and how it will be used. That defines the construction before any material is cut.",
  },
  {
    title: "Material selection",
    text: "The surface material and the layers beneath it are chosen to match your specification and intended use.",
  },
  {
    title: "Panel preparation",
    text: "Panels are cut to the pattern of the configuration you selected, ready for print.",
  },
  {
    title: "Printing and branding",
    text: "Your logo, colours and graphics are applied to the panels, following your approved artwork.",
  },
  {
    title: "Stitching",
    text: "For stitched constructions, the printed panels are joined with thread into the finished shape.",
  },
  {
    title: "Thermal bonding",
    text: "For thermo-bonded constructions, the panels are joined with heat instead of thread, leaving a seamless surface.",
  },
  {
    title: "Quality inspection",
    text: "Finished footballs are inspected before they are approved for packing.",
  },
  {
    title: "Final product presentation",
    text: "Approved footballs are finished and packed as agreed, ready for export to you.",
  },
] as const;

export const qualityPoints = [
  {
    title: "Material standards",
    text: "Materials are selected against the specification agreed for your order, not substituted along the way.",
  },
  {
    title: "Construction quality",
    text: "Seams, whether stitched or bonded, are what hold a football together. They get the closest attention.",
  },
  {
    title: "Surface finishing",
    text: "Print, colour and surface texture are checked against your approved artwork.",
  },
  {
    title: "Product inspection",
    text: "Footballs are inspected before packing, so problems are caught at the factory and not on your pitch.",
  },
  {
    title: "Consistency",
    text: "A bulk order should look and feel like one football repeated. We work to keep every piece in line with the first.",
  },
  {
    title: "Manufacturing precision",
    text: "Accurate panels make a round, balanced football. Precision starts at cutting and carries through assembly.",
  },
] as const;

export const constructionTypes = [
  {
    slug: "new-32-panel",
    panels: "32 panel",
    text: "The classic layout of hexagons and pentagons, and the widest choice of graphic styles in our collection.",
  },
  {
    slug: "20-panel",
    panels: "20 panel",
    text: "Fewer, larger panels. Shown here in a thermo-bonded construction with a seamless surface.",
  },
  {
    slug: "14-panel",
    panels: "14 panel",
    text: "Large panels that carry bold, continuous artwork. Shown here in a thermo-bonded construction.",
  },
] as const;
