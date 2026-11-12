import { FaWhatsapp } from "react-icons/fa6";
import { routes, site } from "@/config/site";
import { LiveFootball } from "@/components/3d-viewer/LiveFootball";
import { ButtonAnchor, ButtonLink } from "@/components/buttons/Button";

type Props = {
  title?: string;
  text?: string;
  /** Poster path of the football to show. It rotates in live 3D. */
  poster?: string;
};

/** Closing call to action. The one full red surface on a page. */
export function QuoteCta({
  title = "Start your custom project",
  text = "Tell us the type of football, the quantity and how you want it branded. We reply with what we need to prepare your quote.",
  poster = "/images/footballs/32-panel-v5.webp",
}: Props) {
  return (
    <section className="on-red relative overflow-hidden bg-red text-white">
      <div className="shell relative grid items-center gap-10 py-20 lg:grid-cols-[1.4fr_1fr] lg:py-28">
        <div>
          <h2 className="type-h1">{title}</h2>
          <p className="type-lead mt-6 max-w-[52ch] text-white/90">{text}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={routes.quote} variant="light" size="lg">
              Request a Quote
            </ButtonLink>
            <ButtonAnchor href={site.contact.whatsappUrl} variant="outline-light" size="lg">
              <FaWhatsapp aria-hidden className="size-5" />
              Discuss your requirements
            </ButtonAnchor>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[17rem] lg:max-w-lg">
          <LiveFootball slug={poster.split("/").pop()!.replace(".webp", "")} posterSizes="(min-width: 1024px) 32rem, 17rem" />
        </div>
      </div>
    </section>
  );
}
