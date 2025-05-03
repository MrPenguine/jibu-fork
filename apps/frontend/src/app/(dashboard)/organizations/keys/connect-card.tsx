"use client";

type ConnectCardProps = {
  name?: string;
  description?: string;
  className?: string;
};

export function ConnectCard({ 
  name = "Connect New Provider", 
  description = "Add a new API provider to your organization",
  className = "bg-card"
}: ConnectCardProps) {
  // Determine text colors based on background
  const isDarkCard = className.includes("bg-indigo-950") || className.includes("bg-blue") || className.includes("bg-slate-900");
  
  // No special text colors needed for pale backgrounds
  const textColorClass = isDarkCard ? "text-white" : "";
  const mutedTextClass = isDarkCard ? "text-indigo-200" : "text-muted-foreground";

  return (
    <div className={`p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className={`font-medium text-lg ${textColorClass}`}>{name}</h3>
          <p className={`text-sm ${mutedTextClass}`}>{description}</p>
        </div>
      </div>

      <div className="space-y-4 pb-2">
        <div>
          <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>Provider Type</label>
          <select className="w-full h-9 px-3 rounded-full border bg-background text-sm">
            <option value="">Select a provider type</option>
            <option value="stt">Speech-to-Text</option>
            <option value="tts">Text-to-Speech</option>
            <option value="llm">Large Language Model</option>
            <option value="cloud">Cloud Provider</option>
            <option value="telephony">Telephony</option>
          </select>
        </div>

        <div>
          <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>Provider Name</label>
          <input 
            type="text" 
            placeholder="Enter provider name" 
            className="w-full h-9 px-3 rounded-full border bg-background text-sm" 
          />
        </div>

        <div>
          <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>API Endpoint</label>
          <input 
            type="text" 
            placeholder="https://" 
            className="w-full h-9 px-3 rounded-full border bg-background text-sm" 
          />
        </div>

        <div>
          <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>API Key</label>
          <input 
            type="password" 
            placeholder="Enter API Key" 
            className="w-full h-9 px-3 rounded-full border bg-background text-sm" 
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground">
          Connect
        </button>
      </div>
    </div>
  );
} 