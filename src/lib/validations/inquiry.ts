import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : null));

/** What the public quote form may send. Anything else is dropped; nothing is trusted as-is. */
export const inquirySchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(200),
    company: optionalText(200),
    email: z.union([z.literal(""), z.email("Enter an email address like name@company.com.")]).optional()
      .transform((value) => (value ? value.toLowerCase() : null)),
    whatsapp: z.string().trim().max(40).optional()
      .refine((value) => !value || /^\+?[\d\s()-]{7,20}$/.test(value), "Enter the number with its country code.")
      .transform((value) => (value ? value : null)),
    country: optionalText(100),
    footballType: optionalText(100),
    quantity: z.union([z.literal(""), z.coerce.number().int().positive().max(10_000_000)]).optional()
      .transform((value) => (typeof value === "number" ? value : null)),
    design: optionalText(200),
    material: optionalText(2000),
    logo: optionalText(2000),
    instructions: optionalText(4000),
  })
  .refine((value) => value.email || value.whatsapp, {
    message: "Enter an email address or a WhatsApp number so we can reply.",
    path: ["email"],
  });

export type InquiryInput = z.infer<typeof inquirySchema>;
