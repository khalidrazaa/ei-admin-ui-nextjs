"use client";

import { useEffect, useRef, useState } from "react";
import { getNiches, Niche, deleteKeyword, addKeyword, deleteNiche, createNiche, updateNicheStatus } from "@/lib/services/niche";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";

export default function NichesPage() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeywords, setNewKeywords] = useState<{ [nicheId: number]: string }>({});
  const inputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [newNiche, setNewNiche] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Niche | null>(null);
  const [selectedNicheId, setSelectedNicheId] = useState<number | null>(null);
  const [expandedNiches, setExpandedNiches] = useState<{ [id: number]: boolean }>({});
  const [leftWidth, setLeftWidth] = useState(320);
  const isResizing = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getNiches(); 
        setNiches(data);
      } catch (err) {
        console.error("Failed to load niches", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

 // 🔧 resize handlers
  const handleMouseDown = () => {
    isResizing.current = true;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    setLeftWidth(Math.max(250, Math.min(600, e.clientX)));
  };

  const handleMouseUp = () => {
    isResizing.current = false;
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedNiches((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  async function handleDeleteKeyword(nicheId: number, keywordId: number) {
    try {
      await deleteKeyword(nicheId, keywordId);

      setNiches((prev) =>
        prev.map((n) =>
          n.id === nicheId
            ? {
                ...n,
                keywords: n.keywords.filter((k) => k.id !== keywordId),
              }
            : n
        )
      );
    } catch (err) {
      console.error("Failed to delete keyword", err);
    }
  }

  async function handleAddKeyword(nicheId: number) {
    const raw = newKeywords[nicheId]?.trim();
    if (!raw) return;

    const keywords = raw
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    try {
      const createdKeywords = await Promise.all(
        keywords.map((k) => addKeyword(nicheId, k))
      );

      setNiches((prev) =>
        prev.map((n) =>
          n.id === nicheId
            ? {
                ...n,
                keywords: [...n.keywords, ...createdKeywords],
              }
            : n
        )
      );

      setNewKeywords((prev) => ({ ...prev, [nicheId]: "" }));
      inputRefs.current[nicheId]?.focus();
    } catch (err) {
      console.error("Failed to add keyword", err);
    }
  }

  async function handleToggleNiche(nicheId: number, active: boolean) {
    try {
      await updateNicheStatus(nicheId, active);

      setNiches((prev) =>
        prev.map((n) =>
          n.id === nicheId ? { ...n, is_active: active } : n
        )
      );
    } catch (err) {
      console.error("Failed to update niche status", err);
    }
  }

  async function handleCreateNiche() {
    if (!newNiche.trim()) return;

    try {
      const created = await createNiche(newNiche);
      setNiches((prev) => [...prev, created]);
      setNewNiche("");
    } catch (err) {
      console.error("Failed to create niche", err);
    }
  }

  async function handleDeleteNicheConfirmed() {
    if (!deleteTarget) return;

    try {
      await deleteNiche(deleteTarget.id);

      setNiches((prev) =>
        prev.filter((n) => n.id !== deleteTarget.id)
      );

      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete niche", err);
    }
  }

  if (loading) return <div>Loading niches...</div>;

  return (
    <div className="flex h-full p-2">

      {/* 🟦 LEFT PANEL */}
      <div
        style={{ width: leftWidth }}
        className=" pr-1 overflow-y-auto m-2 rounded-lg"
      >
        <h1 className="text-xl font-semibold mb-4">Niches</h1>

        {/* Add Niche */}
        <div className="flex gap-1 mb-4">
          <Button onClick={handleCreateNiche}>
            <span className="flex items-center justify-center text-lg font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-icon lucide-plus">
              <path d="M5 12h14"/><path d="M12 5v14"/></svg></span>
          </Button>
          <input
            type="text"
            placeholder="New niche name"
            value={newNiche}
            onChange={(e) => setNewNiche(e.target.value)}
            className="border border-green-500 rounded px-2 py-0.5 text-sm"
          />
        </div>

        <div className="space-y-3" >
          {niches.map((niche) => (
            <div
              key={niche.id}
              className={`rounded-lg p-1 transition ${
                selectedNicheId === niche.id
                  ? "bg-green-50 border-green-400"
                  : "bg-white hover:bg-gray-50"
              }`}
              >
              {/* 🔷 HEADER */}
              <div className="flex items-center justify-between">
              
                <div
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => {
                    setSelectedNicheId(niche.id);
                    toggleExpand(niche.id);
                  }}
                >
                  {/* Expand icon */}
                  <span className="text-xs">
                    {expandedNiches[niche.id] ? <svg xmlns="http://www.w3.org/2000/svg" width="15" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down-icon lucide-chevron-down">
                    <path d="m6 9 6 6 6-6"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="15" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>}
                  </span>
                
                  {/* Name */}
                  <span className="font-medium">
                    {niche.display_name}
                  </span>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                
                  {/* Small toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleNiche(niche.id, !niche.is_active);
                    }}
                    className={`w-8 h-4 flex items-center rounded-full p-0.5 ${
                      niche.is_active ? "bg-green-800" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 bg-white rounded-full transition ${
                        niche.is_active ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                      
                  {/* Delete icon */}
                  <Button variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(niche);
                    }}
                    //className="text-red-500 hover:text-white-700 text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </Button>
                  
                </div>
              </div>
                  
              {/* 🔽 EXPANDED CONTENT */}
              {expandedNiches[niche.id] && (
                <div className="mt-3 pl-5 space-y-2">
                
                  {/* Keywords */}
                  <div className="flex flex-wrap gap-2">
                    {niche.keywords.map((k) => (
                      <span
                        key={k.id}
                        className="flex items-center gap-1 bg-gray-200 text-xs px-2 py-0.5 rounded"
                      >
                        {k.keyword}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteKeyword(niche.id, k.id);
                          }}
                          className="text-gray-500 hover:text-red-700"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/>
                        <path d="m6 6 12 12"/></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  
                  {/* Add keyword */}
                  <input
                    ref={(el) => { inputRefs.current[niche.id] = el; }}
                    type="text"
                    placeholder="Add keyword (comma separated)"
                    value={newKeywords[niche.id] || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setNewKeywords((prev) => ({
                        ...prev,
                        [niche.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword(niche.id);
                      }
                    }}
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 🟨 RESIZER */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 cursor-col-resize bg-gray-300 hover:bg-gray-400"
      />

      {/* 🟩 RIGHT PANEL */}
      <div className="flex-1 p-4">
        {selectedNicheId ? (
          <div>Load videos for niche: {selectedNicheId}</div>
        ) : (
          <div className="text-gray-500">
            Select a niche to view videos
          </div>
        )}
      </div>

      {/* Modal */}
      {deleteTarget && (
        <ConfirmModal
          open={true}
          title="Delete Niche"
          message={`Are you sure you want to delete "${deleteTarget.display_name}"?`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeleteNicheConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}