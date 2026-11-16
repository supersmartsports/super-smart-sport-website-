"use client";

import { m as motion, useReducedMotion } from "motion/react";
import { routes } from "@/config/site";
import type { Product } from "@/types/product";
import { FootballViewer } from "@/components/3d-viewer/FootballViewer";
import { ButtonLink } from "@/components/buttons/Button";

const ease = [0.16, 1, 0.3, 1] as const;

const headline = ["Engineered for", "the game.", "Manufactured", "for your brand."];

const facts = [
  "Match, training and futsal footballs",
  "Your logo, colours and graphics",
  "Private-label manufacturing",
  "Bulk orders, exported worldwide",
];

export function HomeHero({ product }: { product: Product }) {
  const reducedMotion = useReducedMotion();
  const rise = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease },
        };

  return (
    <section className="relative isolate overflow-hidden bg-navy-deep text-white">
      {/* Studio backdrop: one pool of brand navy behind the ball. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[38%] left-1/2 -z-10 aspect-square w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-navy)_0%,transparent_100%)] lg:top-1/2 lg:left-[72%] lg:w-[78vw]"
      />

      <div className="shell grid min-h-[100svh] grid-rows-[1fr_auto] pt-24 lg:pt-28">
        <div className="grid items-center gap-2 lg:grid-cols-12 lg:gap-0">
          <div className="pointer-events-none relative z-10 lg:col-span-7 lg:py-10 [&_a]:pointer-events-auto">
            <h1 className="type-display">
              {headline.map((line, index) => (
                <span key={line} className="block overflow-hidden pb-[0.06em] whitespace-nowrap">
                  <motion.span
                    className="block"
                    {...(reducedMotion
                      ? {}
                      : {
                          initial: { y: "105%" },
                          animate: { y: 0 },
                          transition: { duration: 0.9, delay: 0.08 * index, ease },
                        })}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p {...rise(0.45)} className="type-lead mt-7 hidden max-w-[46ch] text-white/80 lg:block">
              Premium customized football manufacturing, engineered around your designs, specifications and brand
              identity.
            </motion.p>
            <motion.div {...rise(0.55)} className="mt-9 hidden flex-wrap gap-3 lg:flex">
              <ButtonLink href={routes.quote} size="lg">
                Start Your Custom Project
              </ButtonLink>
              <ButtonLink href={routes.products} variant="outline-light" size="lg">
                Explore Our Footballs
              </ButtonLink>
            </motion.div>
          </div>

          <motion.div
            className="relative mx-auto w-[min(88vw,58svh)] lg:col-span-5 lg:mx-0 lg:w-[128%] lg:max-w-[54rem] lg:justify-self-center"
            {...(reducedMotion
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.92 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { duration: 1.2, delay: 0.15, ease },
                })}
          >
            <FootballViewer
              modelUrl={product.model}
              poster={product.poster}
              name={product.name}
              eager
              posterPriority
              posterSizes="(min-width: 1024px) 54vw, 88vw"
            />
            <p className="pointer-events-none absolute bottom-0 left-1/2 hidden -translate-x-1/2 text-sm text-white/45 lg:block">
              Drag to rotate
            </p>
          </motion.div>

          {/* On small screens the message follows the ball, so the product leads. */}
          <div className="pb-8 lg:hidden">
            <p className="type-lead text-white/80">
              Premium customized football manufacturing, engineered around your designs, specifications and brand
              identity.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <ButtonLink href={routes.quote} size="lg">
                Start Your Custom Project
              </ButtonLink>
              <ButtonLink href={routes.products} variant="outline-light" size="lg">
                Explore Our Footballs
              </ButtonLink>
            </div>
          </div>
        </div>

        <motion.ul
          {...rise(0.7)}
          className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4"
          aria-label="What we manufacture"
        >
          {facts.map((fact, index) => (
            <li
              key={fact}
              className={`py-5 pr-4 text-sm leading-snug font-medium text-white/80 lg:py-7 lg:text-[0.9375rem] ${
                index > 0 ? "lg:border-l lg:border-white/15 lg:pl-6" : ""
              } ${index % 2 === 1 ? "border-l border-white/15 pl-4" : ""} ${index > 1 ? "border-t border-white/15 lg:border-t-0" : ""}`}
            >
              {fact}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
