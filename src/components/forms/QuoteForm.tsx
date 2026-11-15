"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Mail, Pencil } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { site } from "@/config/site";
import { submitInquiry, type SubmitResult } from "@/features/quote-requests/actions";
import { getProduct, products } from "@/data/products";
import { typeOptions } from "@/features/football-customization/options";
import {
  buildInquiryText,
  emailLink,
  emptyInquiry,
  validateInquiry,
  whatsappLink,
  type InquiryErrors,
  type QuoteInquiry,
} from "@/features/quote-requests/inquiry";
import { Button, ButtonAnchor } from "@/components/buttons/Button";
import { SelectField, TextAreaField, TextField } from "./Field";

const fieldOrder: (keyof QuoteInquiry)[] = ["name", "company", "email", "country", "whatsapp", "footballType", "quantity"];

/** Turns a brief passed in the URL (from a product page or the studio) into starting values. */
function initialFromParams(params: URLSearchParams): Partial<QuoteInquiry> {
  const values: Partial<QuoteInquiry> = {};
  const product = getProduct(params.get("design") ?? "");
  if (product) values.design = `${product.name} (${product.sku})`;

  const type = params.get("type");
  if (type && (typeOptions as readonly string[]).includes(type)) values.footballType = type;

  const material = [
    params.get("material") && `Surface material: ${params.get("material")}`,
    params.get("construction") && `Construction: ${params.get("construction")}`,
    params.get("size") && `Size: ${params.get("size")}`,
  ].filter(Boolean);
  if (material.length) values.material = material.join("\n");

  const logo = [
    params.get("primary") && params.get("secondary") && `Colours: ${params.get("primary")} and ${params.get("secondary")}`,
    params.get("branding") && `Branding: ${params.get("branding")}`,
  ].filter(Boolean);
  if (logo.length) values.logo = logo.join("\n");
  return values;
}

