export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center">
      <div className="text-center max-w-2xl px-6">
        <h1 className="text-5xl font-bold text-indigo-600 mb-4">DailyDesk</h1>
        <p className="text-xl text-gray-600 mb-8">
          All-in-one productivity tool — coming soon.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm text-gray-500">
          {[
            'PDF Workspace', 'QR Generator', 'Image Compressor',
            'Background Remover', 'Password Generator',
          ].map((tool) => (
            <div key={tool} className="bg-white rounded-lg shadow-sm p-3 border border-indigo-100">
              {tool}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
