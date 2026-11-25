import Guard from "@/components/Guard";
import Settings from "@/views/Settings";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <Settings />
    </Guard>
  );
}
