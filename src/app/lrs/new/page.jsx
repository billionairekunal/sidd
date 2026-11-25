import Guard from "@/components/Guard";
import NewLR from "@/views/NewLR";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <NewLR />
    </Guard>
  );
}
