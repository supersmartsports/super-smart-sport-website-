import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecordForm } from "@/components/admin/forms";
import { createEmployee, saveRecord } from "@/features/admin/actions";
import { moduleBySlug } from "@/features/admin/modules";
import type { Field } from "@/features/admin/types";
import { hasPermission } from "@/features/auth/permissions";
import { requireUser } from "@/server/auth";
import { loadRelationOptions } from "@/server/data";

type Props = { params: Promise<{ module: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = moduleBySlug((await params).module);
  return { title: config ? `New ${config.singular}` : "Not found" };
}

const employeeFields: Field[] = [
  { name: "full_name", label: "Full name", type: "text", required: true, max: 200 },
  { name: "email", label: "Email (their login)", type: "email", required: true, max: 254 },
  { name: "password", label: "Temporary password", type: "password", required: true, max: 200, help: "At least 12 characters. Share it privately; they should change it after the first sign-in." },
  { name: "role_id", label: "Role", type: "relation", required: true, relation: { table: "roles", label: "name" } },
];

export default async function NewRecordPage({ params }: Props) {
  const { module: slug } = await params;
  const config = moduleBySlug(slug);
  if (!config || !config.write || (config.fields.length === 0 && !config.customCreate) || config.singleton) notFound();
  const user = await requireUser();
  if (!hasPermission(user, config.write)) redirect("/admin/dashboard?denied=1");

  const fields = config.customCreate === "employee" ? employeeFields : config.fields;
  const options = await loadRelationOptions(fields);
  const action = config.customCreate === "employee" ? createEmployee : saveRecord.bind(null, slug, "new");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="type-h2">New {config.singular}</h1>
      <div className="mt-6">
        <RecordForm fields={fields} options={options} action={action} submitLabel={`Create ${config.singular}`} />
      </div>
    </div>
  );
}
