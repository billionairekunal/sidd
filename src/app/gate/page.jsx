import Guard from "@/components/Guard";
import GateControl from "@/views/GateControl";

export default function Page() {
  return (
    <Guard roles={["security"]}>
      <GateControl />
    </Guard>
  );
}
