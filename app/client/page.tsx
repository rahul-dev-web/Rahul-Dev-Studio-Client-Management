"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, FileSignature, LogOut, MessageSquare, ShieldCheck } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

type Project = { id: string; project_code: string; project_name: string | null; status: string; start_date: string | null; expected_delivery_date: string | null; agreement_id: string | null };
type Phase = { id: string; name: string; phase_order: number };
type Topic = { id: string; phase_id: string; title: string; status: string };
type History = { id: string; progress_percent: number; old_status: string | null; new_status: string | null; note: string | null; created_at: string };
type Agreement = { id: string; agreement_code: string; status: string; deal_id: string };
type Deal = { project_name: string; expected_delivery_date: string | null };

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "TBD";
const label = (value: string | null | undefined) => value ? value.replaceAll("_", " ") : "—";

export default function ClientPortal() {
  const [project,setProject]=useState<Project|null>(null),[phases,setPhases]=useState<Phase[]>([]),[topics,setTopics]=useState<Topic[]>([]),[history,setHistory]=useState<History[]>([]),[agreement,setAgreement]=useState<Agreement|null>(null),[deal,setDeal]=useState<Deal|null>(null),[name,setName]=useState("Client"),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{(async()=>{
    const s=createClient();
    const {data:{user}}=await s.auth.getUser();
    if(!user){window.location.href="/login";return;}
    const {data:p}=await s.from("profiles").select("full_name").eq("id",user.id).single();
    setName(p?.full_name||"Client");

    const {data:pr,error:e}=await s.from("projects")
      .select("id,project_code,project_name,status,start_date,expected_delivery_date,agreement_id")
      .eq("client_id",user.id)
      .order("created_at",{ascending:false})
      .limit(1)
      .single();
    if(e||!pr){
      setError(e?.message||"Your project portal is not active yet.");
      setLoading(false);
      return;
    }
    setProject(pr);

    const {data:ag}=pr.agreement_id
      ? await s.from("agreements").select("id,agreement_code,status,deal_id").eq("id",pr.agreement_id).single()
      : {data:null};
    const {data:ph}=await s.from("project_phases").select("id,name,phase_order").eq("project_id",pr.id).order("phase_order");
    const phaseRows=ph||[];
    const phaseIds=phaseRows.map((phase)=>phase.id);
    const {data:to}=phaseIds.length
      ? await s.from("phase_topics").select("id,phase_id,title,status").in("phase_id",phaseIds).order("topic_order")
      : {data:[] as Topic[]};
    const {data:h}=await s.from("progress_history").select("id,progress_percent,old_status,new_status,note,created_at").eq("project_id",pr.id).order("created_at",{ascending:false}).limit(20);

    setAgreement(ag||null);
    setPhases(phaseRows);
    setTopics(to||[]);
    setHistory(h||[]);
    if(ag){
      const {data:d}=await s.from("deals").select("project_name,expected_delivery_date").eq("id",ag.deal_id).single();
      setDeal(d||null);
    }
    setLoading(false);
  })()},[]);
  const completed=useMemo(()=>topics.filter(t=>t.status==="completed").length,[topics]);
  const progress=topics.length?Math.round(completed/topics.length*100):0;
  const completedPhases=useMemo(()=>phases.filter(phase=>{const ts=topics.filter(t=>t.phase_id===phase.id);return ts.length>0&&ts.every(t=>t.status==="completed")}).length,[phases,topics]);
  const latestHistory=history[0];
  async function logout(){await createClient().auth.signOut();window.location.href="/login";}
  if(loading)return <div className="auth-shell"><div className="panel">Loading your portal…</div></div>;
  if(error)return <div className="auth-shell"><div className="panel"><div className="eyebrow">CLIENT PORTAL</div><h1>Portal unavailable</h1><div className="form-error">{error}</div></div></div>;
  return <main className="client-shell">
    <header className="client-header"><div className="brand"><div className="brand-mark">R</div><div><div className="brand-title">Rahul Development Studio</div><div className="brand-subtitle">Private Client Portal</div></div></div><div className="top-actions"><span className="status"><ShieldCheck size={12}/> Secure workspace</span><button className="btn" onClick={logout}><LogOut size={15}/> Sign out</button></div></header>
    <div className="client-main">
      <div className="eyebrow">CLIENT PORTAL · {project?.project_code}</div><h1>Welcome, {name}</h1><p className="page-copy">A private, read-only view of your agreement, delivery progress and project timeline.</p>
      <div className="client-hero panel"><div><div className="eyebrow">PROJECT</div><h2>{project?.project_name||deal?.project_name||project?.project_code}</h2><span className="status"><span className="status-dot"/>{label(project?.status)}</span><div className="archive-grid"><div className="archive-card"><Clock3 size={16}/><span><small>Expected delivery</small><strong>{formatDate(project?.expected_delivery_date||deal?.expected_delivery_date||null)}</strong></span></div><div className="archive-card"><FileSignature size={16}/><span><small>Agreement</small><strong>{agreement?.agreement_code||"Pending"}</strong></span></div></div></div><div className="hero-progress"><span>Delivery progress</span><strong>{progress}%</strong><div className="progress"><span style={{width:`${progress}%`}}/></div><small>{completed} of {topics.length} topics · {completedPhases} of {phases.length} phases complete</small>{latestHistory&&<div className="save-note"><Clock3 size={12}/> Updated {formatDate(latestHistory.created_at)}</div>}</div></div>
      <section className="metrics" style={{marginTop:18}}><div className="metric"><div className="metric-top"><span className="metric-icon"><FileSignature size={16}/></span><span className="metric-label">Agreement</span></div><div className="metric-value" style={{fontSize:18}}>{label(agreement?.status)}</div><div className="metric-hint">{agreement?.agreement_code||"No agreement linked"}</div></div><div className="metric"><div className="metric-top"><span className="metric-icon"><FolderIcon/></span><span className="metric-label">Project stage</span></div><div className="metric-value" style={{fontSize:18}}>{label(project?.status)}</div><div className="metric-hint">Live from your project record</div></div><div className="metric"><div className="metric-top"><span className="metric-icon"><Check size={16}/></span><span className="metric-label">Completed</span></div><div className="metric-value" style={{fontSize:18}}>{completed}/{topics.length}</div><div className="metric-hint">Development topics</div></div><div className="metric"><div className="metric-top"><span className="metric-icon"><Clock3 size={16}/></span><span className="metric-label">Delivery</span></div><div className="metric-value" style={{fontSize:18}}>{formatDate(project?.expected_delivery_date||deal?.expected_delivery_date||null)}</div><div className="metric-hint">Target date</div></div></section>
      <div className="client-grid"><section className="panel"><div className="panel-header"><div><div className="eyebrow">DELIVERY PLAN</div><div className="panel-title">Project timeline</div><div className="panel-subtitle">Development phases are updated by the studio.</div></div><span className="status"><Clock3 size={12}/> {formatDate(project?.expected_delivery_date||deal?.expected_delivery_date||null)}</span></div><div className="timeline">{phases.map((phase,i)=>{const ts=topics.filter(t=>t.phase_id===phase.id);const done=ts.length>0&&ts.every(t=>t.status==="completed");const phaseProgress=ts.length?Math.round(ts.filter(t=>t.status==="completed").length/ts.length*100):0;return <div className="timeline-item" key={phase.id}><div className={`timeline-icon ${done?"done":""}`}>{done?<Check size={13}/>:i+1}</div><div className="timeline-content"><strong>{phase.name}</strong><p>{ts.length?`${ts.filter(t=>t.status==="completed").length}/${ts.length} topics completed`:"Phase not started"}</p><div className="phase-progress"><span style={{width:`${phaseProgress}%`}}/></div></div><span className="status">{phaseProgress===100?"Complete":phaseProgress?`${phaseProgress}%`:"Pending"}</span></div>})}{!phases.length&&<p className="page-copy">Your development phases will appear here once the developer starts the project.</p>}</div></section>
      <aside className="panel"><div className="eyebrow">DOCUMENTS & SUPPORT</div><div className="panel-title"><ShieldCheck size={16}/> Agreement</div><p className="page-copy">{agreement?.agreement_code||"Agreement pending"}</p><div className="portal-card-row"><span>Status</span><strong>{label(agreement?.status)}</strong></div><p className="page-copy" style={{marginTop:16}}>Agreement viewing is temporarily unavailable while access controls are being hardened.</p><div className="action-divider"/><div className="panel-title"><MessageSquare size={16}/> Need a change?</div><p className="page-copy">Corrections can be requested before signing. Signed agreements require a formal amendment.</p>{agreement&&["sent","under_review"].includes(agreement.status)&&<a className="btn" href={`/agreements/${agreement.id}`}><MessageSquare size={14}/> Request correction</a>}</aside></div>
      <section className="panel client-history"><div className="panel-header"><div><div className="eyebrow">AUDIT TRAIL</div><div className="panel-title">Progress history</div><div className="panel-subtitle">A timestamped record of delivery updates.</div></div><Clock3 size={16}/></div>{history.length?history.map(item=><div className="record-row" key={item.id}><div><strong>{item.note||`${label(item.old_status)} → ${label(item.new_status)}`}</strong><span>{formatDate(item.created_at)}</span></div><strong>{item.progress_percent}%</strong></div>):<div className="empty-state">No progress changes recorded yet.</div>}</section>
      <div className="archive-note"><ShieldCheck size={17}/><div><strong>Your portal is read-only</strong><p>Project status, phases and agreement records are controlled by Rahul Development Studio. This keeps the client view secure and prevents accidental changes.</p></div></div>
    </div>
  </main>;
}

function FolderIcon(){return <span style={{fontSize:15}}>◈</span>}
