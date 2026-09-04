import { useFormContext, Controller } from "react-hook-form";
import ImageUploadField from "../../../components/ImageUploadField";

// Same thin Controller wrapper as courses/components/CoverImageField.jsx, reusing the shared
// upload-based ImageUploadField (POSTs to /api/uploads and hands back a URL) rather than a
// plain text URL box.
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
