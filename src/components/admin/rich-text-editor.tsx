"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
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
  X,
  Table as TableIcon,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

const MERGE_FIELDS = [
  { group: "Contact", fields: [
    { label: "First Name", value: "{{first_name}}" },
    { label: "Last Name", value: "{{last_name}}" },
    { label: "Full Name", value: "{{full_name}}" },
    { label: "Company", value: "{{company_name}}" },
    { label: "Title", value: "{{title}}" },
    { label: "Email", value: "{{email}}" },
    { label: "Phone", value: "{{phone}}" },
    { label: "Alt. Phone", value: "{{alternate_phone}}" },
  ]},
  { group: "Location", fields: [
    { label: "Address 1", value: "{{address_1}}" },
    { label: "Address 2", value: "{{address_2}}" },
    { label: "City", value: "{{city}}" },
    { label: "State", value: "{{state}}" },
    { label: "Zip", value: "{{zip}}" },
    { label: "Country", value: "{{country}}" },
  ]},
  { group: "Business", fields: [
    { label: "Industry", value: "{{industry}}" },
    { label: "Debt Type", value: "{{debt_type}}" },
    { label: "Balance Amount", value: "{{balance_amount}}" },
    { label: "Est. Claim Value", value: "{{estimated_claim_value}}" },
    { label: "Units", value: "{{units}}" },
    { label: "Service Requested", value: "{{service_requested}}" },
    { label: "Notes from Form", value: "{{notes_from_form}}" },
    { label: "Urgency", value: "{{urgency}}" },
    { label: "Business Type", value: "{{business_type}}" },
    { label: "Geographic Scope", value: "{{geographic_scope}}" },
  ]},
  { group: "Property Mgmt", fields: [
    { label: "PM Software", value: "{{pm_software}}" },
    { label: "Listing Locations", value: "{{listing_locations}}" },
    { label: "Property Types", value: "{{property_types}}" },
    { label: "Number of Units", value: "{{number_of_units}}" },
    { label: "Number of Properties", value: "{{number_of_properties}}" },
  ]},
  { group: "Metadata", fields: [
    { label: "Lead Source", value: "{{lead_source}}" },
    { label: "Source Page", value: "{{source_page}}" },
    { label: "UTM Source", value: "{{utm_source}}" },
    { label: "UTM Medium", value: "{{utm_medium}}" },
    { label: "UTM Campaign", value: "{{utm_campaign}}" },
  ]},
  { group: "System", fields: [
    { label: "Score", value: "{{score}}" },
    { label: "Quality Tier", value: "{{quality_tier}}" },
    { label: "Status", value: "{{status}}" },
    { label: "Assigned User", value: "{{assigned_user_name}}" },
    { label: "Created At", value: "{{created_at}}" },
  ]},
  { group: "Referral Partner", fields: [
    { label: "Partner Name", value: "{{referral_partner_name}}" },
    { label: "Partner Contact", value: "{{referral_partner_contact_name}}" },
    { label: "Partner Email", value: "{{referral_partner_email}}" },
    { label: "Partner Phone", value: "{{referral_partner_phone}}" },
    { label: "Partner Website", value: "{{referral_partner_website}}" },
    { label: "Contingency Rate", value: "{{referral_partner_contingency_rate}}" },
    { label: "Upfront Costs", value: "{{referral_partner_upfront_costs}}" },
    { label: "Min Accounts", value: "{{referral_partner_minimum_accounts}}" },
    { label: "Min Total Balance", value: "{{referral_partner_minimum_total_balance}}" },
  ]},
  { group: "Intake Form", fields: [
    { label: "Website", value: "{{website}}" },
    { label: "Debt Types", value: "{{debt_types}}" },
    { label: "Debts Ready Now", value: "{{debts_ready_now}}" },
    { label: "Prior Agency", value: "{{prior_agency}}" },
    { label: "States (all)", value: "{{states}}" },
    { label: "Ownership", value: "{{ownership}}" },
    { label: "Total Units", value: "{{total_units}}" },
    { label: "Rental Types", value: "{{rental_types}}" },
    { label: "Property Types", value: "{{property_types}}" },
    { label: "Avg Rent / Unit", value: "{{avg_rent}}" },
    { label: "Listing Sites", value: "{{listing_sites}}" },
    { label: "PM Software", value: "{{pm_software}}" },
    { label: "Comments", value: "{{comments}}" },
  ]},
  { group: "Referral Email", fields: [
    { label: "Lead Data Table", value: "{{lead_data_table}}" },
  ]},
];

