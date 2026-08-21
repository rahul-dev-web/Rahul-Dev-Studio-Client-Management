"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, FileSignature, FolderKanban, Plus, Settings2, Sparkles, Users } from "lucide-react";
import { createClient } from "../lib/supabase/browser";

type Deal = { id: string; status: string };
type Project = { id: string; project_code: string; project_name: string | null; status: string; deal_id: string };
type Topic = { project_id: string; status: string };

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [agreements, setAgreements] = useState<{ status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = "/login"; return; }

        // Scope the entire dashboard to the signed-in developer. This keeps the
        // UI correct even if more developer accounts are added later.
        const { data: liveDeals, error: dealsError } = await supabase
          .from("deals")
          .select("id,status")
          .eq("developer_id", user.id);
        if (dealsError) { setError(dealsError.message); setLoading(false); return; }

        const dealRows = liveDeals || [];
        const dealIds = dealRows.map(d => d.id);
        const [agreementsResult, projectsResult] = await Promise.all([
          dealIds.length
            ? supabase.from("agreements").select("status").in("deal_id", dealIds).in("status", ["sent", "under_review", "correction_requested", "client_signed"])
            : Promise.resolve({ data: [], error: null }),
          dealIds.length
            ? supabase.from("projects").select("id,project_code,project_name,status,deal_id").in("deal_id", dealIds).order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ]);

        const firstError = agreementsResult.error || projectsResult.error;
        if (firstError) { setError(firstError.message); setLoading(false); return; }

        const liveProjects = projectsResult.data || [];
        const { data: liveTopics, error: topicError } = liveProjects.length
          ? await supabase.from("phase_topics").select("project_id,status").in("project_id", liveProjects.map(p => p.id))
          : { data: [], error: null };
        if (topicError) { setError(topicError.message); setLoading(false); return; }

        setDeals(dealRows);
        setAgreements(agreementsResult.data || []);
        setProjects(liveProjects);
        setTopics(liveTopics || []);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load the dashboard.");
        setLoading(false);
      }
    })();
  }, []);

  const activeDeals = deals.filter(d => d.status === "active").length;
  const pendingAgreements = agreements.length;
  const activeProjects = projects.filter(p => ["in_development", "development_complete", "handover"].includes(p.status)).length;
  const completedProjects = projects.filter(p => p.status === "completed").length;
  const projectRows = useMemo(() => projects.slice(0, 6).map(project => {
    const pts = topics.filter(topic => topic.project_id === project.id);
    const progress = pts.length ? Math.round(pts.filter(t => t.status === "completed").length / pts.length * 100) : 0;
    return { ...project, progress, label: project.status.replaceAll("_", " ") };
  }), [projects, topics]);
  const overallProgress = topics.length ? Math.round(topics.filter(t => t.status === "completed").length / topics.length * 100) : 0;

  if (loading) return <main className="main"><div className="loading-shell"><div className="loading-orb"/><span>Preparing your workspace…</span></div></main>;
  if (error) return <main className="main"><div className="panel error-panel"><div className="eyebrow">DEVELOPER WORKSPACE</div><h1>Dashboard</h1><div className="form-error">{error}</div></div></main>;

  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">R</div><div><div className="brand-title">Rahul Development Studio</div><div className="brand-subtitle">Client Management</div></div></div><div className="workspace-chip"><span className="workspace-dot"/> Developer workspace</div>
      <nav className="nav"><a className="nav-item active" href="/"><BriefcaseBusiness size={16}/> Dashboard</a><a className="nav-item" href="/agreements"><FileSignature size={16}/> Agreements</a><a className="nav-item" href="/projects"><FolderKanban size={16}/> Projects</a><a className="nav-item" href="/clients"><Users size={16}/> Clients</a><a className="nav-item" href="/completed"><CheckCircle2 size={16}/> Completed</a><a className="nav-item" href="/settings"><Settings2 size={16}/> Settings</a></nav>
      <div className="sidebar-footer"><div className="mini-avatar">R</div><div className="sidebar-user"><strong>Developer</strong><span>RDS workspace</span></div></div>
    </aside>
    <main className="main"><header className="topbar"><div><div className="eyebrow">Developer workspace · Live overview</div><h1>Dashboard</h1><p className="page-copy">Manage deals, agreements and every stage of client delivery from one workspace.</p></div><div className="top-actions"><a className="btn primary" href="/deals/new"><Plus size={15}/> Create New Deal</a></div></header>
      <section className="hero-strip"><div><div className="hero-kicker"><Sparkles size={14}/> RDS DELIVERY OVERVIEW</div><h2>Keep every client milestone moving.</h2><p>Progress is calculated from live project topics rather than manually entered percentages.</p></div><div className="hero-score"><span>Overall delivery</span><strong>{overallProgress}%</strong><div className="hero-track"><i style={{width:`${overallProgress}%`}}/></div></div></section>
      <section className="metrics"><Metric label="Active Deals" value={String(activeDeals)} hint="Currently in progress" icon={<BriefcaseBusiness size={17}/>} /><Metric label="Pending Agreements" value={String(pendingAgreements)} hint="Need client action" icon={<FileSignature size={17}/>} /><Metric label="Active Projects" value={String(activeProjects)} hint="Delivery underway" icon={<FolderKanban size={17}/>} /><Metric label="Completed Projects" value={String(completedProjects)} hint="Archived successfully" icon={<CheckCircle2 size={17}/>} /></section>
      <section className="content-grid"><div className="panel project-panel"><div className="panel-header"><div><div className="panel-title">Active delivery</div><div className="panel-subtitle">Your latest project records</div></div><a className="btn" href="/projects">View all <ArrowUpRight size={14}/></a></div><div className="project-list">{projectRows.map(project => <ProjectRow key={project.id} name={project.project_name || project.project_code} code={project.project_code} status={project.label} progress={project.progress}/>)}{!projectRows.length&&<div className="empty-state">No projects have been activated yet.</div>}</div></div><div className="panel workflow-panel"><div className="panel-header"><div><div className="panel-title">Workflow health</div><div className="panel-subtitle">Deal → agreement → delivery → handover</div></div></div><WorkflowItem label="Deals" value={activeDeals ? "Active" : "Ready"} done={activeDeals > 0}/><WorkflowItem label="Agreements" value={pendingAgreements ? `${pendingAgreements} awaiting action` : "Clear"} done={pendingAgreements === 0}/><WorkflowItem label="Project progress" value={activeProjects ? "Tracking live" : "Ready"} done={activeProjects > 0}/><WorkflowItem label="Handover" value={completedProjects ? "History available" : "Controlled"} done={completedProjects > 0}/></div></section>
      <section className="quick-actions"><a href="/deals/new"><Plus size={16}/><span><strong>New deal</strong><small>Start a client engagement</small></span><ArrowUpRight size={14}/></a><a href="/agreements"><FileSignature size={16}/><span><strong>Agreements</strong><small>Review signatures and corrections</small></span><ArrowUpRight size={14}/></a><a href="/projects"><FolderKanban size={16}/><span><strong>Projects</strong><small>Update phases and progress</small></span><ArrowUpRight size={14}/></a></section>
      <nav className="mobile-nav"><a className="active" href="/"><BriefcaseBusiness size={17}/><span>Home</span></a><a href="/agreements"><FileSignature size={17}/><span>Agreements</span></a><a href="/projects"><FolderKanban size={17}/><span>Projects</span></a><a href="/clients"><Users size={17}/><span>Clients</span></a><a href="/settings"><Settings2 size={17}/><span>More</span></a></nav>
    </main>
  </div>;
}

function Metric({label,value,hint,icon}:{label:string;value:string;hint:string;icon:React.ReactNode}){return <div className="metric"><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span></div><div className="metric-value">{value}</div><div className="metric-hint">{hint}</div></div>}
function WorkflowItem({label,value,done}:{label:string;value:string;done:boolean}){return <div className="workflow-item"><span className={`workflow-dot ${done ? "done" : ""}`}>{done ? <CheckCircle2 size={12}/> : "·"}</span><div><strong>{label}</strong><span>{value}</span></div></div>}
function ProjectRow({name,code,status,progress}:{name:string;code:string;status:string;progress:number}){return <div className="project"><div className="project-main"><div className="project-avatar">{name.charAt(0).toUpperCase()}</div><div><div className="project-name">{name}</div><div className="project-client">{code}</div></div></div><span className="status"><span className="status-dot"/>{status}</span><div className="project-progress"><div className="progress"><span style={{width:`${progress}%`}}/></div><div className="progress-label">{progress}%</div></div><div className="project-status">{progress===100 ? "Completed" : progress > 0 ? "In progress" : "Not started"}</div></div>}
