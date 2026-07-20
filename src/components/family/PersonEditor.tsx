import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveStatus } from "@/lib/save-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Person, Gender } from "@/lib/family-data";

export function PersonEditor({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Person>;
  onSubmit: (data: Omit<Person, "id">) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [gender, setGender] = useState<Gender>(initial?.gender ?? "male");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [deathDate, setDeathDate] = useState(initial?.deathDate ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [biography, setBiography] = useState(initial?.biography ?? "");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    setUploadProgress(0);
    reader.onprogress = (ev) => {
      if (ev.lengthComputable) {
        setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 500);
    };
    reader.onerror = () => setUploadProgress(null);
    reader.readAsDataURL(f);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting) return;
        if (!name.trim()) {
          toast.error("Please insert information to save.");
          saveStatus.notSaved("Please insert information to save");
          return;
        }
        // Dirty check when editing an existing person: require at least one changed field.
        if (initial && Object.keys(initial).length > 0) {
          const norm = (v: unknown) => (v == null ? "" : String(v));
          const changed =
            norm(initial.name) !== name.trim() ||
            norm(initial.gender) !== gender ||
            norm(initial.birthDate) !== birthDate ||
            norm(initial.deathDate) !== deathDate ||
            norm(initial.photoUrl) !== photoUrl ||
            norm(initial.biography) !== biography;
          if (!changed) {
            toast.error("Please insert information to save.");
            saveStatus.notSaved("Please insert information to save");
            return;
          }
        }
        setSubmitting(true);
        saveStatus.saving();
        try {
          await onSubmit({
            name: name.trim(),
            gender,
            birthDate: birthDate || undefined,
            deathDate: deathDate || undefined,
            photoUrl: photoUrl || undefined,
            biography: biography || undefined,
          });
          saveStatus.saved();
        } catch (err) {
          saveStatus.error(err instanceof Error ? err.message : "Save failed");
          throw err;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label>Gender</Label>
        <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Birth date</Label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Death date</Label>
          <Input type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label>Photo</Label>
        <Input type="file" accept="image/*" onChange={handleFile} className="mt-1" disabled={uploadProgress !== null && uploadProgress < 100} />
        {uploadProgress !== null && (
          <div className="mt-2 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">{uploadProgress}%</div>
          </div>
        )}
        {photoUrl && <img src={photoUrl} alt="" className="mt-2 h-16 w-16 rounded-full object-cover" />}
      </div>
      <div>
        <Label>Biography</Label>
        <Textarea value={biography} onChange={(e) => setBiography(e.target.value)} rows={3} className="mt-1" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || (uploadProgress !== null && uploadProgress < 100)}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </form>
  );
}
