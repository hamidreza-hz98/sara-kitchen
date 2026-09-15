import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import type { TextFieldProps } from "@mui/material/TextField";
import type { ReactNode } from "react";

export type FormFieldProps = Omit<TextFieldProps, "label" | "name" | "select"> & {
  label: ReactNode;
  name: string;
};

export function FormField(props: FormFieldProps) {
  return <TextField {...props} />;
}

export type SelectOption = {
  disabled?: boolean;
  label: ReactNode;
  value: number | string;
};

export type SelectFieldProps = Omit<TextFieldProps, "children" | "label" | "name" | "select"> & {
  label: ReactNode;
  name: string;
  options: readonly SelectOption[];
};

export function SelectField({ options, ...props }: SelectFieldProps) {
  return (
    <TextField {...props} select>
      {options.map((option) => (
        <MenuItem disabled={option.disabled} key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
