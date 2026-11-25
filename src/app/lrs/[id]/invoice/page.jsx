import Guard from "@/components/Guard";
import LRInvoice from "@/views/LRInvoice";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]} bare>
      <LRInvoice />
    </Guard>
  );
}
