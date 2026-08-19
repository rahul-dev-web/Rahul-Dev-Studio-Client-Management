"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronDown, Mail, Phone, Plus, Save, Trash2 } from "lucide-react";

const defaultScopes = ["Responsive website", "Admin dashboard", "Authentication", "Database", "Deployment"];
const defaultDeliverables = ["Production-ready web application", "Responsive layouts", "Source code and deployment"];

export default function NewDealPage() {
  const [scopes, setScopes] = useState(defaultScopes);
  const [deliverables, setDeliverables] = useState(defaultDeliverables);
  const [revisions, setRevisions] = useState("2");
  const [supportDays, setSupportDays] = useState("20");
  const [saved, setSaved] = useState(false);

  function addItem(setter: React.Dispatch<React.SetStateAction<string[]>>) { setter((items) => [...items, ""]); }
  function updateItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) { setter((items) => items.map((item, i) => i === index ? value : item)); }
  function removeItem(setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) { setter((items) => items.filter((_, i) => i !== index)); }
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">R</div><div><div className="brand-title">Rahul Development Studio</div><div className="brand-subtitle">Client Management</div></div></div>
        <nav className="nav">
          <a className="nav-item" href="/">Dashboard</a><a className="nav-item" href="/agreements">Agreements</a><a className="nav-item" href="/projects">Projects</a><a className="nav-item" href="/clients">Clients</a><a className="nav-item" href="/completed">Completed</a><a className="nav-item" href="/settings">Settings</a>
        </nav>
      </aside>

      <main className="main deal-main">
        <div className="form-topbar">
          <div><a className="back-link" href="/"><ArrowLeft size={15} /> Back to dashboard</a><div className="eyebrow">New deal</div><h1>Create New Deal</h1><p className="page-copy">Capture the client, project and commercial terms before creating the agreement.</p></div>
          <div className="top-actions"><button type="submit" form="deal-form" className="btn primary"><Save size={15} /> Save Draft</button></div>
        </div>

        <form id="deal-form" className="deal-form" onSubmit={handleSubmit}>
          <FormSection number="01" title="Client information" description="Who is the agreement with?"><div className="field-grid three"><Field label="Client name" placeholder="e.g. Amit Sharma" required /><Field label="Business / organization" placeholder="e.g. ABC Technologies" required /><Field label="Email" type="email" placeholder="client@example.com" icon={<Mail size={15} />} required /><Field label="Phone" placeholder="+91 98765 43210" icon={<Phone size={15} />} /><Field label="Address" placeholder="Optional client address" wide /></div></FormSection>
          <FormSection number="02" title="Project information" description="Define the work at a high level."><div className="field-grid three"><Field label="Project name" placeholder="e.g. Business Website" required /><SelectField label="Project type" options={["Website", "Web application", "Mobile app", "Discord bot", "Other"]} /><Field label="Technology" placeholder="e.g. Next.js, Supabase" /><Field label="Start date" type="date" icon={<CalendarDays size={15} />} /><Field label="Expected delivery" type="date" icon={<CalendarDays size={15} />} /><Field label="Project description" placeholder="Short summary of the project and its objective" wide textarea /></div></FormSection>
          <FormSection number="03" title="Commercial terms" description="Set the financial structure that will appear in the agreement."><div className="field-grid three"><Field label="Total project amount (₹)" type="number" placeholder="15000" required /><Field label="Advance amount (₹)" type="number" placeholder="5000" /><Field label="Remaining amount (₹)" type="number" placeholder="10000" /><SelectField label="Payment schedule" options={["100% advance", "50% advance / 50% on delivery", "Milestone based", "Custom"]} /><Field label="Revision rounds" type="number" value={revisions} onChange={(e) => setRevisions(e.target.value)} /><Field label="Bug-fix support (days)" type="number" value={supportDays} onChange={(e) => setSupportDays(e.target.value)} /></div><div className="helper-note">Default policy: <strong>{revisions || "0"} revision rounds</strong> and <strong>{supportDays || "0"}-day bug-fix support</strong>. These can be changed per deal.</div></FormSection>
          <ListSection title="Scope" description="What is included in the development scope?" items={scopes} setter={setScopes} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />
          <ListSection title="Deliverables" description="What will the client receive at handover?" items={deliverables} setter={setDeliverables} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />
          <section className="deal-actions"><a className="btn" href="/">Cancel</a><button className="btn primary" type="submit"><Save size={15} /> {saved ? "Draft Saved" : "Save Deal Draft"}</button></section>
        </form>
      </main>
    </div>
  );
}

function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) { return <section className="form-section"><div className="section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>; }

function Field({ label, placeholder, type = "text", required, wide, icon, textarea, value, onChange }: { label: string; placeholder?: string; type?: string; required?: boolean; wide?: boolean; icon?: React.ReactNode; textarea?: boolean; value?: string; onChange?: React.ChangeEventHandler<HTMLInputElement> }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}{required && <em>*</em>}</span><div className={`control ${icon ? "has-icon" : ""}`}>{icon}{textarea ? <textarea placeholder={placeholder} rows={4} required={required} /> : <input type={type} placeholder={placeholder} required={required} value={value} onChange={onChange} />}</div></label>; }

function SelectField({ label, options }: { label: string; options: string[] }) { return <label className="field"><span>{label}</span><div className="control select-control"><select defaultValue=""><option value="" disabled>Select {label.toLowerCase()}</option>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={15} /></div></label>; }

function ListSection({ title, description, items, setter, addItem, updateItem, removeItem }: { title: string; description: string; items: string[]; setter: React.Dispatch<React.SetStateAction<string[]>>; addItem: (setter: React.Dispatch<React.SetStateAction<string[]>>) => void; updateItem: (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => void; removeItem: (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => void }) { return <section className="form-section"><div className="section-heading"><span>+</span><div><h2>{title}</h2><p>{description}</p></div></div><div className="repeat-list">{items.map((item, index) => <div className="repeat-row" key={`${title}-${index}`}><span className="item-index">{index + 1}</span><input value={item} onChange={(e) => updateItem(setter, index, e.target.value)} placeholder={`Add ${title.toLowerCase()} item`} /><button type="button" className="icon-btn" onClick={() => removeItem(setter, index)} aria-label={`Remove ${title} item`}><Trash2 size={15} /></button></div>)}</div><button type="button" className="add-row" onClick={() => addItem(setter)}><Plus size={15} /> Add {title} item</button></section>; }
