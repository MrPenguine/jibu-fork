"use client";

import { useState } from "react";

type RegionDropdownProps = {
  label: string;
  placeholder: string;
  textColorClass?: string;
};

export function RegionDropdown({ label, placeholder, textColorClass = "" }: RegionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const regions = [
    "eastus",
    "eastus2",
    "southcentralus",
    "westus2",
    "westus3",
    "australiaeast",
    "southeastasia",
    "northeurope",
    "swedencentral",
    "uksouth",
    "westeurope",
    "centralus",
    "northcentralus",
    "westus",
    "southafricanorth",
    "centralindia",
    "eastasia",
    "japaneast",
    "jioindiawest",
    "koreacentral",
    "canadacentral",
    "francecentral",
    "germanywestcentral",
    "italynorth",
    "qatarcentral",
    "switzerlandnorth",
    "uaenorth",
    "brazilsouth",
    "centraluseuap",
    "eastus2euap",
    "israelcentral",
    "qatarcentral",
  ];

  return (
    <div className="space-y-1.5">
      <label className={`text-sm font-medium block ${textColorClass}`}>{label}</label>
      <div className="relative">
        <button
          type="button"
          className="flex justify-between items-center w-full h-9 px-3 rounded-full border bg-background text-sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={selectedRegion ? "" : "text-muted-foreground"}>
            {selectedRegion || placeholder}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isOpen ? (
              <polyline points="18 15 12 9 6 15" />
            ) : (
              <polyline points="6 9 12 15 18 9" />
            )}
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border bg-card shadow-md max-h-60 overflow-auto">
            <div className="p-1">
              {regions.map((region) => (
                <button
                  key={region}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-accent ${
                    selectedRegion === region ? "bg-accent/50" : ""
                  }`}
                  onClick={() => {
                    setSelectedRegion(region);
                    setIsOpen(false);
                  }}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 