import { useReportTemplates } from "../../hooks/useReportTemplates";
import { useCustomer } from "../../hooks/useCustomer";
import { useCategory } from "../../hooks/useCategory";
import { useMemo } from "react";
import { TemplateCard } from "../../components/timeReport/TemplateCard";

export function TimeRegisterTemplatesPage() {
  const { templates, deleteTemplate, loading } = useReportTemplates(); 
  const { customer } = useCustomer();
  const { category } = useCategory();

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customer) map.set(String(c.id), c.company ?? `Customer #${c.id}`);
    return (id: number | string | null | undefined) =>
      map.get(String(id ?? "")) ?? `Customer #${id ?? "?"}`;
  }, [customer]);

  const companyNameByTemplate = useMemo(() => {
    return (t: any) => companyNameById(t?.customerId ?? t?.customer_id);
  }, [companyNameById]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of category) map.set(String(cat.id), cat.name);
    return (id: number | string | null | undefined) =>
      id ? map.get(String(id)) ?? `#${id}` : "—";
  }, [category]);

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <span className="text-lg font-medium mb-2">Loading templates…</span>
        </div>
      ) : templates?.length ? (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              companyName={companyNameByTemplate(t)}
              categoryName={categoryNameById((t as any).category)}
              onDelete={() => deleteTemplate(t.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <span className="text-lg font-medium mb-2">No templates found</span>
          <span className="text-sm">Create a new template to get started.</span>
        </div>
      )}
    </div>
  );
}
