// app/admin/niches/page.tsx

async function getNiches() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/niches`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch niches");
  }

  return res.json();
}

export default async function NichePage() {
  const niches = await getNiches();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Niches</h1>

      <table className="w-full border border-gray-200">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Slug</th>
            <th className="p-3 text-left">Active</th>
          </tr>
        </thead>
        <tbody>
          {niches.map((niche: any) => (
            <tr key={niche.id} className="border-t">
              <td className="p-3">{niche.name}</td>
              <td className="p-3">{niche.slug}</td>
              <td className="p-3">
                {niche.is_active ? "✅" : "❌"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}