export function QuoteForm({ backendEnabled = false }: { backendEnabled?: boolean }) {
  const searchParams = useSearchParams();
  const [values, setValues] = useState<QuoteInquiry>(emptyInquiry);
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [prepared, setPrepared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendResult, setSendResult] = useState<SubmitResult | null>(null);
  const [sending, startSending] = useTransition();
  const [trap, setTrap] = useState(""); // hidden spam trap: real visitors never fill it in
  // The form only works with scripts running. Until then the button stays disabled, so the
  // browser can never fall back to a plain submit that would put the answers in the address bar.
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const summary = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setValues((current) => ({ ...current, ...initialFromParams(searchParams) }));
  }, [searchParams]);

  useEffect(() => {
    if (prepared) summary.current?.focus();
  }, [prepared]);

  const set = (key: keyof QuoteInquiry) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateInquiry(values);
    setErrors(found);
    const firstInvalid = fieldOrder.find((key) => found[key]);
    if (firstInvalid) {
      form.current?.querySelector<HTMLElement>(`#${firstInvalid}`)?.focus();
      return;
    }
    setPrepared(true);
  };

  const text = buildInquiryText(values);
  const sent = sendResult?.status === "sent";
  const sendToCompany = () =>
    startSending(async () => setSendResult(await submitInquiry({ ...values, website: trap } as unknown as Record<string, string>)));

  if (prepared) {
    return (
      <div ref={summary} tabIndex={-1} className="rounded-sm bg-white p-6 ring-1 ring-line outline-none sm:p-10">
        <h2 className="type-h2 text-navy-deep">{sent ? "Your request has been received" : "Your request is ready to send"}</h2>
        <p className="type-lead mt-4 max-w-[58ch] text-slate">
          {sent
            ? `${site.name} has your request and will reply by email or WhatsApp.`
            : backendEnabled
              ? `Send it to ${site.name} directly, or open it in WhatsApp or email instead.`
              : `It has not been sent yet. Choose WhatsApp or email below and the message opens in that app, ready for you to send to ${site.name}.`}
        </p>

        <pre className="mt-7 max-h-80 overflow-auto rounded-xs bg-paper p-5 font-sans text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-navy-deep ring-1 ring-line">
          {text}
        </pre>

        {backendEnabled && !sent && (
          <div className="mt-6">
            <Button type="button" size="lg" onClick={sendToCompany} disabled={sending} className="w-full sm:w-auto">
              {sending ? "Sending" : `Send request to ${site.name}`}
            </Button>
            <p role={sendResult?.status === "error" ? "alert" : "status"} aria-live="polite" className="mt-2 text-sm font-semibold text-red-deep">
              {sendResult?.status === "error" ? sendResult.message : ""}
            </p>
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <ButtonAnchor href={whatsappLink(text)} size="lg">
            <FaWhatsapp aria-hidden className="size-5" />
            Send on WhatsApp
          </ButtonAnchor>
          <ButtonAnchor href={emailLink(text, values)} variant="dark" size="lg">
            <Mail aria-hidden className="size-5" />
            Send by email
          </ButtonAnchor>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline-dark"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied ? "Copied" : "Copy the text"}
          </Button>
          <Button type="button" variant="outline-dark" onClick={() => setPrepared(false)}>
            <Pencil aria-hidden className="size-4" />
            Edit the request
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copied ? "Request text copied" : ""}
        </p>
      </div>
    );
  }

  return (
    <form ref={form} noValidate onSubmit={onSubmit} className="rounded-sm bg-white p-6 ring-1 ring-line sm:p-10">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute -left-[9999px] size-px opacity-0" />
      <fieldset>
        <legend className="type-h3 text-navy-deep">About you</legend>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <TextField id="name" label="Your name" required autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} />
          <TextField id="company" label="Company name" autoComplete="organization" value={values.company} onChange={set("company")} />
          <TextField id="email" label="Email" type="email" required autoComplete="email" inputMode="email" value={values.email} onChange={set("email")} error={errors.email} />
          <TextField id="country" label="Country" required autoComplete="country-name" value={values.country} onChange={set("country")} error={errors.country} />
          <TextField
            id="whatsapp"
            label="WhatsApp number"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            hint="Include the country code."
            value={values.whatsapp}
            onChange={set("whatsapp")}
            error={errors.whatsapp}
            wrapperClassName="sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]"
          />
        </div>
      </fieldset>

      <fieldset className="mt-10 border-t border-line pt-10">
        <legend className="type-h3 float-left mb-6 w-full text-navy-deep">Your football</legend>
        <div className="clear-both grid gap-5 sm:grid-cols-2">
          <SelectField id="footballType" label="Football type" required value={values.footballType} onChange={set("footballType")} error={errors.footballType}>
            <option value="">Choose a type</option>
            {typeOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
            <option>More than one type</option>
          </SelectField>
          <TextField
            id="quantity"
            label="Quantity"
            required
            inputMode="numeric"
            hint="Number of footballs."
            value={values.quantity}
            onChange={set("quantity")}
            error={errors.quantity}
          />
          <SelectField
            id="design"
            label="Design reference"
            hint="A design from our collection to start from."
            value={values.design}
            onChange={set("design")}
            wrapperClassName="sm:col-span-2"
          >
            <option value="">No reference, I have my own design</option>
            {products.map((product) => {
              const label = `${product.name} (${product.sku})`;
              return <option key={product.slug}>{label}</option>;
            })}
          </SelectField>
          <TextAreaField
            id="material"
            label="Material requirements"
            hint="Surface material, construction, size, or anything you already know."
            value={values.material}
            onChange={set("material")}
            wrapperClassName="sm:col-span-2"
          />
          <TextAreaField
            id="logo"
            label="Custom logo requirements"
            hint="Which logos, where on the football, and your brand colours. You can attach files in WhatsApp or email."
            value={values.logo}
            onChange={set("logo")}
            wrapperClassName="sm:col-span-2"
          />
          <TextAreaField
            id="instructions"
            label="Additional instructions"
            value={values.instructions}
            onChange={set("instructions")}
            wrapperClassName="sm:col-span-2"
          />
        </div>
      </fieldset>

      <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" disabled={!interactive}>
          Prepare my request
        </Button>
        <p className="max-w-[44ch] text-sm text-slate">
          Next, you choose WhatsApp or email to send it. Nothing is sent or stored by this website.
        </p>
      </div>
    </form>
  );
}