const SUMMARY_TABLE_FIELDS = [
  { label: "Name", value: "{{full_name}}" },
  { label: "Company", value: "{{company_name}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Phone", value: "{{phone}}" },
  { label: "State", value: "{{state}}" },
  { label: "City", value: "{{city}}" },
  { label: "Units", value: "{{units}}" },
  { label: "Debt Type", value: "{{debt_type}}" },
  { label: "Balance Amount", value: "{{balance_amount}}" },
  { label: "Service Requested", value: "{{service_requested}}" },
  { label: "Urgency", value: "{{urgency}}" },
  { label: "Industry", value: "{{industry}}" },
  { label: "Business Type", value: "{{business_type}}" },
  { label: "Notes", value: "{{notes_from_form}}" },
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
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [showTableModal, setShowTableModal] = useState(false);
  const [selectedTableFields, setSelectedTableFields] = useState<Set<number>>(new Set([0, 1, 2, 3]));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
      }),
      Underline,
      LinkExtension.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageExtension.configure({ inline: true }),
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
    if (linkUrl) {
      editor?.chain().focus().setLink({ href: linkUrl }).run();
    }
    setShowLinkModal(false);
    setLinkUrl("");
  }

  function insertImage() {
    if (imageUrl) {
      editor?.chain().focus().setImage({ src: imageUrl }).run();
    }
    setShowImageModal(false);
    setImageUrl("");
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    fetch("/api/upload", { method: "POST", body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          editor?.chain().focus().setImage({ src: data.url }).run();
          setShowImageModal(false);
        }
      })
      .catch(console.error);
  }

  function insertSummaryTable() {
    const fields = SUMMARY_TABLE_FIELDS.filter((_, i) => selectedTableFields.has(i));
    const rows = fields.map((f) => `<tr><td style="padding:6px 12px;border:1px solid #E2E4EC;font-weight:600;color:#4A4A68">${f.label}</td><td style="padding:6px 12px;border:1px solid #E2E4EC">${f.value}</td></tr>`).join("");
    const table = `<table style="width:100%;border-collapse:collapse;margin:12px 0"><tbody>${rows}</tbody></table>`;
    editor?.chain().focus().insertContent(table).run();
    setShowTableModal(false);
  }

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `rounded p-1.5 transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="rounded-md border border-input overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))}><Bold className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))}><Italic className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive("underline"))}><UnderlineIcon className="h-4 w-4" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive("heading", { level: 1 }))}><Heading1 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive("heading", { level: 2 }))}><Heading2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive("heading", { level: 3 }))}><Heading3 className="h-4 w-4" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))}><List className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))}><ListOrdered className="h-4 w-4" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btnClass(editor.isActive({ textAlign: "left" }))}><AlignLeft className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btnClass(editor.isActive({ textAlign: "center" }))}><AlignCenter className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btnClass(editor.isActive({ textAlign: "right" }))}><AlignRight className="h-4 w-4" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button type="button" onClick={() => { setLinkUrl(""); setShowLinkModal(true); }} className={btnClass(editor.isActive("link"))}><LinkIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => { setImageUrl(""); setShowImageModal(true); }} className={btnClass(false)}><ImageIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => setShowTableModal(true)} className={btnClass(false)} title="Insert Lead Summary Table"><TableIcon className="h-4 w-4" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Merge Fields Dropdown */}
        <div className="relative">
          <button type="button" onClick={() => setShowMergeFields(!showMergeFields)} className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            Insert Field <ChevronDown className="h-3 w-3" />
          </button>
          {showMergeFields && (
            <div className="absolute top-full left-0 mt-1 w-56 rounded-md border bg-card shadow-lg z-20 max-h-[300px] overflow-y-auto">
              {MERGE_FIELDS.map((group) => (
                <div key={group.group}>
                  <p className="px-3 pt-2 pb-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{group.group}</p>
                  {group.fields.map((f) => (
                    <button key={f.value} type="button" onClick={() => insertMergeField(f.value)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                      {f.label} <span className="text-xs text-muted-foreground font-mono ml-1">{f.value}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto">
          <button type="button" onClick={() => setShowSource(!showSource)} className={btnClass(showSource)}><Code className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="border-b bg-muted/20 px-4 py-3 flex items-center gap-2">
          <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="flex-1 h-8 rounded border border-input bg-card px-2 text-sm font-[inherit]" autoFocus onKeyDown={(e) => e.key === "Enter" && insertLink()} />
          <button type="button" onClick={insertLink} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Insert</button>
          <button type="button" onClick={() => setShowLinkModal(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div className="border-b bg-muted/20 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL..." className="flex-1 h-8 rounded border border-input bg-card px-2 text-sm font-[inherit]" />
            <button type="button" onClick={insertImage} disabled={!imageUrl} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">Insert URL</button>
          </div>
          <div className="flex items-center gap-2">
            <label className="rounded border border-dashed px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors">
              Upload Image
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <button type="button" onClick={() => setShowImageModal(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Summary Table Modal */}
      {showTableModal && (
        <div className="border-b bg-muted/20 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Select fields for the lead summary table:</p>
          <div className="grid grid-cols-2 gap-1">
            {SUMMARY_TABLE_FIELDS.map((f, i) => (
              <label key={i} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={selectedTableFields.has(i)} onChange={() => {
                  setSelectedTableFields((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  });
                }} className="rounded border-gray-300" />
                {f.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={insertSummaryTable} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Insert Table</button>
            <button type="button" onClick={() => setShowTableModal(false)} className="rounded px-3 py-1 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {/* Editor or Source */}
      {showSource ? (
        <textarea
          value={sourceHtml}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="w-full min-h-[200px] p-3 text-sm font-mono bg-card focus:outline-none font-[inherit]"
        />
      ) : (
        <EditorContent editor={editor} className="bg-card [&_select]:font-[inherit] [&_input]:font-[inherit]" />
      )}
    </div>
  );
}
