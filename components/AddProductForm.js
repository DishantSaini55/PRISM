"use client";

import { useState } from "react";
import { addProduct, searchProducts } from "@/app/actions";
import AuthModal from "./AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
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
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Product name or URL (for example, Sony WH-1000XM5)"
            className="h-12 text-base"
            disabled={loading}
          />

          <Button
            type="submit"
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 h-10 sm:h-12 px-8"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Find Product"
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
              className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-orange-300 hover:shadow-sm"
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
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
