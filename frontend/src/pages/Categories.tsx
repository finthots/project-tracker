import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCategory, getCategories } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Tags } from "lucide-react";

export function Categories() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories().then((response) => response.data),
  });
  const mutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setName("");
      setError("");
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Could not add category");
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Project categories</h1>
        <p className="mt-1 text-sm text-gray-500">Add categories that the team can choose for new projects.</p>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) mutation.mutate(name.trim()); }}
        className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={64}
          placeholder="New category name" aria-label="New category name" required />
        <Button type="submit" disabled={!name.trim() || mutation.isPending} className="min-h-11 shrink-0">
          <Plus size={15} /> Add category
        </Button>
      </form>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-700">
          {categories.length} categories
        </div>
        {isLoading ? <p className="p-5 text-sm text-gray-400">Loading…</p> : categories.length ? (
          <ul className="divide-y divide-gray-100">
            {categories.map((category) => <li key={category} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800">
              <Tags size={15} className="text-violet-600" />{category}
            </li>)}
          </ul>
        ) : <p className="p-5 text-sm text-gray-400">No categories yet.</p>}
      </div>
    </div>
  );
}
