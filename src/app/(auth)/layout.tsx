export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-porcelain px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-display text-2xl tracking-tight">
          MatterGuide <span className="text-brass-deep">AI</span>
        </p>
        {children}
      </div>
    </main>
  );
}
