export function Dots({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="mb-4 flex gap-1.5">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-indigo9" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

export function ObShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: 1 | 2 | 3 | 4;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-md px-6 pb-10 pt-8">
      <Dots step={step} />
      <h1 className="text-xl font-extrabold leading-snug">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </main>
  );
}

export const inputCls =
  "mt-1.5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base font-bold focus:border-indigo9 focus:outline-none";
export const labelCls =
  "block text-[11px] font-extrabold uppercase tracking-widest text-gray-500";
export const ctaCls =
  "mt-5 w-full rounded-2xl bg-mango px-5 py-4 text-sm font-extrabold text-[#3A2A00]";
