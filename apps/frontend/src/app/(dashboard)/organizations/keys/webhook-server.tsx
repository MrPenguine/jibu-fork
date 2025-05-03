"use client";

type WebhookServerProps = {
  name: string;
  description: string;
  className?: string;
};

export function WebhookServer({ name, description, className = "bg-card" }: WebhookServerProps) {
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
        <button className={`h-6 w-6 rounded-full flex items-center justify-center ${mutedTextClass}`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-4 pb-2">
        <div>
          <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>Webhook URL</label>
          <input 
            type="text" 
            placeholder="https://your-server.com/webhook" 
            className="w-full h-9 px-3 rounded-full border bg-background text-sm" 
          />
        </div>
        <div>
          <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>Secret Key (Optional)</label>
          <input 
            type="password" 
            placeholder="Enter secret key for verification" 
            className="w-full h-9 px-3 rounded-full border bg-background text-sm" 
          />
        </div>
      </div>
      
      <div className="mt-4 flex justify-end">
        <button className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground">
          Save
        </button>
      </div>
    </div>
  );
} 