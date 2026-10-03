export function Forbidden({ message = "Forbidden" }: { message?: string }) {
  return (
    <section className="max-w-xl rounded-card bg-surface p-8 shadow-card">
      <h1 className="text-3xl font-medium tracking-tight">Forbidden</h1>
      <p className="mt-3 text-[15px] leading-6 text-muted">{message}</p>
    </section>
  );
}
