import AppShell from "@/components/AppShell";

export default function Home() {
  return (
    <main className="main-container">
      <div className="hero">
        <h1 className="title flex items-center justify-center gap-4 text-center">
          <span className="text-5xl">🚀</span>
          <span>Autonomous Career Agent</span>
        </h1>
      </div>

      <AppShell />
    </main>
  );
}
