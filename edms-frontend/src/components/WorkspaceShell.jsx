import Sidebar from "./Sidebar";

export default function WorkspaceShell({ children, mainClassName = "" }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground lg:flex-row">
      <Sidebar />
      <main className={`min-w-0 flex-1 ${mainClassName}`.trim()}>{children}</main>
    </div>
  );
}
