import { format } from "date-fns";

interface NoteItem {
  id: string;
  noteBody: string;
  createdAt: Date;
  user: { id: string; name: string };
}

export function LeadNotes({ notes }: { notes: NoteItem[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No notes yet</p>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div key={note.id} className="rounded-md border p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{note.user.name}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{note.noteBody}</p>
        </div>
      ))}
    </div>
  );
}
