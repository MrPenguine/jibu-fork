"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@libs/shadcn-ui/components/ui/toast"
import { useToast } from "@libs/shadcn-ui/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }: any) {
        return (
          <Toast key={id} className="mb-4 last:mb-0" {...props}>
            <div className="grid gap-1.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport className="p-6 gap-4" />
    </ToastProvider>
  )
}
