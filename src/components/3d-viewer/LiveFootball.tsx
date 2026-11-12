import { getProduct } from "@/data/products";
import { FootballViewer, type FootballViewerProps } from "./FootballViewer";

/**
 * A rotating 3D football for any section of the site, chosen by its product slug.
 * It goes live while on screen and can be dragged like every other viewer.
 */
export function LiveFootball({
  slug,
  ...props
}: { slug: string } & Omit<FootballViewerProps, "modelUrl" | "poster" | "name">) {
  const product = getProduct(slug);
  if (!product) return null;
  return <FootballViewer modelUrl={product.model} poster={product.poster} name={product.name} {...props} />;
}
