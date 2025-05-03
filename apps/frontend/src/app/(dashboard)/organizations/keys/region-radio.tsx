"use client";

import { useState } from "react";

type RegionRadioProps = {
  label: string;
  textColorClass?: string;
};

export function RegionRadio({ label, textColorClass = "" }: RegionRadioProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>("");

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
    "koreacentral",
    "canadacentral",
    "francecentral",
    "germanywestcentral",
  ];

  return (
    <div>
      <label className={`text-sm font-medium block mb-1.5 ${textColorClass}`}>{label}</label>
      <div className="border rounded-xl p-2 max-h-60 overflow-y-auto bg-background">
        <div className="space-y-1">
          {regions.map((region) => (
            <div 
              key={region} 
              className="flex items-center"
            >
              <input
                type="radio"
                id={region}
                name="region"
                value={region}
                checked={selectedRegion === region}
                onChange={() => setSelectedRegion(region)}
                className="h-4 w-4 text-primary border-muted rounded-full"
              />
              <label
                htmlFor={region}
                className="ml-2 text-sm cursor-pointer"
              >
                {region}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 