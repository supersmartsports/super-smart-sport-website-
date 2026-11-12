import { site } from "@/config/site";

/**
 * Frontend-only quote inquiry. Nothing is stored or transmitted by the website:
 * the form turns the customer's answers into a message that they send themselves
 * through WhatsApp or their own email app.
 */
export type QuoteInquiry = {
  name: string;
  company: string;
  email: string;
  country: string;
  whatsapp: string;
  footballType: string;
  quantity: string;
  design: string;
  material: string;
  logo: string;
  instructions: string;
};

export const emptyInquiry: QuoteInquiry = {
  name: "",
  company: "",
  email: "",
  country: "",
  whatsapp: "",
  footballType: "",
  quantity: "",
  design: "",
  material: "",
  logo: "",
  instructions: "",
};

export type InquiryErrors = Partial<Record<keyof QuoteInquiry, string>>;

export function validateInquiry(values: QuoteInquiry): InquiryErrors {
  const errors: InquiryErrors = {};
  if (!values.name.trim()) errors.name = "Enter your name.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter an email address like name@company.com.";
  if (!values.country.trim()) errors.country = "Enter the country you are ordering from.";
  if (!values.footballType) errors.footballType = "Choose a type of football.";
  if (!values.quantity.trim()) errors.quantity = "Enter the quantity you need.";
  else if (!/^\d[\d,.\s]*$/.test(values.quantity.trim()) || Number(values.quantity.replace(/[^\d]/g, "")) < 1)
    errors.quantity = "Enter the quantity as a number, for example 500.";
  if (values.whatsapp.trim() && !/^\+?[\d\s()-]{7,20}$/.test(values.whatsapp.trim()))
    errors.whatsapp = "Enter the number with its country code, for example +44 7700 900123.";
  return errors;
}

export function buildInquiryText(values: QuoteInquiry): string {
  const lines: [string, string][] = [
    ["Name", values.name],
    ["Company", values.company],
    ["Email", values.email],
    ["Country", values.country],
    ["WhatsApp", values.whatsapp],
    ["Football type", values.footballType],
    ["Quantity", values.quantity],
    ["Design reference", values.design],
    ["Material requirements", values.material],
    ["Custom logo requirements", values.logo],
    ["Additional instructions", values.instructions],
  ];
  return [
    `Quote request for ${site.name}`,
    "",
    ...lines.filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value.trim()}`),
  ].join("\n");
}

export function whatsappLink(text: string) {
  return `${site.contact.whatsappUrl}?text=${encodeURIComponent(text)}`;
}

export function emailLink(text: string, values: QuoteInquiry) {
  const subject = `Quote request: ${values.quantity.trim()} x ${values.footballType || "custom football"}`;
  return `mailto:${site.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
