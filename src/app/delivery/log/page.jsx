import Guard from "@/components/Guard";
import DeliveryLog from "@/views/DeliveryLog";

export default function Page() {
  return (
    <Guard roles={["receiver"]}>
      <DeliveryLog />
    </Guard>
  );
}
