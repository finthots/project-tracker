import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMilestoneTemplate, deleteMilestoneTemplate, getMilestoneTemplates } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Plus, Trash2 } from "lucide-react";

function errorDetail(error: unknown, fallback: string) {
  return (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback;
}

export function MilestoneTemplates() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [milestones, setMilestones] = useState("");
  const [error, setError] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["milestoneTemplates"],
    queryFn: () => getMilestoneTemplates().then((response) => response.data),
  });

  const createMutation = useMutation({
    mutationFn: () => createMilestoneTemplate({
      name: name.trim(),
      description: description.trim() || undefined,
      items: milestones.split("\n").map((item) => item.trim()).filter(Boolean)
        .map((item, sequence) => ({ name: item, sequence, id: 0 })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestoneTemplates"] });
      setName("");
      setDescription("");
      setMilestones("");
      setError("");
    },
    onError: (mutationError: unknown) => setError(errorDetail(mutationError, "Could not create template")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMilestoneTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestoneTemplates"] });
      setError("");
    },
    onError: (mutationError: unknown) => setError(errorDetail(mutationError, "Could not delete template")),
  });

  const itemCount = milestones.split("\n").filter((item) => item.trim()).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Milestone templates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create reusable milestone sets that can be applied when a new project is created.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && itemCount) createMutation.mutate();
        }}
        className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Template name *</label>
            <Input value={name} onChange={(event) => setName(event.target.value)}
              placeholder="Example: Website launch" maxLength={256} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <Input value={description} onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Milestones *</label>
          <textarea value={milestones} onChange={(event) => setMilestones(event.target.value)} rows={5}
            placeholder={"Add one milestone per line\nPlanning\nDesign approval\nLaunch"}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            required />
          <p className="mt-1 text-xs text-gray-500">One milestone per line. They will be added in this order.</p>
        </div>
        <Button type="submit" disabled={!name.trim() || !itemCount || createMutation.isPending} className="min-h-11">
          <Plus size={15} /> {createMutation.isPending ? "Creating…" : "Create template"}
        </Button>
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-700">
          {templates.length} templates
        </div>
        {isLoading ? <p className="p-5 text-sm text-gray-400">Loading…</p> : templates.length ? (
          <ul className="divide-y divide-gray-100">
            {templates.map((template) => (
              <li key={template.id} className="p-4">
                <div className="flex items-start gap-3">
                  <ClipboardList size={17} className="mt-0.5 shrink-0 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{template.name}</p>
                    {template.description && <p className="mt-0.5 text-sm text-gray-500">{template.description}</p>}
                    <ol className="mt-2 flex flex-wrap gap-1.5">
                      {template.items.map((item, index) => (
                        <li key={item.id} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                          {index + 1}. {item.name}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <Button type="button" variant="ghost" size="sm" disabled={deleteMutation.isPending}
                    aria-label={`Delete ${template.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete milestone template “${template.name}”?`)) deleteMutation.mutate(template.id);
                    }}>
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-gray-500">No templates yet. Create the first one above.</p>
        )}
      </div>
    </div>
  );
}
