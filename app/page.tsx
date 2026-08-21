"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, FileSignature, FolderKanban, Plus, Settings2, Users } from "lucide-react";
import { createClient } from "../lib/supabase/browser";

type Project = { id: string; project_code: string; project_name: string | null; status: string; deal_id: string };
type Topic = { project_id: string; status: string };

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [deals, setDeals] = useState<{ status: string }[]>([]);
  const [agreements, setAgreements] = useState<{ status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = "/login"; return; }

        // Keep every dashboard query scoped to the authenticated developer.
        const [dealsResult, agreementsResult, projectsResult] = await Promise.all([
          supabase.from("deals").select("status").eq("developer_id", user.id),
          supabase
            .from("agreements")
            .select("status")
            .in("status", ["sent", "under_review", "correction_requested", "client_signed"]),
          supabase
            .from("projects")
            .select("id,project_code,project_name,status,deal_id")
            .order("created_at", { ascending: false }),
        ]);

        const firstError = dealsResult.error || agreementsResult.error || projectsResult.error;
        if (firstError) { setError(firstError.message); setLoading(false); return; }

        const liveProjects = projectsResult.data || [];
        const { data: liveTopics, error: topicError } = liveProjects.length
          ? await supabase.from("phase_topics").select("project_id,status").in("project_id", liveProjects.map(p => p.id))
          : { data: [], error: null };
        if (topicError) { setError(topicError.message); setLoading(false); return; }

        setDeals(dealsResult.data || []);
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

  const projectRows = useMemo(() => projects.slice(0, 8).map(project => {
    const pts = topics.filter(topic => topic.project_id === project.id);
    const progress = pts.length ? Math.round(pts.filter(t => t.status === "completed").length / pts.length * 100) : 0;
    return {
      name: project.project_name || project.project_code,
      client: project.project_code,
      status: project.status.replaceAll("_", " "),
      progress,
    };
  }), [projects, topics]);

  if (loading) return <main className="main"><div className="panel">Loading dashboard…</div></main>;
  if (error) return <main className="main"><div className="panel"><div className="eyebrow">DEVELOPER WORKSPACE</div><h1>Dashboard</h1><div className="form-error">{error}</div></div></main>;

  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">R</div><div><div className="brand-title">Rahul Development Studio</div><div className="brand-subtitle">Client Management</div></div></div>
      <nav className="nav"><a className="nav-item active" href="/"><BriefcaseBusiness size={16}/> Dashboard</a><a className="nav-item" href="/agreements"><FileSignature size={16}/> Agreements</a><a className="nav-item" href="/projects"><FolderKanban size={16}/> Projects</a><a className="nav-item" href="/clients"><Users size={16}/> Clients</a><a className="nav-item" href="/completed"><CheckCircle2 size={16}/> Completed</a><a className="nav-item" href="/settings"><Settings2 size={16}/> Settings</a></nav>
    </aside>
    <main className="main"><header className="topbar"><div><div className="eyebrow">Developer workspace</div><h1>Dashboard</h1><p className="page-copy">Live overview of deals, agreements and project delivery.</p></div><div className="top-actions"><a className="btn primary" href="/deals/new"><Plus size={15}/> Create New Deal</a></div></header>
      <section className="metrics"><Metric label="Active Deals" value={String(activeDeals)}/><Metric label="Agreements Pending" value={String(pendingAgreements)}/><Metric label="Active Projects" value={String(activeProjects)}/><Metric label="Completed Projects" value={String(completedProjects)}/></section>
      <section className="content-grid"><div className="panel"><div className="panel-header"><div className="panel-title">Projects</div><a className="btn" href="/projects">View all <ArrowUpRight size={14}/></a></div>{projectRows.map(project=><ProjectRow key={project.name+project.client} {...project}/>)}{!projectRows.length&&<div className="empty-state">No projects have been activated yet.</div>}</div><div className="panel"><div className="panel-header"><div className="panel-title">Workflow</div></div><div className="activity"><div className="activity-item"><span className="dot"/><div><div className="activity-text"><strong>Deal → Agreement → Project</strong><br/>Live records are now sourced from Supabase.</div></div></div><div className="activity-item"><span className="dot"/><div><div className="activity-text"><strong>Progress automation</strong><br/>Topic completion drives the project percentage.</div></div></div><div className="activity-item"><span className="dot"/><div><div className="activity-text"><strong>Handover control</strong><br/>Completed projects require explicit confirmation.</div></div></div></div></div></section>
    </main>
  </div>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>}
function ProjectRow({name,client,status,progress}:{name:string;client:string;status:string;progress:number}){return <div className="project"><div><div className="project-name">{name}</div><div className="project-client">Project · {client}</div></div><div><span className="status">{status}</span></div><div><div className="progress"><span style={{width:`${progress}%`}}/></div><div className="progress-label">{progress}%</div></div><div className="project-status">{progress===100?"Completed":"In progress"}</div></div>}
