import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** The control. A single element gets an auto-generated id wired to the label. */
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const autoId = useId();

  let control = children;
  if (isValidElement(children)) {
    const el = children as ReactElement<{ id?: string }>;
    control = cloneElement(el, { id: el.props.id ?? autoId });
  }
  const controlId = isValidElement(children)
    ? ((children as ReactElement<{ id?: string }>).props.id ?? autoId)
    : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={controlId} className="text-xs font-medium text-content-secondary">
          {label}
        </label>
      )}
      {control}
      {hint && !error && <p className="text-xs text-content-faint">{hint}</p>}
      {error && <p className="text-xs text-score-down-text">{error}</p>}
    </div>
  );
}

export default Field;
