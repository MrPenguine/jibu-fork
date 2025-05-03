"use client";

export function SipTrunkConfig() {
  return (
    <div className="p-3 rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-lg font-medium mb-2">Add New SIP Trunk</h3>
      <p className="text-sm text-muted-foreground mb-4">Configure a new SIP trunk connection</p>
      
      <button className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md flex items-center justify-center">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="mr-2"
        >
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>
        Configure New SIP Trunk
      </button>
    </div>
  );
} 