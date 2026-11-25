import Guard from "@/components/Guard";
import Payments from "@/views/Payments";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <Payments />
    </Guard>
  );
}
