import Guard from "@/components/Guard";
import Fleet from "@/views/Fleet";

export default function Page() {
  return (
    <Guard roles={["owner", "dispatcher"]}>
      <Fleet />
    </Guard>
  );
}
