"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"

function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Nach dem Absenden des Formulars wieder verbergen (Issue #34).
  React.useEffect(() => {
    const form = wrapperRef.current?.closest("form")
    if (!form) return
    const hide = () => setVisible(false)
    form.addEventListener("submit", hide)
    return () => form.removeEventListener("submit", hide)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...props}
        type={visible ? "text" : "password"}
        className={cn(className, "pr-11 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden")}
      />
      <button
        type="button"
        disabled={props.disabled}
        // Fokus nicht vom Input nehmen, damit die Handytastatur offen bleibt.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {visible ? (
          <EyeOff className="size-5" aria-hidden="true" />
        ) : (
          <Eye className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export { PasswordInput }
