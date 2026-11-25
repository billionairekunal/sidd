import Guard from "@/components/Guard";
import Reports from "@/views/Reports";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <Reports />
    </Guard>
  );
}
