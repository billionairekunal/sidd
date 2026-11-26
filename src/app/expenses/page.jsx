import Guard from "@/components/Guard";
import Expenses from "@/views/Expenses";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <Expenses />
    </Guard>
  );
}
