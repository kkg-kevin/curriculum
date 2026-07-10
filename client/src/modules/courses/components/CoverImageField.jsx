import { useFormContext, Controller } from "react-hook-form";
import ImageUploadField from "../../../components/ImageUploadField";

export default function CoverImageField({ name, label }) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => <ImageUploadField label={label} value={field.value} onChange={field.onChange} />}
    />
  );
}
