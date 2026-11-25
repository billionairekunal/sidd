import Guard from "@/components/Guard";
import LRDetail from "@/views/LRDetail";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <LRDetail />
    </Guard>
  );
}
