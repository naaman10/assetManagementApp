export function Forbidden({ message = "Forbidden" }: { message?: string }) {
  return (
    <section className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs">
      <h1 className="text-2xl font-semibold text-gray-800">Forbidden</h1>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </section>
  );
}
