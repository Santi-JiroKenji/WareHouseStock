"use client";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
export function SelectField({ value, onChange, items, label }: {
    value: string;
    onChange: (v: string) => void;
    items: {
        value: string;
        label: string;
    }[];
    label: string;
}) {
    return <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={label}>
    <SelectValue placeholder={label}/>
    </SelectTrigger>
    <SelectContent>{items.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
    </Select>;
}
