import { Handle, Position } from "reactflow";
import { ChevronDown, ChevronUp, GitFork } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { Person } from "@/lib/family-data";
import { getYear } from "@/lib/tree-layout";
import { fetchPersonPhoto } from "@/lib/family-api";

interface NodeData {
  person: Person;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: (id: string) => void;
  canSwitchTree?: boolean;
  onSwitchTree?: (id: string) => void;
}

export function PersonNode({ data }: { data: NodeData }) {
  const [showImage, setShowImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(data.person.photoUrl);
  const nodeRef = useRef<HTMLDivElement>(null);

  const p = data.person;
  const initials = p.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  const accent =
    p.gender === "female"
      ? "border-l-pink-400"
      : p.gender === "male"
        ? "border-l-blue-400"
        : "border-l-gray-400";

  // Load photo when node becomes visible
  useEffect(() => {
    if (photoUrl || !showImage) return; // Already have photo or not visible yet

    // Fetch photo from API
    fetchPersonPhoto(p.id).then((url) => {
      setPhotoUrl(url);
    }).catch(() => {
      // Silently fail if photo can't load
    });
  }, [p.id, showImage, photoUrl]);

  // Use Intersection Observer to trigger image loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowImage(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "100px" } // Start loading 100px before visible
    );

    if (nodeRef.current) {
      observer.observe(nodeRef.current);
    }

    return () => {
      if (nodeRef.current) {
        observer.unobserve(nodeRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={nodeRef}
      className={`group relative flex w-40 flex-col items-center rounded-lg border border-l-4 ${accent} bg-card px-3 pb-3 pt-10 shadow-sm transition hover:shadow-md`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0!" />
      <Handle type="source" position={Position.Bottom} className="opacity-0!" />
      <Handle type="source" position={Position.Right} id="right" className="opacity-0!" />
      <Handle type="target" position={Position.Left} id="left" className="opacity-0!" />
      <div className="absolute -top-8 left-1/2 -translate-x-1/2">
        <div className="relative h-16 w-16">
          {/* Always show placeholder with initials initially */}
          <div
            className={`absolute inset-0 flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-muted text-base font-semibold text-muted-foreground shadow-sm transition-opacity duration-300 ${
              imageLoaded ? "opacity-0" : "opacity-100"
            }`}
          >
            {initials}
          </div>

          {/* Load image only when visible */}
          {photoUrl && (
            <img
              src={photoUrl}
              alt={p.name}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              className={`absolute inset-0 h-16 w-16 rounded-full border-4 border-card object-cover shadow-sm transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </div>
      </div>
      <div className="w-full min-w-0 text-center">
        <div className="truncate text-sm font-semibold text-foreground">{p.name}</div>
        <div className="text-xs text-muted-foreground">
          {getYear(p.birthDate) || "?"} – {getYear(p.deathDate) || ""}
        </div>
      </div>
      {data.hasChildren && data.onToggleCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleCollapse!(p.id);
          }}
          className="absolute -bottom-3 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
          aria-label={data.collapsed ? "Expand descendants" : "Collapse descendants"}
          title={data.collapsed ? "Expand descendants" : "Collapse descendants"}
        >
          {data.collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      {data.canSwitchTree && data.onSwitchTree && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onSwitchTree?.(p.id);
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-blue-300 bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sm transition hover:from-sky-500 hover:to-blue-700"
          aria-label={`Switch tree for ${p.name}`}
          title="Switch tree"
        >
          <GitFork className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
