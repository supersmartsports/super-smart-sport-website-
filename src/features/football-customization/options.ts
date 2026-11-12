/**
 * Choices offered in the customization studio and the quote form.
 * They are ways for a customer to state requirements; the final specification
 * is always confirmed by SUPER SMART SPORTS in the quote.
 */
export const typeOptions = ["Match football", "Training football", "Futsal football"] as const;
export const sizeOptions = ["Size 5", "Size 4", "Size 3", "Not sure, please advise"] as const;
export const constructionOptions = ["Stitched", "Thermo-bonded", "Not sure, please advise"] as const;
export const materialOptions = ["PU", "Other (I will describe it)", "Not sure, please advise"] as const;
export const brandingOptions = [
  "Logo on the main panel",
  "Logo repeated around the football",
  "Sponsor logos",
  "Custom text, such as a club name",
  "Private-label branding",
] as const;

/** Colours of the original SUPER SMART SPORTS artwork. With these selected the model is shown untouched. */
export const originalColors = { primary: "#080e65", secondary: "#ed101a" } as const;

export const colorSwatches = [
  { name: "Navy", value: "#080e65" },
  { name: "Red", value: "#ed101a" },
  { name: "Black", value: "#111114" },
  { name: "Royal blue", value: "#1447c8" },
  { name: "Sky blue", value: "#35a7e8" },
  { name: "Green", value: "#0c8a43" },
  { name: "Yellow", value: "#f6c915" },
  { name: "Orange", value: "#f26a12" },
  { name: "Purple", value: "#6a25b8" },
  { name: "Pink", value: "#e8358f" },
] as const;

/** Query-string keys used to carry a studio brief into the quote form. */
export type BriefParams = {
  design?: string;
  type?: string;
  size?: string;
  construction?: string;
  material?: string;
  primary?: string;
  secondary?: string;
  branding?: string;
};
