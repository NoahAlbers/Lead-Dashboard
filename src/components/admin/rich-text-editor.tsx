"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Code,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

const MERGE_FIELDS = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Full Name", value: "{{full_name}}" },
  { label: "Company", value: "{{company_name}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Phone", value: "{{phone}}" },
  { label: "Total Units", value: "{{total_units}}" },
  { label: "States", value: "{{state}}" },
  { label: "Website", value: "{{website}}" },
  { label: "Assigned User", value: "{{assigned_user_name}}" },
  { label: "Referral Partner", value: "{{referral_partner_name}}" },
];

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const [showMergeFields, setShowMergeFields] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(content);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Write your template..." }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      setSourceHtml(html);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] p-3 focus:outline-none",
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  const insertMergeField = useCallback(
    (field: string) => {
      editor?.chain().focus().insertContent(field).run();
      setShowMergeFields(false);
    },
    [editor]
  );

  function handleSourceChange(html: string) {
    setSourceHtml(html);
    onChange(html);
    editor?.commands.setContent(html);
  }

  function insertLink() {
    const url = prompt("Enter URL:");
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }

  function insertImage() {
    const url = prompt("Enter image URL:");
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  }

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `rounded p-1.5 transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="rounded-md border border-input overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))} title="Bold">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))} title="Italic">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive("underline"))} title="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive("heading", { level: 1 }))} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive("heading", { level: 2 }))} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive("heading", { level: 3 }))} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))} title="Bullet List">
          <List className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))} title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btnClass(editor.isActive({ textAlign: "left" }))} title="Align Left">
          <AlignLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btnClass(editor.isActive({ textAlign: "center" }))} title="Align Center">
          <AlignCenter className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btnClass(editor.isActive({ textAlign: "right" }))} title="Align Right">
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button type="button" onClick={insertLink} className={btnClass(editor.isActive("link"))} title="Insert Link">
          <LinkIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={insertImage} className={btnClass(false)} title="Insert Image">
          <ImageIcon className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Merge Fields Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMergeFields(!showMergeFields)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Insert Field
            <ChevronDown className="h-3 w-3" />
          </button>
          {showMergeFields && (
            <div className="absolute top-full left-0 mt-1 w-48 rounded-md border bg-card shadow-lg z-20">
              {MERGE_FIELDS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => insertMergeField(f.value)}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  <span>{f.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{f.value}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setShowSource(!showSource)}
            className={btnClass(showSource)}
            title="HTML Source"
          >
            <Code className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor or Source */}
      {showSource ? (
        <textarea
          value={sourceHtml}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="w-full min-h-[200px] p-3 text-sm font-mono bg-card focus:outline-none"
        />
      ) : (
        <EditorContent editor={editor} className="bg-card" />
      )}
    </div>
  );
}
