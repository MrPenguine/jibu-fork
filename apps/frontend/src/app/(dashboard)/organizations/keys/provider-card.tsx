"use client";

type ProviderCardProps = {
  name: string;
  description: string;
  fields?: {
    name: string;
    label: string;
    placeholder: string;
  }[];
  className?: string;
};

export function ProviderCard({ name, description, fields = [], className = "bg-card" }: ProviderCardProps) {
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
        {fields.length > 0 ? (
          fields.map((field) => (
            <div key={field.name}>
              <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>{field.label}</label>
              <input 
                type="text" 
                placeholder={field.placeholder} 
                className="w-full h-9 px-3 rounded-full border bg-background text-sm" 
              />
            </div>
          ))
        ) : (
          <>
            <div>
              <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>API Key</label>
              <input 
                type="text" 
                placeholder="Enter API Key" 
                className="w-full h-9 px-3 rounded-full border bg-background text-sm" 
              />
            </div>

            <div>
              <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>User ID</label>
              <input 
                type="text" 
                placeholder="Enter User ID" 
                className="w-full h-9 px-3 rounded-full border bg-background text-sm" 
              />
            </div>
          </>
        )}
      </div>
      
      <div className="mt-4 flex justify-end">
        <button className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground">
          Save
        </button>
      </div>
    </div>
  );
} 