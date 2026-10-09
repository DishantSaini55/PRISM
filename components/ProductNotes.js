"use client";

import { useState, useTransition } from "react";
import { NotebookPen, Save } from "lucide-react";
import { toast } from "sonner";
import { saveProductNote } from "@/app/actions";

export default function ProductNotes({ productId, initialNote = "", initialTags = [] }) {
  const [note, setNote] = useState(initialNote || "");
  const [tags, setTags] = useState((initialTags || []).join(", "));
  const [isPending, startTransition] = useTransition();

  function save() {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("note", note);
    formData.set("tags", tags);
    startTransition(async () => {
      const result = await saveProductNote(formData);
      if (result.error) return toast.error(result.error);
      setTags((result.tags || []).join(", "));
      toast.success("Private product note saved.");
    });
  }

  return (
    <section className="mt-5 border-t border-slate-200 pt-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950"><NotebookPen className="h-4 w-4 text-indigo-600" /> Your private notes</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">Only you can see these notes and tags.</p>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} placeholder="Why are you tracking this?" className="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 focus:ring-2" />
      <input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={260} placeholder="Tags, separated by commas" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 focus:ring-2" />
      <button type="button" onClick={save} disabled={isPending} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Save className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save note"}</button>
    </section>
  );
}
