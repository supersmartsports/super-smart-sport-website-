"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { routes } from "@/config/site";
import { getProduct, products } from "@/data/products";
import {
  brandingOptions,
  colorSwatches,
  constructionOptions,
  materialOptions,
  originalColors,
  sizeOptions,
  typeOptions,
} from "@/features/football-customization/options";
import { FootballViewer } from "@/components/3d-viewer/FootballViewer";
import { ButtonLink } from "@/components/buttons/Button";

function Panel({ step, title, hint, children }: { step: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/15 py-7">
      <h2 className="flex items-baseline gap-3 text-white">
        <span aria-hidden className="type-h3 text-red tabular-nums">
          {String(step).padStart(2, "0")}
        </span>
        <span className="type-h3">{title}</span>
      </h2>
      {hint && <p className="mt-2 text-sm text-white/60">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={`min-h-11 rounded-xs px-4 text-sm font-semibold transition-colors ${
              selected ? "bg-white text-navy-deep" : "text-white ring-1 ring-white/25 hover:ring-white"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = `color-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <p id={`${id}-label`} className="type-label text-white/60">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="mt-3 flex flex-wrap gap-2">
        {colorSwatches.map((swatch) => {
          const selected = swatch.value === value;
          return (
            <button
              key={swatch.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={swatch.name}
              title={swatch.name}
              onClick={() => onChange(swatch.value)}
              className={`size-11 rounded-full ring-offset-2 ring-offset-navy-deep transition-shadow ${
                selected ? "ring-2 ring-white" : "ring-1 ring-white/30 hover:ring-white/70"
              }`}
              style={{ backgroundColor: swatch.value }}
            />
          );
        })}
        <label
          htmlFor={id}
          className="relative grid size-11 cursor-pointer place-items-center overflow-hidden rounded-full text-xs font-bold text-white ring-1 ring-white/30 hover:ring-white/70"
          title="Choose any colour"
        >
          <span aria-hidden>+</span>
          <span className="sr-only">{label}: choose any colour</span>
          <input
            id={id}
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

export function DesignStudio() {
  const searchParams = useSearchParams();
  const [slug, setSlug] = useState(products[0].slug);
  const [type, setType] = useState<(typeof typeOptions)[number]>(typeOptions[0]);
  const [size, setSize] = useState<(typeof sizeOptions)[number]>(sizeOptions[0]);
  const [construction, setConstruction] = useState<(typeof constructionOptions)[number]>("Not sure, please advise");
  const [material, setMaterial] = useState<(typeof materialOptions)[number]>(materialOptions[0]);
  const [primary, setPrimary] = useState<string>(originalColors.primary);
  const [secondary, setSecondary] = useState<string>(originalColors.secondary);
  const [branding, setBranding] = useState<string[]>([brandingOptions[0]]);
  const [logo, setLogo] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    const requested = searchParams.get("design");
    if (requested && getProduct(requested)) setSlug(requested);
  }, [searchParams]);

  // The uploaded logo never leaves the browser; release it when replaced or on leaving the page.
  useEffect(() => () => {
    if (logo) URL.revokeObjectURL(logo.url);
  }, [logo]);

  const product = getProduct(slug) ?? products[0];
  const colorsChanged = primary !== originalColors.primary || secondary !== originalColors.secondary;
  const recolor = useMemo(() => (colorsChanged ? { primary, secondary } : null), [colorsChanged, primary, secondary]);

  const quoteHref = useMemo(() => {
    const params = new URLSearchParams({ design: product.slug, type, size, construction, material });
    if (colorsChanged) {
      params.set("primary", primary);
      params.set("secondary", secondary);
    }
    if (branding.length) params.set("branding", branding.join(", "));
    return `${routes.quote}?${params.toString()}`;
  }, [product.slug, type, size, construction, material, colorsChanged, primary, secondary, branding]);

  const reset = () => {
    setPrimary(originalColors.primary);
    setSecondary(originalColors.secondary);
  };

  const summary: [string, string][] = [
    ["Design", `${product.name} (${product.panelCount} panel)`],
    ["Type", type],
    ["Size", size],
    ["Construction", construction],
    ["Material", material],
    ["Colours", colorsChanged ? `${primary.toUpperCase()} and ${secondary.toUpperCase()}` : "As shown"],
    ["Branding", branding.length ? branding.join(", ") : "None selected"],
  ];

  return (
    <div className="grid gap-x-12 lg:grid-cols-12">
      {/* Preview */}
      <div className="lg:col-span-6 xl:col-span-7">
        <div className="sticky top-[4.5rem] z-10 -mx-5 bg-navy-deep px-5 pb-3 lg:top-24 lg:mx-0 lg:px-0">
          <div className="relative overflow-hidden rounded-sm bg-[radial-gradient(closest-side,var(--color-navy)_0%,transparent_100%)]">
            <FootballViewer
              key={product.slug}
              modelUrl={product.model}
              poster={product.poster}
              name={product.name}
              eager
              recolor={recolor}
              posterSizes="(min-width: 1024px) 55vw, 100vw"
              className="mx-auto max-w-[min(100%,34svh)] lg:max-w-[min(100%,70svh)]"
            />
            {logo && (
              <div className="absolute top-4 left-4 flex items-center gap-3 rounded-xs bg-white p-2 pr-4 shadow-overlay">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded */}
                <img src={logo.url} alt="Your uploaded logo" className="size-14 object-contain" />
                <span className="text-xs leading-tight font-semibold text-navy-deep">
                  Your logo
                  <span className="block font-normal text-slate">Placed by us on your proof</span>
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-white/55 lg:mt-3 lg:text-sm">
            {colorsChanged
              ? "Colour preview is indicative. It repaints our artwork in your colours; your approved artwork defines the final football."
              : "Drag the football to rotate it. Pick colours to preview them on this design."}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-10 lg:col-span-6 lg:mt-0 xl:col-span-5">
        <Panel step={1} title="Choose a design" hint="Start from one of our footballs. Its panel layout carries over to yours.">
          <div role="radiogroup" aria-label="Design" className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-5">
            {products.map((item) => {
              const selected = item.slug === product.slug;
              return (
                <button
                  key={item.slug}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${item.name}, ${item.panelCount} panel`}
                  title={item.name}
                  onClick={() => setSlug(item.slug)}
                  className={`relative aspect-square rounded-xs p-1.5 transition-colors ${
                    selected ? "bg-white/15 ring-2 ring-red" : "bg-white/5 ring-1 ring-white/10 hover:ring-white/50"
                  }`}
                >
                  <Image src={item.poster} alt="" fill sizes="96px" className="object-contain p-1.5" />
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-white" aria-live="polite">
            {product.name} <span className="text-white/55">/ {product.panelCount} panel</span>
          </p>
        </Panel>

        <Panel step={2} title="Type and size">
          <div className="grid gap-4">
            <ChoiceGroup label="Football type" options={typeOptions} value={type} onChange={setType} />
            <ChoiceGroup label="Size" options={sizeOptions} value={size} onChange={setSize} />
          </div>
        </Panel>

        <Panel step={3} title="Colours" hint="Replace the navy and red of our artwork with your brand colours.">
          <div className="grid gap-6">
            <ColorPicker label="Main colour" value={primary} onChange={setPrimary} />
            <ColorPicker label="Second colour" value={secondary} onChange={setSecondary} />
            {colorsChanged && (
              <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-white underline-offset-4 hover:underline">
                <RotateCcw aria-hidden className="size-4" />
                Back to the original colours
              </button>
            )}
          </div>
        </Panel>

        <Panel step={4} title="Material and construction">
          <div className="grid gap-4">
            <ChoiceGroup label="Surface material" options={materialOptions} value={material} onChange={setMaterial} />
            <ChoiceGroup label="Construction" options={constructionOptions} value={construction} onChange={setConstruction} />
          </div>
        </Panel>

        <Panel step={5} title="Logo and branding" hint="Your logo stays on your device. Send the file with your quote request.">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xs px-4 text-sm font-semibold text-white ring-1 ring-white/25 focus-within:ring-2 focus-within:ring-red hover:ring-white">
              <ImagePlus aria-hidden className="size-4" />
              {logo ? "Change logo" : "Add your logo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setLogo({ url: URL.createObjectURL(file), name: file.name });
                  event.target.value = "";
                }}
              />
            </label>
            {logo && (
              <button type="button" onClick={() => setLogo(null)} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-white/70 hover:text-white">
                <X aria-hidden className="size-4" />
                Remove {logo.name}
              </button>
            )}
          </div>
          <ul className="mt-5 grid gap-1">
            {brandingOptions.map((option) => {
              const checked = branding.includes(option);
              return (
                <li key={option}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-white/85 hover:text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setBranding((current) => (checked ? current.filter((item) => item !== option) : [...current, option]))}
                      className="size-5 accent-red"
                    />
                    {option}
                  </label>
                </li>
              );
            })}
          </ul>
        </Panel>

        <section aria-labelledby="brief-heading" className="mt-2 rounded-sm bg-white p-6 text-navy-deep sm:p-8">
          <h2 id="brief-heading" className="type-h3">
            Your brief
          </h2>
          <dl className="mt-4 border-t border-line">
            {summary.map(([term, detail]) => (
              <div key={term} className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-line py-2.5 text-sm">
                <dt className="type-label pt-0.5 text-slate">{term}</dt>
                <dd className="font-semibold">
                  {term === "Colours" && colorsChanged && (
                    <span aria-hidden className="mr-2 inline-flex translate-y-0.5 gap-1">
                      <span className="size-3.5 rounded-full ring-1 ring-line" style={{ backgroundColor: primary }} />
                      <span className="size-3.5 rounded-full ring-1 ring-line" style={{ backgroundColor: secondary }} />
                    </span>
                  )}
                  {detail}
                </dd>
              </div>
            ))}
          </dl>
          <ButtonLink href={quoteHref} size="lg" className="mt-6 w-full">
            Request a quote with this brief
          </ButtonLink>
          <p className="mt-3 text-sm text-slate">Your choices are carried into the quote form. Nothing is sent until you send it.</p>
        </section>
      </div>
    </div>
  );
}
