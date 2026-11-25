import Guard from "@/components/Guard";
import DeliveryQueue from "@/views/DeliveryQueue";

export default function Page() {
  return (
    <Guard roles={["receiver"]}>
      <DeliveryQueue />
    </Guard>
  );
}
