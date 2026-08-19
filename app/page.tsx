import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, FileSignature, FolderKanban, Plus, Settings2, Users } from "lucide-react";

const projects = [
  { name: "Business Website", client: "ABC", status: "Development", progress: 65 },
  { name: "Flutter App", client: "XYZ", status: "Agreement Pending", progress: 0 },
  { name: "Discord Automation", client: "DEF", status: "Development", progress: 42 },
  { name: "Portfolio Website", client: "GHI", status: "Completed", progress: 100 },
];
const activity = [["Agreement signed", "ABC · Business Website", "12 min ago"], ["Correction requested", "XYZ · Payment section", "1 hr ago"], ["Phase completed", "DEF · Backend integration", "3 hrs ago"]];

export default function Dashboard() {
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">R</div><div><div className="brand-title">Rahul Development Studio</div><div className="brand-subtitle">Client Management</div></div></div>
      <nav className="nav"><a className="nav-item active" href="/"><BriefcaseBusiness size={16}/> Dashboard</a><a className="nav-item" href="/agreements"><FileSignature size={16}/> Agreements</a><a className="nav-item" href="/projects"><FolderKanban size={16}/> Projects</a><a className="nav-item" href="/clients"><Users size={16}/> Clients</a><a className="nav-item" href="/completed"><CheckCircle2 size={16}/> Completed</a><a className="nav-item" href="/settings"><Settings2 size={16}/> Settings</a></nav>
    </aside>
    <main className="main"><header className="topbar"><div><div className="eyebrow">Developer workspace</div><h1>Good evening, Rahul.</h1></div><div className="top-actions"><button className="btn">View portal</button><a className="btn primary" href="/deals/new"><Plus size={15}/> Create New Deal</a></div></header>
      <section className="metrics"><Metric label="Active Deals" value="4"/><Metric label="Agreements Pending" value="2"/><Metric label="Active Projects" value="3"/><Metric label="Completed Projects" value="17"/></section>
      <section className="content-grid"><div className="panel"><div className="panel-header"><div className="panel-title">Active projects</div><button className="btn">View all <ArrowUpRight size={14}/></button></div>{projects.map((project)=><ProjectRow key={project.name} {...project}/>)}</div><div className="panel"><div className="panel-header"><div className="panel-title">Recent activity</div></div><div className="activity">{activity.map(([title,detail,time])=><div className="activity-item" key={title+time}><span className="dot"/><div><div className="activity-text"><strong>{title}</strong><br/>{detail}</div><div className="activity-time">{time}</div></div></div>)}</div></div></section>
    </main>
  </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>}
function ProjectRow({name,client,status,progress}:{name:string;client:string;status:string;progress:number}){return <div className="project"><div><div className="project-name">{name}</div><div className="project-client">Client · {client}</div></div><div><span className="status">{status}</span></div><div><div className="progress"><span style={{width:`${progress}%`}}/></div><div className="progress-label">{progress}%</div></div><div className="project-status">{progress===100?"Completed":"In progress"}</div></div>}
