import type { PanelFamily } from "@/types/product";

/** Collection groups, based on the panel configuration of the original 3D models. */
export const panelFamilies: { id: PanelFamily; label: string; summary: string }[] = [
  {
    id: "32-panel",
    label: "32 panel",
    summary: "The classic configuration of hexagons and pentagons.",
  },
  {
    id: "20-panel",
    label: "20 panel",
    summary: "Fewer, larger panels with long uninterrupted print areas.",
  },
  {
    id: "14-panel",
    label: "14 panel",
    summary: "Large panels for bold, continuous artwork.",
  },
];

/** What a customer can order any design as. These are order options, not separate stock lines. */
export const footballTypes = ["Match football", "Training football", "Futsal football"] as const;
