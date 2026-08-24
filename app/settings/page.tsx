import { Settings2, ShieldCheck, Database, Info } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">R</div><div><div className="brand-title">Rahul Development Studio</div><div className="brand-subtitle">Client Management</div></div></div>
        <nav className="nav">
          <a className="nav-item" href="/">Dashboard</a>
          <a className="nav-item" href="/agreements">Agreements</a>
          <a className="nav-item" href="/projects">Projects</a>
          <a className="nav-item" href="/clients">Clients</a>
          <a className="nav-item" href="/completed">Completed</a>
          <a className="nav-item active" href="/settings">Settings</a>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">WORKSPACE</div><h1>Settings</h1><p className="page-copy">Workspace configuration and system information.</p></div>
        </header>
        <div className="content-grid">
          <section className="panel">
            <div className="panel-title"><Settings2 size={17}/> Workspace</div>
            <p className="page-copy">Rahul Development Studio Client Management is configured for the current production workspace.</p>
          </section>
          <section className="panel">
            <div className="panel-title"><ShieldCheck size={17}/> Security</div>
            <p className="page-copy">Authentication and access control are managed through Supabase. Use the login and password reset flows for account access changes.</p>
          </section>
          <section className="panel">
            <div className="panel-title"><Database size={17}/> Data</div>
            <p className="page-copy">Projects, agreements, clients and workflow records are stored in the connected RDS-Business Supabase database.</p>
          </section>
          <section className="panel">
            <div className="panel-title"><Info size={17}/> System</div>
            <p className="page-copy">Production workspace is running the current deployed version of the Client Management application.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
