/** Visual cue that the control has a hover tip (`title`). */
export function BtnInfoMark({ className = '' }: { className?: string }) {
  return (
    <span className={`btn-info-i${className ? ` ${className}` : ''}`} aria-hidden="true">
      i
    </span>
  )
}
