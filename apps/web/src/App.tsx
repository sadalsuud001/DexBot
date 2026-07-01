import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import {
  Bell,
  Bot,
  Boxes,
  Brain,
  Gauge,
  MessageSquare,
  Package,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { RobotsPage } from "./features/robots/RobotsPage";

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="flex">
          <aside className="min-h-screen w-72 border-r border-slate-800 bg-slate-950 p-4">
            <div className="mb-8">
              <div className="text-xl font-semibold text-white">DexBot</div>
              <div className="mt-1 text-xs text-slate-500">
                Robot Fleet Operations
              </div>
            </div>

            <nav className="space-y-1 text-sm">
              <NavItem to="/" label="Dashboard" icon={<Gauge />} />
              <NavItem to="/forum" label="Forum" icon={<MessageSquare />} />
              <NavItem to="/wiki" label="Wiki" icon={<Shield />} />
              <NavItem to="/software" label="Software Hub" icon={<Package />} />
              <NavItem to="/robots" label="Robots" icon={<Bot />} />
              <NavItem to="/fleet" label="Fleet" icon={<Boxes />} />
              <NavItem to="/agents" label="Agent Console" icon={<Brain />} />
              <NavItem to="/groups" label="Groups" icon={<Users />} />
              <NavItem to="/notifications" label="Notifications" icon={<Bell />} />
              <NavItem to="/settings" label="Settings" icon={<Settings />} />
            </nav>
          </aside>

          <main className="min-h-screen flex-1 bg-slate-950 p-6">
            <Routes>
              <Route path="/" element={<PlaceholderPage title="Fleet Dashboard" />} />
              <Route path="/forum" element={<PlaceholderPage title="Forum" />} />
              <Route path="/wiki" element={<PlaceholderPage title="Wiki" />} />
              <Route path="/software" element={<PlaceholderPage title="Software Hub" />} />
              <Route path="/robots" element={<RobotsPage />} />
              <Route path="/fleet" element={<PlaceholderPage title="Fleet Orchestration" />} />
              <Route path="/agents" element={<PlaceholderPage title="Agent Console" />} />
              <Route path="/groups" element={<PlaceholderPage title="Groups" />} />
              <Route path="/notifications" element={<PlaceholderPage title="Notifications" />} />
              <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

function NavItem({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-lg px-3 py-2.5 transition",
          "[&_svg]:h-4 [&_svg]:w-4",
          isActive
            ? "bg-slate-800 text-white"
            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
        ].join(" ")
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">
        This module will be connected to the DexBot API in the next milestones.
      </p>
    </section>
  );
}