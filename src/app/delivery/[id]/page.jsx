import Guard from "@/components/Guard";
import DeliveryVerification from "@/views/DeliveryVerification";

export default function Page() {
  return (
    <Guard roles={["receiver"]}>
      <DeliveryVerification />
    </Guard>
  );
}
