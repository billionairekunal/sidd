import Guard from "@/components/Guard";
import InspectionDetail from "@/views/InspectionDetail";

export default function Page() {
  return (
    <Guard roles={["receiver"]}>
      <InspectionDetail />
    </Guard>
  );
}
