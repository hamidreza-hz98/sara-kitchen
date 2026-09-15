import Button from "@mui/material/Button";
import type { ButtonProps } from "@mui/material/Button";

export type ActionButtonProps = ButtonProps;

export function ActionButton({ type = "button", ...props }: ActionButtonProps) {
  return <Button type={type} {...props} />;
}
