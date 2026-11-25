import Guard from "@/components/Guard";
import Inspections from "@/views/Inspections";

export default function Page() {
  return (
    <Guard roles={["receiver"]}>
      <Inspections />
    </Guard>
  );
}
