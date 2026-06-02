import TagEditor from "@/app/tags/TagEditor";

export default function NewTagPage() {
  return (
    <TagEditor
      mode="create"
      initial={{ id: "", label: "", labelUa: "", icon: "", type: "" }}
    />
  );
}
