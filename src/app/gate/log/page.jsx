import Guard from "@/components/Guard";
import DepartureLog from "@/views/DepartureLog";

export default function Page() {
  return (
    <Guard roles={["security"]}>
      <DepartureLog />
    </Guard>
  );
}
