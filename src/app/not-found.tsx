import { routes } from "@/config/site";
import { ButtonLink } from "@/components/buttons/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-navy-deep px-6 py-20 text-white">
      <div className="max-w-xl text-center">
        <Logo size={72} withName={false} className="mx-auto" />
        <h1 className="type-h1 mt-10">This page does not exist</h1>
        <p className="type-lead mt-5 text-white/75">The link may be old or mistyped. Our footballs are all still here.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={routes.products} size="lg">
            Explore Our Footballs
          </ButtonLink>
          <ButtonLink href={routes.home} variant="outline-light" size="lg">
            Go to the homepage
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
