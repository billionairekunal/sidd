import Guard from "@/components/Guard";
import Reconciliation from "@/views/Reconciliation";

export default function Page() {
  return (
    <Guard roles={["receiver"]}>
      <Reconciliation />
    </Guard>
  );
}
