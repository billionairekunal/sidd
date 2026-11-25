import Guard from "@/components/Guard";
import LRList from "@/views/LRList";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <LRList />
    </Guard>
  );
}
