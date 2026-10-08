"use client";

import { useState } from "react";
import { addProduct, searchProducts } from "@/app/actions";
import AuthModal from "./AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export default function AddProductForm({ user }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [candidates, setCandidates] = useState([]);

  const isUrlInput = (value) => {
    try {
      const parsedUrl = new URL(value);
      return ["http:", "https:"].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setLoading(true);

    const formData = new FormData();
    const isUrl = isUrlInput(input.trim());
    formData.append(isUrl ? "url" : "query", input);

    const result = isUrl
      ? await addProduct(formData)
      : await searchProducts(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      if (isUrl) {
        toast.success(result.message || "Product tracked successfully!");
        setInput("");
      } else {
        setCandidates(result.candidates || []);
        toast.success(`${result.candidates?.length || 0} candidates found.`);
      }
    }

    setLoading(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col gap-2 rounded-2xl border border-indigo-200 bg-white p-2 shadow-[0_18px_55px_-25px_rgba(79,70,229,0.45)] sm:flex-row">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste an Amazon, Flipkart, Croma or Reliance Digital product URL"
            className="h-12 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            disabled={loading}
          />

          <Button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-indigo-600 px-7 hover:bg-indigo-700"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying offers...
              </>
            ) : (
              <>
                Compare prices <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      {candidates.length > 0 && (
        <div className="mt-4 w-full max-w-2xl mx-auto space-y-2 text-left">
          {candidates.map((candidate) => (
            <button
              key={candidate.url}
              type="button"
              onClick={() => {
                setInput(candidate.url);
                setCandidates([]);
                toast.info("Candidate URL selected for the next pipeline step.");
              }}
              className="w-full rounded-xl border border-indigo-100 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <p className="font-medium text-gray-900">{candidate.title}</p>
              <p className="mt-1 text-sm text-gray-500">{candidate.storeName}</p>
              {candidate.description && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                  {candidate.description}
                </p>
              )}
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500"><Search className="h-3.5 w-3.5" /> Exact variant verification across supported stores</p>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
