import * as React from "react"
import { cn } from "@libs/shadcn-ui/lib/utils"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"

// Custom Card with rounded corners and no border
const CustomCard = React.forwardRef<
  React.ElementRef<typeof Card>,
  React.ComponentPropsWithoutRef<typeof Card>
>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn("rounded-xl shadow-sm border-0 bg-slate-50/70 dark:bg-slate-900/40", className)}
    {...props}
  />
))
CustomCard.displayName = "CustomCard"

// Custom Danger Card with rounded corners and no border (for danger zones)
const CustomDangerCard = React.forwardRef<
  React.ElementRef<typeof Card>,
  React.ComponentPropsWithoutRef<typeof Card>
>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn("rounded-xl shadow-sm border-0 bg-red-50/70 dark:bg-red-900/20", className)}
    {...props}
  />
))
CustomDangerCard.displayName = "CustomDangerCard"

// Card content with more padding
const CustomCardContent = React.forwardRef<
  React.ElementRef<typeof CardContent>,
  React.ComponentPropsWithoutRef<typeof CardContent>
>(({ className, ...props }, ref) => (
  <CardContent
    ref={ref}
    className={cn("p-8 pt-0", className)}
    {...props}
  />
))
CustomCardContent.displayName = "CustomCardContent"

// Card header with more padding
const CustomCardHeader = React.forwardRef<
  React.ElementRef<typeof CardHeader>,
  React.ComponentPropsWithoutRef<typeof CardHeader>
>(({ className, ...props }, ref) => (
  <CardHeader
    ref={ref}
    className={cn("p-8 pb-0", className)}
    {...props}
  />
))
CustomCardHeader.displayName = "CustomCardHeader"

export { 
  CustomCard, 
  CustomDangerCard, 
  CustomCardHeader, 
  CustomCardContent,
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent 
} 